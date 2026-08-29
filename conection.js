// Configuración e inicialización de Firebase modular (v10)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDJ-19i9AJGZoESY6KsI4RHeTmSI-wbuME",
  authDomain: "freechair-ebf52.firebaseapp.com",
  projectId: "freechair-ebf52",
  storageBucket: "freechair-ebf52.firebasestorage.app",
  messagingSenderId: "250304395781",
  appId: "1:250304395781:web:fc59380d61de95d2c1fa6c"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db, firebaseConfig };