// Configuración e inicialización de Firebase modular (v10)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: 'AIzaSyDnMLypV_JhPBjgLnZNEPeNbcCGruPUCtQ',
  authDomain: 'freechair-ca817.firebaseapp.com',
  projectId: 'freechair-ca817',
  storageBucket: 'freechair-ca817.firebasestorage.app',
  messagingSenderId: '383603153531',
  appId: '1:383603153531:web:3bba5cf9e964c4f66ae0de',
  measurementId: 'G-M3VR36LZ2H'
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db, firebaseConfig };