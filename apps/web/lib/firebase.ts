import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyBanBBtS727fWh3S_-cjkZVzuuCzMkA-Kw",
  authDomain: "atrail-86953.firebaseapp.com",
  projectId: "atrail-86953",
  storageBucket: "atrail-86953.firebasestorage.app",
  messagingSenderId: "164978076287",
  appId: "1:164978076287:web:6e50aa0fda6799c9e92d4a",
  measurementId: "G-HR20LSFBZV"
};

const app = initializeApp(firebaseConfig);
const messaging = typeof window !== 'undefined' ? getMessaging(app) : null;

export { app, messaging, getToken, onMessage };
