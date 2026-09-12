// sales-service.js - Gestión comercial de Ventas, Pedidos, Reservas de Hoy, Inventario y Ganancias
import { db } from "./conection.js";
import {
  collection,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  query
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Inventario inicial predeterminado para productos gastronómicos e insumos de FreeChair
export const INVENTARIO_INICIAL = [
  {
    id: "inv-1",
    productoId: "plato-1",
    nombre: "Hamburguesa Gourmet FreeChair",
    categoria: "Platos Fuertes",
    stock: 4, // Nivel crítico (< 5) para mostrar alerta de inmediato
    stockMinimo: 10,
    unidad: "porciones",
    costo: 12000,
    precio: 26000
  },
  {
    id: "inv-2",
    productoId: "plato-2",
    nombre: "Ceviche Mixto del Pacífico",
    categoria: "Entradas",
    stock: 14,
    stockMinimo: 8,
    unidad: "porciones",
    costo: 10000,
    precio: 22000
  },
  {
    id: "inv-3",
    productoId: "plato-3",
    nombre: "Lasaña Bolognesa Artesanal",
    categoria: "Platos Fuertes",
    stock: 5, // Nivel crítico
    stockMinimo: 12,
    unidad: "porciones",
    costo: 13500,
    precio: 29000
  },
  {
    id: "inv-4",
    productoId: "plato-4",
    nombre: "Limonada de Coco Cremosita",
    categoria: "Bebidas",
    stock: 28, // Óptimo
    stockMinimo: 10,
    unidad: "vasos",
    costo: 3500,
    precio: 11000
  },
  {
    id: "inv-5",
    productoId: "plato-5",
    nombre: "Coctel Pink FreeChair",
    categoria: "Cocteles",
    stock: 7, // Nivel bajo
    stockMinimo: 10,
    unidad: "copas",
    costo: 9000,
    precio: 24000
  },
  {
    id: "inv-6",
    productoId: "plato-6",
    nombre: "Volcán de Chocolate Fondant",
    categoria: "Postres",
    stock: 3, // Nivel crítico
    stockMinimo: 8,
    unidad: "porciones",
    costo: 6000,
    precio: 15000
  }
];

// Generador de semillas realistas de ventas para hoy, esta semana y este mes
function generarVentasSemilla() {
  const ahora = new Date();
  const hoyStr = ahora.toISOString().split("T")[0];

  const ventas = [];
  const clientes = ["Carlos Mendoza", "Ana Lucía Ortiz", "Felipe Gómez", "Mariana Restrepo", "David Cárdenas", "Sofía Valbuena", "Andrés Montoya", "Elena Silva"];
  const metodos = ["Efectivo", "Tarjeta Débito", "Tarjeta Crédito", "Transferencia Nequi/Daviplata"];

  // 1. Ventas de HOY (8 pedidos realistas)
  const pedidosHoy = [
    { items: [{ nombre: "Hamburguesa Gourmet FreeChair", cantidad: 2, precio: 26000, costo: 12000 }, { nombre: "Limonada de Coco Cremosita", cantidad: 2, precio: 11000, costo: 3500 }], mesa: "Mesa 1", hora: "12:15" },
    { items: [{ nombre: "Lasaña Bolognesa Artesanal", cantidad: 1, precio: 29000, costo: 13500 }, { nombre: "Coctel Pink FreeChair", cantidad: 1, precio: 24000, costo: 9000 }], mesa: "Mesa 4", hora: "12:45" },
    { items: [{ nombre: "Ceviche Mixto del Pacífico", cantidad: 2, precio: 22000, costo: 10000 }, { nombre: "Volcán de Chocolate Fondant", cantidad: 1, precio: 15000, costo: 6000 }], mesa: "Mesa 2", hora: "13:20" },
    { items: [{ nombre: "Hamburguesa Gourmet FreeChair", cantidad: 3, precio: 26000, costo: 12000 }, { nombre: "Limonada de Coco Cremosita", cantidad: 3, precio: 11000, costo: 3500 }], mesa: "Mesa 5", hora: "14:10" },
    { items: [{ nombre: "Coctel Pink FreeChair", cantidad: 4, precio: 24000, costo: 9000 }, { nombre: "Ceviche Mixto del Pacífico", cantidad: 1, precio: 22000, costo: 10000 }], mesa: "Mesa 6", hora: "15:00" },
    { items: [{ nombre: "Lasaña Bolognesa Artesanal", cantidad: 2, precio: 29000, costo: 13500 }, { nombre: "Volcán de Chocolate Fondant", cantidad: 2, precio: 15000, costo: 6000 }], mesa: "Mesa 3", hora: "15:45" },
    { items: [{ nombre: "Hamburguesa Gourmet FreeChair", cantidad: 1, precio: 26000, costo: 12000 }, { nombre: "Limonada de Coco Cremosita", cantidad: 1, precio: 11000, costo: 3500 }], mesa: "Barra Lounge", hora: "16:10" },
    { items: [{ nombre: "Ceviche Mixto del Pacífico", cantidad: 1, precio: 22000, costo: 10000 }, { nombre: "Coctel Pink FreeChair", cantidad: 2, precio: 24000, costo: 9000 }], mesa: "Mesa 4", hora: "16:40" }
  ];

  pedidosHoy.forEach((p, idx) => {
    const totalVenta = p.items.reduce((s, it) => s + (it.precio * it.cantidad), 0);
    const totalCosto = p.items.reduce((s, it) => s + (it.costo * it.cantidad), 0);
    const fechaHora = new Date(ahora.getTime() - (8 - idx) * 35 * 60000);

    ventas.push({
      id: `venta-hoy-${idx + 1}`,
      numeroPedido: 1000 + idx + 1,
      cliente: clientes[idx % clientes.length],
      mesa: p.mesa,
      items: p.items,
      total: totalVenta,
      costo: totalCosto,
      ganancia: totalVenta - totalCosto,
      metodoPago: metodos[idx % metodos.length],
      estado: idx < 6 ? "Entregado" : (idx === 6 ? "En preparación" : "Pendiente"),
      fecha: hoyStr,
      timestamp: fechaHora.toISOString()
    });
  });

  // 2. Ventas de DÍAS ANTERIORES DE ESTA SEMANA (últimos 6 días)
  for (let d = 1; d <= 6; d++) {
    const fechaDia = new Date(ahora.getTime() - d * 24 * 60 * 60000);
    const diaStr = fechaDia.toISOString().split("T")[0];
    const pedidosDia = 4 + (d % 3);

    for (let j = 1; j <= pedidosDia; j++) {
      const items = [
        { nombre: "Hamburguesa Gourmet FreeChair", cantidad: 1 + (j % 2), precio: 26000, costo: 12000 },
        { nombre: "Limonada de Coco Cremosita", cantidad: 1 + (j % 2), precio: 11000, costo: 3500 }
      ];
      if (j % 2 === 0) {
        items.push({ nombre: "Lasaña Bolognesa Artesanal", cantidad: 1, precio: 29000, costo: 13500 });
      }
      const totalVenta = items.reduce((s, it) => s + (it.precio * it.cantidad), 0);
      const totalCosto = items.reduce((s, it) => s + (it.costo * it.cantidad), 0);

      ventas.push({
        id: `venta-sem-${d}-${j}`,
        numeroPedido: 900 + (d * 10) + j,
        cliente: clientes[(d + j) % clientes.length],
        mesa: `Mesa ${(j % 6) + 1}`,
        items,
        total: totalVenta,
        costo: totalCosto,
        ganancia: totalVenta - totalCosto,
        metodoPago: metodos[(d + j) % metodos.length],
        estado: "Entregado",
        fecha: diaStr,
        timestamp: fechaDia.toISOString()
      });
    }
  }

  // 3. Ventas de DÍAS ANTERIORES DEL MES (días 7 al 25)
  for (let d = 7; d <= 25; d += 2) {
    const fechaDia = new Date(ahora.getTime() - d * 24 * 60 * 60000);
    const diaStr = fechaDia.toISOString().split("T")[0];
    const items = [
      { nombre: "Ceviche Mixto del Pacífico", cantidad: 2, precio: 22000, costo: 10000 },
      { nombre: "Coctel Pink FreeChair", cantidad: 2, precio: 24000, costo: 9000 }
    ];
    const totalVenta = items.reduce((s, it) => s + (it.precio * it.cantidad), 0);
    const totalCosto = items.reduce((s, it) => s + (it.costo * it.cantidad), 0);

    ventas.push({
      id: `venta-mes-${d}`,
      numeroPedido: 800 + d,
      cliente: clientes[d % clientes.length],
      mesa: `Mesa ${(d % 6) + 1}`,
      items,
      total: totalVenta,
      costo: totalCosto,
      ganancia: totalVenta - totalCosto,
      metodoPago: metodos[d % metodos.length],
      estado: "Entregado",
      fecha: diaStr,
      timestamp: fechaDia.toISOString()
    });
  }

  return ventas;
}

// ============================================================
// 1. GESTIÓN DE VENTAS Y PEDIDOS
// ============================================================

export async function obtenerTodasLasVentas() {
  let ventas = [];

  // Intentar cargar de Firestore
  try {
    const querySnapshot = await getDocs(collection(db, "ventas"));
    if (!querySnapshot.empty) {
      querySnapshot.forEach(docSnap => {
        ventas.push({ id: docSnap.id, ...docSnap.data() });
      });
      localStorage.setItem("freechair_admin_ventas", JSON.stringify(ventas));
      return ventas;
    }
  } catch (error) {
    console.warn("No se pudo cargar ventas de Firestore, recurriendo a local:", error);
  }

  // Respaldo en localStorage
  try {
    const guardadas = localStorage.getItem("freechair_admin_ventas");
    if (guardadas) {
      ventas = JSON.parse(guardadas);
      if (ventas && ventas.length > 0) return ventas;
    }
  } catch (_) {}

  // Semilla inicial
  ventas = generarVentasSemilla();
  localStorage.setItem("freechair_admin_ventas", JSON.stringify(ventas));
  return ventas;
}

/**
 * Registra una nueva venta / pedido y descuenta stock automáticamente
 */
export async function registrarNuevaVenta({ cliente, mesa, items, metodoPago, estado = "Entregado" }) {
  const ahora = new Date();
  const fechaStr = ahora.toISOString().split("T")[0];

  const totalVenta = items.reduce((s, it) => s + (Number(it.precio || 0) * Number(it.cantidad || 1)), 0);
  const totalCosto = items.reduce((s, it) => s + (Number(it.costo || 0) * Number(it.cantidad || 1)), 0);
  const ganancia = totalVenta - totalCosto;

  const nuevaVenta = {
    numeroPedido: Date.now().toString().slice(-4),
    cliente: cliente || "Cliente en Barra/Mesa",
    mesa: mesa || "Mesa 1",
    items,
    total: totalVenta,
    costo: totalCosto,
    ganancia,
    metodoPago: metodoPago || "Efectivo",
    estado,
    fecha: fechaStr,
    timestamp: ahora.toISOString()
  };

  // Intentar guardar en Firestore
  try {
    const docRef = await addDoc(collection(db, "ventas"), nuevaVenta);
    nuevaVenta.id = docRef.id;
  } catch (err) {
    console.warn("Guardando venta en cache local:", err);
    nuevaVenta.id = "venta-" + Date.now();
  }

  // Guardar en localStorage
  const ventasActuales = await obtenerTodasLasVentas();
  ventasActuales.unshift(nuevaVenta);
  localStorage.setItem("freechair_admin_ventas", JSON.stringify(ventasActuales));

  // Descontar inventario de cada producto vendido
  for (const item of items) {
    await descontarStockPorVenta(item.nombre, item.cantidad);
  }

  return { success: true, venta: nuevaVenta };
}

// ============================================================
// 2. CÁLCULO DE MÉTRICAS COMERCIALES (DÍA, SEMANA, MES, GANANCIAS)
// ============================================================

export async function calcularMetricasComerciales() {
  const ventas = await obtenerTodasLasVentas();
  const ahora = new Date();
  const hoyStr = ahora.toISOString().split("T")[0];

  // Inicio de semana (hace 7 días)
  const sieteDiasAtras = new Date(ahora.getTime() - 7 * 24 * 60 * 60000);
  const mesActual = ahora.getMonth();
  const anioActual = ahora.getFullYear();

  let ventasHoy = 0;
  let pedidosHoy = 0;

  let ventasSemana = 0;
  let pedidosSemana = 0;

  let ventasMes = 0;
  let pedidosMes = 0;

  let ingresosTotales = 0;
  let gananciasTotales = 0;
  let totalPedidos = ventas.length;

  const ventasPorProducto = {};

  ventas.forEach(v => {
    const total = Number(v.total) || 0;
    const ganancia = Number(v.ganancia) || (total * 0.55); // Margen estimado 55% si no tiene costo explícito
    const fechaV = new Date(v.timestamp || v.fecha);

    ingresosTotales += total;
    gananciasTotales += ganancia;

    // Métricas de HOY
    if (v.fecha === hoyStr || (fechaV.toDateString() === ahora.toDateString())) {
      ventasHoy += total;
      pedidosHoy++;
    }

    // Métricas de la SEMANA (últimos 7 días)
    if (fechaV >= sieteDiasAtras) {
      ventasSemana += total;
      pedidosSemana++;
    }

    // Métricas del MES
    if (fechaV.getMonth() === mesActual && fechaV.getFullYear() === anioActual) {
      ventasMes += total;
      pedidosMes++;
    }

    // Conteo para productos más vendidos
    if (Array.isArray(v.items)) {
      v.items.forEach(it => {
        const nombre = it.nombre || "Producto";
        const cant = Number(it.cantidad) || 1;
        const subtotal = (Number(it.precio) || 0) * cant;

        if (!ventasPorProducto[nombre]) {
          ventasPorProducto[nombre] = {
            nombre,
            cantidadVendida: 0,
            ingresos: 0
          };
        }
        ventasPorProducto[nombre].cantidadVendida += cant;
        ventasPorProducto[nombre].ingresos += subtotal;
      });
    }
  });

  // Ranking ordenado de productos más vendidos
  const rankingProductos = Object.values(ventasPorProducto)
    .sort((a, b) => b.cantidadVendida - a.cantidadVendida);

  return {
    ventasHoy,
    pedidosHoy,
    ventasSemana,
    pedidosSemana,
    ventasMes,
    pedidosMes,
    ingresosTotales,
    gananciasTotales,
    totalPedidos,
    rankingProductos,
    ventasRecientes: ventas.slice(0, 10)
  };
}

// ============================================================
// 3. GESTIÓN DE RESERVAS DE HOY
// ============================================================

export async function obtenerReservasDeHoy() {
  const ahora = new Date();
  const hoyStr = ahora.toISOString().split("T")[0];
  let todasReservas = [];

  // 1. Intentar consultar en Firestore
  try {
    const q = query(collection(db, "reservas"));
    const snapshot = await getDocs(q);
    snapshot.forEach(docSnap => {
      todasReservas.push({ id: docSnap.id, ...docSnap.data() });
    });
  } catch (error) {
    console.warn("No se pudo cargar reservas de Firestore:", error);
  }

  // 2. Revisar reservas en localStorage de clientes
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("freechair_reservas_")) {
        const data = JSON.parse(localStorage.getItem(key) || "[]");
        if (Array.isArray(data)) {
          todasReservas.push(...data);
        }
      }
    }
  } catch (_) {}

  // Eliminar posibles duplicados por ID
  const mapa = new Map();
  todasReservas.forEach(r => mapa.set(r.id, r));
  todasReservas = Array.from(mapa.values());

  // Si no hay reservas para hoy en el sistema, generamos una muestra realista de hoy
  const reservasHoy = todasReservas.filter(r => r.fecha === hoyStr);

  if (reservasHoy.length > 0) {
    reservasHoy.sort((a, b) => (a.hora || "").localeCompare(b.hora || ""));
    return reservasHoy;
  }

  // Reservas de ejemplo para hoy para enriquecer el panel
  const reservasMuestraHoy = [
    {
      id: "res-hoy-1",
      userNombre: "Valentina Gómez",
      userEmail: "valentina.gomez@gmail.com",
      mesa: "Mesa 3 (Terraza Libre)",
      zona: "Terraza",
      fecha: hoyStr,
      hora: "13:30",
      personas: 4,
      ocasion: "Almuerzo Ejecutivo",
      estado: "Confirmada"
    },
    {
      id: "res-hoy-2",
      userNombre: "Santiago Herrera",
      userEmail: "santi.herrera@hotmail.com",
      mesa: "Mesa 4 (Zona VIP)",
      zona: "VIP",
      fecha: hoyStr,
      hora: "19:00",
      personas: 6,
      ocasion: "Aniversario",
      estado: "Confirmada"
    },
    {
      id: "res-hoy-3",
      userNombre: "Catalina Morales",
      userEmail: "catamorales@gmail.com",
      mesa: "Mesa 1 (Ventana)",
      zona: "Salón Principal",
      fecha: hoyStr,
      hora: "20:30",
      personas: 2,
      ocasion: "Cena Romántica",
      estado: "Confirmada"
    }
  ];

  return reservasMuestraHoy;
}

