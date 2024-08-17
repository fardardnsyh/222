import { ChatOpenAI } from "@langchain/openai";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { OpenAIEmbeddings } from "@langchain/openai";
import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { createRetrievalChain } from "langchain/chains/retrieval";
import { createHistoryAwareRetriever } from "langchain/chains/history_aware_retriever";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import pineconeClient from "./pinecone";
import { PineconeStore } from "@langchain/pinecone";
import {
  PineconeConflictError,
  PineconeInternalServerError,
} from "@pinecone-database/pinecone/dist/errors";
import { Index, RecordMetadata } from "@pinecone-database/pinecone";
import { adminDb } from "../firebaseAdmin";
import { auth } from "@clerk/nextjs/server";

// Initialize the OpenAI model with API ket=y and model name
const model = new ChatOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  modelName: "gpt-4-turbo",
});

export const indexName = "papafam";

async function fetchMessagesFromDB(docId: string) {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("User not found");
  }

  console.log("---Fetching chat history from the firestore database...");
  // Get the last 6 messages from the chat history

  const chats = await adminDb
    .collection("users")
    .doc(userId)
    .collection("files")
    .doc(docId)
    .collection("chat")
    .orderBy("createdAt", "desc")
    // .limit(LIMIT
    .get();

  const chatHistory = chats.docs.map((doc) =>
    doc.data().role === "human"
      ? new HumanMessage(doc.data().message)
      : new AIMessage(doc.data().message)
  );

  console.log(`
      --- fetched last ${chatHistory.length} messages successfully ---
    `);
  console.log(chatHistory.map((msg) => msg.content.toString()));

  return chatHistory;
}

async function namespaceExists(
  index: Index<RecordMetadata>,
  namespace: string
) {
  if (namespace === null) throw new Error("No namespace value provided.");
  const { namespaces } = await index.describeIndexStats();
  return namespaces?.[namespace] !== undefined;
}

async function generateDocs(docId: string) {
  const { userId } = await auth();

  if (!userId) {
    throw new Error("User not found");
  }

  console.log("--- Fetching the download URL from firebase... ---");

  const firebaseRef = await adminDb
    .collection("users")
    .doc(userId)
    .collection("files")
    .doc(docId)
    .get();

  const downloadUrl = firebaseRef.data()?.downloadUrl;

  if (!downloadUrl) {
    throw new Error(`Download URL Fetched successfully: ${downloadUrl}`);
  }

  // Fetch the PDF from the specific URL
  const response = await fetch(downloadUrl);

  // Load the PDF into PDFDocument object
  const data = await response.blob();

  //   Load the PDF Document from the specified path
  console.log("--- Loading PDF Document... ---");
  const loader = new PDFLoader(data);
  const docs = await loader.load();

  //   Split the document into smaller part for easier processing
  console.log("Splitting the document into smaller parts ");
  const splitter = new RecursiveCharacterTextSplitter();
  const splitDocs = await splitter.splitDocuments(docs);
  console.log(`--- Split into ${splitDocs.length} parts ---`);

  return splitDocs;
}

export async function generateEmbeddingsInPineconeVectorStore(docId: string) {
  const { userId } = await auth();

  if (!userId) {
    throw new Error("User not found");
  }

  let pineconeVectorStore;

  //   Generate embeddings (numerical representation) for the split document
  console.log("---Generating embedding...");
  const embeddings = new OpenAIEmbeddings();

  const index = await pineconeClient.index(indexName);
  const namespaceAlreadyExists = await namespaceExists(index, docId);

  if (namespaceAlreadyExists) {
    console.log(
      `--- Namespace ${docId} already exists, reusing existing embeddings...---`
    );

    pineconeVectorStore = await PineconeStore.fromExistingIndex(embeddings, {
      pineconeIndex: index,
      namespace: docId,
    });

    return pineconeVectorStore;
  } else {
    // If namespace doesnt exist, download the PDF from firestore via a stored Download URL & generate the embeddings and store them in the Pinecone vector store
    const splitDocs = await generateDocs(docId);

    console.log(
      `--- Storing the embeddings in namespace ${docId} in the ${indexName} Pinecone vector store... ---`
    );

    pineconeVectorStore = await PineconeStore.fromDocuments(
      splitDocs,
      embeddings,
      {
        pineconeIndex: index,
        namespace: docId,
      }
    );
    return pineconeVectorStore;
  }
}

const generateLangchainCompletion = async (docId: string, question: string) => {
  let pineconeVectorStore;

  pineconeVectorStore = await generateEmbeddingsInPineconeVectorStore(docId);
  if (!pineconeVectorStore) {
    throw new Error("Pinecone vector store not found");
  }

  // ---
  // create a retriever to search through the vector store
  console.log("--- Creating a retriever...---");
  const retriever = pineconeVectorStore.asRetriever();

  // Fetch the chat history from the database
  const chatHistory = await fetchMessagesFromDB(docId);

  // Define a prompt template for generating search queries based on conversation history
  console.log("--- Defining a prompt template... ---");
  const historyAwarePrompt = ChatPromptTemplate.fromMessages([
    ...chatHistory, // Insert the actual chat history here

    ["user", "{input}"],
    [
      "user",
      "Given the above conversation, generate a seaarch query to look up in order to get information relevant to the conversation",
    ],
  ]);

  // Create a history-aware retriever chain that uses the model, retriever and prompt
  console.log("--- Creating a history-aware retriever cahin... ---");
  const historyAwareRetrieverChain = await createHistoryAwareRetriever({
    llm: model,
    retriever,
    rephrasePrompt: historyAwarePrompt,
  })

  // Define a prompt template for answering questions based on retiever context
  console.log("--- Defining a prompt template for answering questions... ---");
  const historyAwareRetrievalPrompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      "Answer the user's questions based on the below context:\n\n{context}",
    ],

    ...chatHistory, // Insert the actual chat history here

    ["user", "{input}"],
  ]);

  // Create a chain to combine the retriever document into a coherent response
  console.log("--- Creating a document combining chain... ---");
  const historyAwareCombineDocChain = await createStuffDocumentsChain({
    llm: model,
    prompt: historyAwareRetrievalPrompt,
  });

  // Create the main retrieval chain that combines the history=aware retriever and document combining chains
  console.log("--- Creating the main retrieval chain... ---");
  const conversationalRetrievalChain = await createRetrievalChain({
    retriever: historyAwareRetrieverChain,
    combineDocsChain: historyAwareCombineDocChain,
  });

  console.log("--- Running the chain with a sample conversation... ---");
  const reply = await conversationalRetrievalChain.invoke({
    chat_history: chatHistory,
    input: question,
  });

  // Print the result to the console
  console.log(reply.answer);
  return reply.answer;
};

// Export the model and run the function
export {model, generateLangchainCompletion}
