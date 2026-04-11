import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDIlwypIO3DrCU_WHx583EeavPf0An7-vQ",
  authDomain: "event-control-web.firebaseapp.com",
  projectId: "event-control-web",
  storageBucket: "event-control-web.firebasestorage.app",
  messagingSenderId: "606914760543",
  appId: "1:606914760543:web:1fd82d600947172f66b0ea",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };
