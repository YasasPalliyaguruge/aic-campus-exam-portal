import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Debug: Check if config is loaded
if (!firebaseConfig.apiKey) {
  console.error("Firebase API Key is missing! Check your .env.local file.");
  alert("Critical Error: Firebase Configuration Missing. Please check the console and restart the server.");
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Auth
export const auth = getAuth(app);

// Initialize Firestore with named database
// IMPORTANT: Connect to your named database "exam-portal"
export const db = getFirestore(app, 'exam-portal');

// Initialize Storage
export const storage = getStorage(app);

// Log successful initialization
console.log('✅ Firebase initialized successfully');
console.log(`📦 Project ID: ${firebaseConfig.projectId}`);