/**
 * Actualizar estado de una reserva desde el panel de administración
 */
export async function actualizarEstadoReserva(reservaId, nuevoEstado) {
  try {
    const docRef = doc(db, "reservas", reservaId);
    await updateDoc(docRef, { estado: nuevoEstado });
  } catch (_) {}

  // Actualizar también en localStorage si corresponde
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith("freechair_reservas_")) {
      try {
        let lista = JSON.parse(localStorage.getItem(key) || "[]");
        let modificado = false;
        lista = lista.map(r => {
          if (r.id === reservaId) {
            modificado = true;
            return { ...r, estado: nuevoEstado };
          }
          return r;
        });
        if (modificado) localStorage.setItem(key, JSON.stringify(lista));
      } catch (_) {}
    }
  }

  return { success: true };
}

// ============================================================
// 4. GESTIÓN DE INVENTARIO Y ALERTAS DE STOCK BAJO
// ============================================================

export async function obtenerInventario() {
  let inventario = [];

  // 1. Intentar Firestore
  try {
    const snapshot = await getDocs(collection(db, "inventario"));
    if (!snapshot.empty) {
      snapshot.forEach(docSnap => {
        inventario.push({ id: docSnap.id, ...docSnap.data() });
      });
      localStorage.setItem("freechair_admin_inventario", JSON.stringify(inventario));
      return inventario;
    }
  } catch (error) {
    console.warn("Cargando inventario desde local:", error);
  }

  // 2. Respaldo Local
  try {
    const guardado = localStorage.getItem("freechair_admin_inventario");
    if (guardado) {
      inventario = JSON.parse(guardado);
      if (inventario && inventario.length > 0) return inventario;
    }
  } catch (_) {}

  // 3. Semilla Inicial
  inventario = INVENTARIO_INICIAL;
  localStorage.setItem("freechair_admin_inventario", JSON.stringify(inventario));
  return inventario;
}

