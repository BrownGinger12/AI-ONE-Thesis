// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

import { getFirestore } from 'firebase/firestore';
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyC1yJj5UWwA3GcnbFcpXluE06kcH8Lf4jk",
  authDomain: "thesis-c645c.firebaseapp.com",
  databaseURL: "https://thesis-c645c-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "thesis-c645c",
  storageBucket: "thesis-c645c.firebasestorage.app",
  messagingSenderId: "546024276516",
  appId: "1:546024276516:web:b9c954ac189b8490f6ceb1"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const database = getDatabase(app);
export const db = getFirestore(app);