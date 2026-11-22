import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAY84ZH3CpokHHSaecNp30EvE3uDN9fw9M",
  authDomain: "agenda-igreja-99e62.firebaseapp.com",
  projectId: "agenda-igreja-99e62",
  storageBucket: "agenda-igreja-99e62.firebasestorage.app",
  messagingSenderId: "1009799668314",
  appId: "1:1009799668314:web:adbc1f020d04a6f527ae63"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
