// auth.js - Módulo central de Autenticación y Control de Roles con Firebase
import { auth, db } from "./conection.js";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

import {
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  collection,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Lista de roles válidos del sistema
export const ROLES = {
  SUPERADMIN: "superadmin",
  ADMINISTRADOR: "administrador",
  TRABAJADOR: "trabajador",
  CLIENTE: "cliente"
};

// Traductor de errores comunes de Firebase a español amigable
export function traducirErrorFirebase(codigo) {
  const str = String(codigo || "");
  if (str.includes("permission-denied") || str.includes("Missing or insufficient permissions")) {
    return "Error de permisos en Firestore (permission-denied). Debes configurar las Reglas de Seguridad en la consola de Firebase.";
  }

  switch (codigo) {
    case "auth/invalid-email":
      return "El formato del correo electrónico no es válido.";
    case "auth/user-disabled":
      return "Esta cuenta ha sido deshabilitada.";
    case "auth/user-not-found":
      return "No existe una cuenta registrada con este correo.";
    case "auth/wrong-password":
      return "La contraseña ingresada es incorrecta.";
    case "auth/invalid-credential":
      return "Correo o contraseña incorrectos. Verifica tus credenciales.";
    case "auth/email-already-in-use":
      return "Este correo electrónico ya se encuentra registrado.";
    case "auth/weak-password":
      return "La contraseña debe tener al menos 6 caracteres.";
    case "auth/network-request-failed":
      return "Error de conexión. Revisa tu conexión a internet.";
    case "auth/too-many-requests":
      return "Demasiados intentos fallidos. Intenta de nuevo más tarde.";
    case "permission-denied":
      return "Permiso denegado en Firestore (permission-denied). Publica las reglas en la consola de Firebase.";
    default:
      return "Ocurrió un error: " + (codigo || "Desconocido");
  }
}

/**
 * Iniciar sesión con email y contraseña, recuperando el rol desde Firestore
 */
export async function iniciarSesion(email, password) {
  try {
    const credencial = await signInWithEmailAndPassword(auth, email, password);
    const user = credencial.user;

    // Obtener información adicional y rol desde Firestore
    const userDocRef = doc(db, "usuarios", user.uid);
    let docSnap = await getDoc(userDocRef);

    let userData = null;
    let rol = ROLES.CLIENTE;

    if (docSnap.exists()) {
      userData = docSnap.data();
      rol = userData.rol || ROLES.CLIENTE;
    } else {
      // Si el usuario existe en Auth pero no en Firestore, creamos su registro por defecto como cliente
      userData = {
        uid: user.uid,
        nombre: user.displayName || email.split("@")[0],
        email: user.email,
        rol: ROLES.CLIENTE,
        fechaCreacion: new Date().toISOString()
      };
      await setDoc(userDocRef, userData);
    }

    return {
      success: true,
      user,
      userData,
      rol
    };
  } catch (error) {
    console.error("Error al iniciar sesión:", error);
    return {
      success: false,
      error: traducirErrorFirebase(error.code || error.message),
      rawError: error
    };
  }
}

/**
 * Registrar un nuevo usuario en Firebase Auth y guardar sus datos y rol en Firestore
 */
export async function registrarUsuario(nombre, email, password, rol = ROLES.CLIENTE) {
  try {
    // Validar que el rol sea uno de los permitidos
    const rolesValidos = Object.values(ROLES);
    const rolFinal = rolesValidos.includes(rol) ? rol : ROLES.CLIENTE;

    const credencial = await createUserWithEmailAndPassword(auth, email, password);
    const user = credencial.user;

    // Actualizar nombre en Auth
    if (nombre) {
      await updateProfile(user, { displayName: nombre });
    }

    // Crear documento en la colección 'usuarios'
    const userData = {
      uid: user.uid,
      nombre: nombre || email.split("@")[0],
      email: user.email,
      rol: rolFinal,
      fechaCreacion: new Date().toISOString()
    };

    await setDoc(doc(db, "usuarios", user.uid), userData);

    return {
      success: true,
      user,
      userData,
      rol: rolFinal
    };
  } catch (error) {
    console.error("Error al registrar usuario:", error);
    return {
      success: false,
      error: traducirErrorFirebase(error.code || error.message),
      rawError: error
    };
  }
}

/**
 * Cerrar sesión
 */
export async function cerrarSesion() {
  try {
    await signOut(auth);
    window.location.href = "login.html";
  } catch (error) {
    console.error("Error al cerrar sesión:", error);
    alert("Error al cerrar sesión: " + error.message);
  }
}

/**
 * Obtener datos completos del usuario actualmente autenticado
 */
export function obtenerUsuarioActual() {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        resolve(null);
        return;
      }
      try {
        const docSnap = await getDoc(doc(db, "usuarios", user.uid));
        if (docSnap.exists()) {
          resolve({ user, userData: docSnap.data(), rol: docSnap.data().rol || ROLES.CLIENTE });
        } else {
          resolve({
            user,
            userData: { uid: user.uid, email: user.email, nombre: user.displayName || user.email, rol: ROLES.CLIENTE },
            rol: ROLES.CLIENTE
          });
        }
      } catch (e) {
        console.error("Error al obtener datos del usuario:", e);
        resolve({
          user,
          userData: { uid: user.uid, email: user.email, nombre: user.displayName || user.email, rol: ROLES.CLIENTE },
          rol: ROLES.CLIENTE
        });
      }
    });
  });
}

