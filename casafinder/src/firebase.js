import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBfMD80iffgehVWz2SfnESPRYbkrwWT-cw",
  authDomain: "casafinder-e08f6.firebaseapp.com",
  projectId: "casafinder-e08f6",
  storageBucket: "casafinder-e08f6.firebasestorage.app",
  messagingSenderId: "724036344672",
  appId: "1:724036344672:web:b53d252d6e30f768d51c05"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
