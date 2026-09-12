// restaurant-service.js - Servicios de Capacidad, Menú, Calificaciones y Propinas en FreeChair
import { db } from "./conection.js";
import {
  doc,
  getDoc,
  setDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Menú inicial predeterminado por si Firestore aún no tiene registros
export const MENU_INICIAL = [
  {
    id: "plato-1",
    nombre: "Hamburguesa Gourmet FreeChair",
    categoria: "Platos Fuertes",
    precio: 26000,
    descripcion: "Carne de res angus 200g, queso cheddar madurado, tocineta crujiente, cebolla caramelizada y salsa de la casa.",
    disponible: true
  },
  {
    id: "plato-2",
    nombre: "Ceviche Mixto del Pacífico",
    categoria: "Entradas",
    precio: 22000,
    descripcion: "Camarones y pescado fresco marinados en zumo de lima, maíz crocante, aguacate y chips de plátano.",
    disponible: true
  },
  {
    id: "plato-3",
    nombre: "Lasaña Bolognesa Artesanal",
    categoria: "Platos Fuertes",
    precio: 29000,
    descripcion: "Pasta fresca horneada en capas con salsa pomodoro tradicional, carne magra, bechamel y queso parmesano gratinado.",
    disponible: true
  },
  {
    id: "plato-4",
    nombre: "Limonada de Coco Cremosita",
    categoria: "Bebidas",
    precio: 11000,
    descripcion: "Refrescante batido de crema de coco natural, hielo frappé y zumo de limón fresco.",
    disponible: true
  },
  {
    id: "plato-5",
    nombre: "Coctel Pink FreeChair",
    categoria: "Cocteles",
    precio: 24000,
    descripcion: "Gin de frutos rojos, tónica premium, infusión de hibisco y rodajas de fresas frescas.",
    disponible: true
  },
  {
    id: "plato-6",
    nombre: "Volcán de Chocolate Fondant",
    categoria: "Postres",
    precio: 15000,
    descripcion: "Bizcocho tibio de chocolate belga con centro líquido fundido, acompañado de helado artesanal de vainilla.",
    disponible: true
  }
];

const CAPACIDAD_DEFAULT = 50;

// ==========================================
// 1. GESTIÓN DE CAPACIDAD DEL RESTAURANTE
// ==========================================

export async function obtenerCapacidadRestaurante() {
  try {
    const docRef = doc(db, "configuracion", "restaurante");
    const docSnap = await getDoc(docRef);
    if (docSnap.exists() && docSnap.data().capacidadTotal) {
      const cap = Number(docSnap.data().capacidadTotal);
      localStorage.setItem("freechair_capacidad_total", cap);
      return cap;
    }
  } catch (error) {
    console.warn("No se pudo obtener capacidad de Firestore, usando local:", error);
  }

  // Respaldo Local
  const localCap = localStorage.getItem("freechair_capacidad_total");
  return localCap ? Number(localCap) : CAPACIDAD_DEFAULT;
}

export async function guardarCapacidadRestaurante(capacidadTotal) {
  const cap = Number(capacidadTotal) || CAPACIDAD_DEFAULT;
  localStorage.setItem("freechair_capacidad_total", cap);

  try {
    const docRef = doc(db, "configuracion", "restaurante");
    await setDoc(docRef, {
      capacidadTotal: cap,
      ultimaActualizacion: new Date().toISOString()
    }, { merge: true });
    return { success: true, capacidad: cap };
  } catch (error) {
    console.warn("No se pudo guardar capacidad en Firestore (guardado en local):", error);
    return { success: true, capacidad: cap, localOnly: true };
  }
}

// ==========================================
// 2. GESTIÓN DEL MENÚ GASTRONÓMICO (CRUD)
// ==========================================

export async function obtenerMenu() {
  let menu = [];

  try {
    const querySnapshot = await getDocs(collection(db, "menu"));
    if (!querySnapshot.empty) {
      querySnapshot.forEach(docSnap => {
        menu.push({ id: docSnap.id, ...docSnap.data() });
      });
      localStorage.setItem("freechair_menu_items", JSON.stringify(menu));
      return menu;
    }
  } catch (error) {
    console.warn("No se pudo cargar menú de Firestore:", error);
  }

  // Fallback Local
  try {
    const guardado = localStorage.getItem("freechair_menu_items");
    if (guardado) {
      menu = JSON.parse(guardado);
      if (menu && menu.length > 0) return menu;
    }
  } catch (_) {}

  // Semilla inicial
  localStorage.setItem("freechair_menu_items", JSON.stringify(MENU_INICIAL));
  return MENU_INICIAL;
}

export async function crearItemMenu(itemData) {
  const item = {
    nombre: itemData.nombre || "Plato sin nombre",
    categoria: itemData.categoria || "Platos Fuertes",
    precio: Number(itemData.precio) || 0,
    descripcion: itemData.descripcion || "",
    disponible: itemData.disponible !== false,
    fechaCreacion: new Date().toISOString()
  };

  try {
    const docRef = await addDoc(collection(db, "menu"), item);
    const nuevo = { id: docRef.id, ...item };
    
    // Sincronizar local
    const menuActual = await obtenerMenu();
    menuActual.unshift(nuevo);
    localStorage.setItem("freechair_menu_items", JSON.stringify(menuActual));

    return { success: true, item: nuevo };
  } catch (error) {
    console.warn("Guardando nuevo item de menú localmente:", error);
    const localId = "menu-" + Date.now();
    const nuevo = { id: localId, ...item };
    const menuActual = await obtenerMenu();
    menuActual.unshift(nuevo);
    localStorage.setItem("freechair_menu_items", JSON.stringify(menuActual));
    return { success: true, item: nuevo, localOnly: true };
  }
}

export async function actualizarItemMenu(id, datosActualizados) {
  try {
    const docRef = doc(db, "menu", id);
    await updateDoc(docRef, datosActualizados);
  } catch (error) {
    console.warn("No se pudo actualizar en Firestore, actualizando local:", error);
  }

  // Actualizar en localStorage
  try {
    let menuActual = await obtenerMenu();
    menuActual = menuActual.map(item => item.id === id ? { ...item, ...datosActualizados } : item);
    localStorage.setItem("freechair_menu_items", JSON.stringify(menuActual));
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

export async function eliminarItemMenu(id) {
  try {
    await deleteDoc(doc(db, "menu", id));
  } catch (error) {
    console.warn("No se pudo eliminar en Firestore, eliminando en local:", error);
  }

  // Eliminar en localStorage
  try {
    let menuActual = await obtenerMenu();
    menuActual = menuActual.filter(item => item.id !== id);
    localStorage.setItem("freechair_menu_items", JSON.stringify(menuActual));
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ==========================================
// 3. OBTENER LISTA DE TRABAJADORES ACTIVOS
// ==========================================

export async function obtenerTrabajadores() {
  let trabajadores = [];

  try {
    const q = query(collection(db, "usuarios"), where("rol", "==", "trabajador"));
    const querySnapshot = await getDocs(q);
    querySnapshot.forEach(docSnap => {
      const data = docSnap.data();
      trabajadores.push({
        id: docSnap.id,
        nombre: data.nombre || data.email?.split("@")[0] || "Trabajador",
        email: data.email || "",
        rol: "trabajador"
      });
    });

    if (trabajadores.length > 0) {
      localStorage.setItem("freechair_trabajadores_cache", JSON.stringify(trabajadores));
      return trabajadores;
    }
  } catch (error) {
    console.warn("Error al consultar trabajadores de Firestore:", error);
  }

  // Fallback cache local o lista inicial amigable
  try {
    const cached = localStorage.getItem("freechair_trabajadores_cache");
    if (cached) {
      trabajadores = JSON.parse(cached);
      if (trabajadores && trabajadores.length > 0) return trabajadores;
    }
  } catch (_) {}

  // Datos de ejemplo si no hay trabajadores registrados aún
  const defaultTrabajadores = [
    { id: "trabajador-1", nombre: "Mateo Suárez (Mesero Sala)", email: "mateo@freechair.com", rol: "trabajador" },
    { id: "trabajador-2", nombre: "Valentina Ríos (Atención VIP)", email: "valentina@freechair.com", rol: "trabajador" },
    { id: "trabajador-3", nombre: "Andrés Cardona (Bar & Terraza)", email: "andres@freechair.com", rol: "trabajador" }
  ];
  return defaultTrabajadores;
}

// ==========================================
// 4. CALIFICACIONES DE CLIENTES A TRABAJADORES
// ==========================================

export async function enviarCalificacion({ trabajadorId, trabajadorNombre, clienteId, clienteNombre, estrellas, comentario }) {
  const registro = {
    trabajadorId,
    trabajadorNombre,
    clienteId,
    clienteNombre: clienteNombre || "Cliente Anónimo",
    estrellas: Math.min(5, Math.max(1, Number(estrellas) || 5)),
    comentario: comentario?.trim() || "Excelente atención.",
    fecha: new Date().toISOString()
  };

  try {
    const docRef = await addDoc(collection(db, "calificaciones"), registro);
    registro.id = docRef.id;
  } catch (error) {
    console.warn("Guardando calificación localmente:", error);
    registro.id = "calif-" + Date.now();
  }

  // Guardar en respaldo local
  try {
    const todas = JSON.parse(localStorage.getItem("freechair_calificaciones") || "[]");
    todas.unshift(registro);
    localStorage.setItem("freechair_calificaciones", JSON.stringify(todas));
  } catch (_) {}

  return { success: true, calificacion: registro };
}

export async function obtenerCalificacionesTrabajador(trabajadorId) {
  let calificaciones = [];

  try {
    const q = query(collection(db, "calificaciones"), where("trabajadorId", "==", trabajadorId));
    const snapshot = await getDocs(q);
    snapshot.forEach(docSnap => {
      calificaciones.push({ id: docSnap.id, ...docSnap.data() });
    });
  } catch (error) {
    console.warn("Consultando calificaciones locales:", error);
  }

  // Complementar o usar respaldo local
  try {
    const locales = JSON.parse(localStorage.getItem("freechair_calificaciones") || "[]");
    const filtradas = locales.filter(c => c.trabajadorId === trabajadorId);
    
    // Unir sin duplicados por ID
    const mapa = new Map();
    calificaciones.forEach(c => mapa.set(c.id, c));
    filtradas.forEach(c => mapa.set(c.id, c));
    calificaciones = Array.from(mapa.values());
  } catch (_) {}

  // Ordenar cronológicamente descendente
  calificaciones.sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));
  return calificaciones;
}

// ==========================================
// 5. PROPINAS DE CLIENTES A TRABAJADORES
// ==========================================

export async function enviarPropina({ trabajadorId, trabajadorNombre, clienteId, clienteNombre, monto, mensaje }) {
  const montoNum = Number(monto) || 0;
  if (montoNum <= 0) {
    return { success: false, error: "El monto de la propina debe ser mayor a 0." };
  }

  const registro = {
    trabajadorId,
    trabajadorNombre,
    clienteId,
    clienteNombre: clienteNombre || "Cliente Generoso",
    monto: montoNum,
    mensaje: mensaje?.trim() || "¡Gracias por el excelente servicio!",
    fecha: new Date().toISOString()
  };

  try {
    const docRef = await addDoc(collection(db, "propinas"), registro);
    registro.id = docRef.id;
  } catch (error) {
    console.warn("Guardando propina localmente:", error);
    registro.id = "propina-" + Date.now();
  }

  // Guardar en respaldo local
  try {
    const todas = JSON.parse(localStorage.getItem("freechair_propinas") || "[]");
    todas.unshift(registro);
    localStorage.setItem("freechair_propinas", JSON.stringify(todas));
  } catch (_) {}

  return { success: true, propina: registro };
}

export async function obtenerPropinasTrabajador(trabajadorId) {
  let propinas = [];

  try {
    const q = query(collection(db, "propinas"), where("trabajadorId", "==", trabajadorId));
    const snapshot = await getDocs(q);
    snapshot.forEach(docSnap => {
      propinas.push({ id: docSnap.id, ...docSnap.data() });
    });
  } catch (error) {
    console.warn("Consultando propinas locales:", error);
  }

  // Complementar o usar respaldo local
  try {
    const locales = JSON.parse(localStorage.getItem("freechair_propinas") || "[]");
    const filtradas = locales.filter(p => p.trabajadorId === trabajadorId);

    const mapa = new Map();
    propinas.forEach(p => mapa.set(p.id, p));
    filtradas.forEach(p => mapa.set(p.id, p));
    propinas = Array.from(mapa.values());
  } catch (_) {}

  // Ordenar de más reciente a más antigua
  propinas.sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));
  return propinas;
}

// ==========================================
// 6. MÉTRICAS CONSOLIDADAS DEL TRABAJADOR
// ==========================================

export async function obtenerMetricasTrabajador(trabajadorId) {
  const [propinas, calificaciones] = await Promise.all([
    obtenerPropinasTrabajador(trabajadorId),
    obtenerCalificacionesTrabajador(trabajadorId)
  ]);

  const totalPropinas = propinas.reduce((acc, p) => acc + (Number(p.monto) || 0), 0);
  const totalCalificaciones = calificaciones.length;
  const sumaEstrellas = calificaciones.reduce((acc, c) => acc + (Number(c.estrellas) || 0), 0);
  const promedioEstrellas = totalCalificaciones > 0 ? (sumaEstrellas / totalCalificaciones).toFixed(1) : "5.0";

  return {
    totalPropinas,
    totalTransaccionesPropinas: propinas.length,
    propinas,
    totalCalificaciones,
    promedioEstrellas,
    calificaciones
  };
}

// ==========================================
// 7. FORMATO MONEDA
// ==========================================
export function formatearMoneda(valor) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0
  }).format(Number(valor) || 0);
}