/**
 * Reabastecer unidades a un producto de inventario (+10 o cantidad deseada)
 */
export async function reabastecerInventario(itemId, cantidadAumentar = 10) {
  const inventario = await obtenerInventario();
  let itemModificado = null;

  const nuevoInventario = inventario.map(it => {
    if (it.id === itemId) {
      const nuevoStock = Number(it.stock || 0) + Number(cantidadAumentar);
      itemModificado = { ...it, stock: nuevoStock };
      return itemModificado;
    }
    return it;
  });

  localStorage.setItem("freechair_admin_inventario", JSON.stringify(nuevoInventario));

  // Actualizar en Firestore si es posible
  try {
    const docRef = doc(db, "inventario", itemId);
    await updateDoc(docRef, { stock: itemModificado.stock });
  } catch (_) {}

  return { success: true, item: itemModificado };
}

/**
 * Descuenta stock cuando se realiza una venta
 */
async function descontarStockPorVenta(nombreProducto, cantidadVendida = 1) {
  const inventario = await obtenerInventario();
  const nuevoInventario = inventario.map(it => {
    if (it.nombre.toLowerCase().trim() === nombreProducto.toLowerCase().trim()) {
      const nuevoStock = Math.max(0, Number(it.stock || 0) - Number(cantidadVendida));
      return { ...it, stock: nuevoStock };
    }
    return it;
  });
  localStorage.setItem("freechair_admin_inventario", JSON.stringify(nuevoInventario));
}
