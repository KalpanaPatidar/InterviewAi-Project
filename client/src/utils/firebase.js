
import { initializeApp } from "firebase/app";
import {getAuth, GoogleAuthProvider} from "firebase/auth"
console.log(import.meta.env.VITE_FIREBASE_APIKEY)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_APIKEY,
   authDomain: "interviewai-53b69.firebaseapp.com",
  projectId: "interviewai-53b69",
  storageBucket: "interviewai-53b69.firebasestorage.app",
  messagingSenderId: "749393822237",
  appId: "1:749393822237:web:f80bfe9c889c3d51b53cf4",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider()
export {auth,provider}