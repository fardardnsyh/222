// import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// // myapp.com/dashboard/*
// const isPublicRoute = createRouteMatcher(['/sign-in(.*)', '/sign-up(.*)']);

// export default clerkMiddleware((auth, request) =>{
//   if(!isPublicRoute(request)){
//     auth().protect();
//   }
// });

// export const config = {
//   matcher: [
//     // Skip Next.js internals and all static files, unless found in search params
//     '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
//     // Always run for API routes
//     '/(api|trpc)(.*)',
//   ],
// };
// import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// // myapp.com/dashboard/*
// const isProtectedRoute = createRouteMatcher(["/dashboard(.*)"]); 

// export default clerkMiddleware((auth, req)=>{
//     if (isProtectedRoute(req)) auth().protect();
// });

// export const config = {
//   matcher: [
//     // Skip Next.js internals and all static files, unless found in search params
//     '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
//     // Always run for API routes
//     '/(api|trpc)(.*)',
//   ],
// };

// import { clerkMiddleware } from "@clerk/nextjs/server";

// const isProtectedRoute = (req) => {
//   const path = req.nextUrl.pathname;
//   const protectedRoutes = /^\/dashboard(.*)/;
//   return protectedRoutes.test(path);
// };

// export default clerkMiddleware((auth, req) => {
//   if (isProtectedRoute(req)) auth().protect();
// });

// export const config = {
//   matcher: [
//     // Skip Next.js internals and all static files, unless found in search params
//     '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
//     // Always run for API routes
//     '/(api|trpc)(.*)',
//   ],
// };
import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";

const isProtectedRoute = (req: NextRequest): boolean => {
  const path = req.nextUrl.pathname;
  const protectedRoutes = /^\/dashboard(.*)/;
  return protectedRoutes.test(path);
};

export default clerkMiddleware((auth: any, req: NextRequest) => {
  if (isProtectedRoute(req)) auth().protect();
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
