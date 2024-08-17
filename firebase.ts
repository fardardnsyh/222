import { getApps, initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDl9ptiOv3MKPoIQlMSYWmdce9g0yhz1ok",
  authDomain: "chat-with-pdf-challenge-fb1bd.firebaseapp.com",
  projectId: "chat-with-pdf-challenge-fb1bd",
  storageBucket: "chat-with-pdf-challenge-fb1bd.appspot.com",
  messagingSenderId: "50887452543",
  appId: "1:50887452543:web:a2969a239fe380dbc39c4a"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

const db = getFirestore(app);
const storage = getStorage(app);

export { db, storage };