/**
 * Escucha en tiempo real los cambios de estado de autenticación
 */
export function escucharEstadoAuth(callback) {
  return onAuthStateChanged(auth, async (user) => {
    if (!user) {
      callback(null);
      return;
    }
    try {
      const docSnap = await getDoc(doc(db, "usuarios", user.uid));
      const userData = docSnap.exists()
        ? docSnap.data()
        : { uid: user.uid, email: user.email, nombre: user.displayName || user.email, rol: ROLES.CLIENTE };
      callback({ user, userData, rol: userData.rol || ROLES.CLIENTE });
    } catch (e) {
      console.error("Error al consultar usuario en Firestore:", e);
      callback({
        user,
        userData: { uid: user.uid, email: user.email, nombre: user.displayName || user.email, rol: ROLES.CLIENTE },
        rol: ROLES.CLIENTE
      });
    }
  });
}

/**
 * Proteger una página verificando si el usuario está autenticado y posee los roles permitidos
 */
export function protegerRuta(rolesPermitidos = []) {
  return onAuthStateChanged(auth, async (user) => {
    if (!user) {
      // No autenticado -> redirigir a login
      window.location.href = "login.html";
      return;
    }

    if (rolesPermitidos && rolesPermitidos.length > 0) {
      try {
        const docSnap = await getDoc(doc(db, "usuarios", user.uid));
        const rol = docSnap.exists() ? docSnap.data().rol : ROLES.CLIENTE;

        if (!rolesPermitidos.includes(rol)) {
          alert(`Acceso denegado: Tu rol (${rol}) no tiene permisos para acceder a esta sección.`);
          window.location.href = "Index.html";
        }
      } catch (e) {
        console.error("Error al verificar permisos:", e);
        window.location.href = "Index.html";
      }
    }
  });
}

/**
 * Obtener todos los usuarios registrados (Solo para Superadmin / Administrador)
 */
export async function obtenerTodosLosUsuarios() {
  try {
    const querySnapshot = await getDocs(collection(db, "usuarios"));
    const usuarios = [];
    querySnapshot.forEach((doc) => {
      usuarios.push({ id: doc.id, ...doc.data() });
    });
    return usuarios;
  } catch (error) {
    console.error("Error al obtener usuarios:", error);
    throw error;
  }
}

/**
 * Cambiar el rol de un usuario en Firestore (Función exclusiva de Superadmin)
 */
export async function cambiarRolUsuario(uid, nuevoRol) {
  try {
    const userDocRef = doc(db, "usuarios", uid);
    await updateDoc(userDocRef, { rol: nuevoRol });
    return { success: true };
  } catch (error) {
    console.error("Error al cambiar rol:", error);
    return { success: false, error: error.message };
  }
}
