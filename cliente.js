// cliente.js - Controlador del Portal de Cliente y Sistema de Reservaciones FreeChair
import { obtenerUsuarioActual, cerrarSesion, ROLES } from "./auth.js";
import { db } from "./conection.js";
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  doc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

import {
  obtenerCapacidadRestaurante,
  obtenerMenu,
  obtenerTrabajadores,
  enviarCalificacion,
  enviarPropina,
  formatearMoneda
} from "./restaurant-service.js";

let currentAuth = null;
let misReservas = [];
let listaMenuCliente = [];
let categoriaClienteSeleccionada = "todos";
let listaTrabajadoresCliente = [];

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", inicializarPortalCliente);
} else {
  inicializarPortalCliente();
}

/**
 * Inicializar portal de cliente y verificar sesión
 */
async function inicializarPortalCliente() {
  const loading = document.getElementById("cliente-loading");
  const content = document.getElementById("cliente-content");

  try {
    const userAuth = await obtenerUsuarioActual();

    if (!userAuth || !userAuth.user) {
      window.location.href = "login.html";
      return;
    }

    currentAuth = userAuth;

    // Mostrar contenido principal
    if (loading) loading.style.display = "none";
    if (content) content.style.display = "block";

    // Cargar perfil en barra superior
    renderizarPerfil();

    // Establecer fecha mínima en el selector de fecha (hoy)
    establecerFechaMinima();

    // Cargar y mostrar reservaciones del cliente
    await cargarMisReservas();

    // Actualizar capacidad disponible en tiempo real
    await actualizarCapacidadCliente();

    // Cargar menú gastronómico
    await cargarMenuCliente();

    // Cargar trabajadores para calificación y propinas
    await cargarTrabajadoresCliente();

    // Configurar eventos generales y de calificaciones/propinas
    configurarEventos();
    configurarEventosCalificacionYPropinas();

  } catch (error) {
    console.error("Error al inicializar portal de cliente:", error);
    if (loading) loading.textContent = "Error al cargar tu sesión. Por favor recarga la página.";
  }
}

/**
 * Renderiza la barra superior del cliente
 */
function renderizarPerfil() {
  const nombre = currentAuth.userData?.nombre || currentAuth.user.displayName || "Cliente FreeChair";
  const email = currentAuth.user.email || "";

  const elNombre = document.getElementById("cliente-user-name");
  const elEmail = document.getElementById("cliente-user-email");
  const elAvatar = document.getElementById("cliente-user-avatar");

  if (elNombre) elNombre.textContent = nombre;
  if (elEmail) elEmail.textContent = email;
  if (elAvatar) elAvatar.textContent = nombre.charAt(0).toUpperCase();
}

/**
 * Configurar que la fecha mínima para reservar sea hoy
 */
function establecerFechaMinima() {
  const inputFecha = document.getElementById("reserva-fecha");
  if (inputFecha) {
    const hoy = new Date().toISOString().split("T")[0];
    inputFecha.min = hoy;
    inputFecha.value = hoy;
  }
}

/**
 * Cargar reservaciones del cliente desde Firestore con respaldo en localStorage
 */
async function cargarMisReservas() {
  const contenedor = document.getElementById("lista-reservas");
  if (!contenedor) return;

  contenedor.innerHTML = `<p style="text-align: center; color: #888; padding: 20px;">Cargando tus reservaciones...</p>`;

  const userId = currentAuth.user.uid;
  let reservasCargadas = [];

  // 1. Intentar consultar Firestore
  try {
    const q = query(collection(db, "reservas"), where("userId", "==", userId));
    const querySnapshot = await getDocs(q);

    querySnapshot.forEach((docSnap) => {
      reservasCargadas.push({ id: docSnap.id, ...docSnap.data() });
    });

    // Guardar copia local en caso de que Firestore quede offline
    localStorage.setItem(`freechair_reservas_${userId}`, JSON.stringify(reservasCargadas));
  } catch (firestoreError) {
    console.warn("No se pudo conectar a Firestore para reservas, usando almacenamiento local:", firestoreError);
    // Recuperar respaldo local si existe
    try {
      const guardadas = localStorage.getItem(`freechair_reservas_${userId}`);
      if (guardadas) reservasCargadas = JSON.parse(guardadas);
    } catch (_) {}
  }

  misReservas = reservasCargadas;
  renderizarTarjetasReservas(misReservas);
  actualizarContadorReservas(misReservas);
}

/**
 * Actualizar contador de reservas activas
 */
function actualizarContadorReservas(reservas) {
  const elCount = document.getElementById("contador-reservas-activas");
  if (elCount) {
    const activas = reservas.filter(r => r.estado !== "Cancelada").length;
    elCount.textContent = activas;
  }
}

/**
 * Renderiza las tarjetas de reservaciones
 */
function renderizarTarjetasReservas(reservas) {
  const contenedor = document.getElementById("lista-reservas");
  if (!contenedor) return;

  if (reservas.length === 0) {
    contenedor.innerHTML = `
      <div class="empty-reservas-box">
        <span style="font-size: 38px;">🍽️</span>
        <h3>Aún no tienes reservaciones activas</h3>
        <p>Selecciona tu restaurante o zona preferida arriba y completa el formulario para asegurar tu mesa en segundos.</p>
      </div>
    `;
    return;
  }

  contenedor.innerHTML = "";

  // Ordenar de más reciente a más antigua
  reservas.sort((a, b) => new Date(b.fechaCreacion || 0) - new Date(a.fechaCreacion || 0));

  reservas.forEach((res) => {
    const card = document.createElement("div");
    card.className = "reserva-card";

    const esCancelada = res.estado === "Cancelada";
    const badgeClass = esCancelada ? "badge-reserva-cancelada" : "badge-reserva-confirmada";

    card.innerHTML = `
      <div class="reserva-card-header">
        <div>
          <span class="reserva-codigo">#${res.codigo || res.id.substring(0, 6).toUpperCase()}</span>
          <h4 style="margin: 4px 0 0; color: #2b1122; font-size: 16px;">${res.zona || "Salón Principal"}</h4>
        </div>
        <span class="reserva-badge ${badgeClass}">${(res.estado || "Confirmada").toUpperCase()}</span>
      </div>

      <div class="reserva-details">
        <p><strong>🪑 Mesa:</strong> ${res.mesa || "Mesa asignada"}</p>
        <p><strong>📅 Fecha:</strong> ${res.fecha || "Hoy"}</p>
        <p><strong>⏰ Hora:</strong> ${res.hora || "7:00 PM"}</p>
        <p><strong>👥 Comensales:</strong> ${res.personas || 2} personas</p>
        ${res.ocasion && res.ocasion !== "ninguna" ? `<p><strong>🎉 Ocasión:</strong> ${res.ocasion}</p>` : ""}
        ${res.notas ? `<p><strong>📝 Notas:</strong> ${res.notas}</p>` : ""}
      </div>

      <div class="reserva-actions">
        ${!esCancelada ? `
          <button class="btn-cancelar-reserva" data-id="${res.id}">
            ❌ Cancelar Reservación
          </button>
        ` : `
          <span style="font-size: 12px; color: #999; font-style: italic;">Esta reservación fue cancelada</span>
        `}
      </div>
    `;

    contenedor.appendChild(card);
  });

  // Escuchar eventos de cancelación
  contenedor.querySelectorAll(".btn-cancelar-reserva").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id");
      cancelarReserva(id);
    });
  });
}

/**
 * Cancelar una reservación
 */
async function cancelarReserva(reservaId) {
  const confirmacion = confirm("¿Estás seguro de cancelar esta reservación?");
  if (!confirmacion) return;

  const userId = currentAuth.user.uid;

  // Actualizar en Firestore
  try {
    const reservaRef = doc(db, "reservas", reservaId);
    await updateDoc(reservaRef, { estado: "Cancelada" });
  } catch (err) {
    console.warn("No se pudo actualizar en Firestore, actualizando localmente:", err);
  }

  // Actualizar en lista local
  misReservas = misReservas.map(r => r.id === reservaId ? { ...r, estado: "Cancelada" } : r);
  try {
    localStorage.setItem(`freechair_reservas_${userId}`, JSON.stringify(misReservas));
  } catch (_) {}

  renderizarTarjetasReservas(misReservas);
  actualizarContadorReservas(misReservas);
  mostrarToast("Tu reservación ha sido cancelada correctamente.", "info");
}

/**
 * Configurar los eventos del formulario y botones
 */
function configurarEventos() {
  // Cerrar sesión
  const btnLogout = document.getElementById("btn-cliente-logout");
  if (btnLogout) {
    btnLogout.addEventListener("click", () => {
      cerrarSesion();
    });
  }

  // Enviar Formulario de Reserva
  const formReserva = document.getElementById("form-reservar");
  if (formReserva) {
    formReserva.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btnSubmit = formReserva.querySelector("button[type='submit']");

      const zona = document.getElementById("reserva-zona").value;
      const mesa = document.getElementById("reserva-mesa").value;
      const fecha = document.getElementById("reserva-fecha").value;
      const hora = document.getElementById("reserva-hora").value;
      const personas = document.getElementById("reserva-personas").value;
      const ocasion = document.getElementById("reserva-ocasion").value;
      const notas = document.getElementById("reserva-notas").value.trim();

      if (!fecha || !hora) {
        mostrarToast("Por favor completa la fecha y la hora de tu reserva.", "error");
        return;
      }

      if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.textContent = "Confirmando tu reserva...";
      }

      // Generar código aleatorio amigable
      const codigoAleatorio = "FC-" + Math.floor(1000 + Math.random() * 9000);
      const nuevaReserva = {
        codigo: codigoAleatorio,
        userId: currentAuth.user.uid,
        userNombre: currentAuth.userData?.nombre || currentAuth.user.displayName || "Cliente",
        userEmail: currentAuth.user.email,
        zona,
        mesa,
        fecha,
        hora,
        personas: parseInt(personas) || 2,
        ocasion,
        notas,
        estado: "Confirmada",
        fechaCreacion: new Date().toISOString()
      };

      let guardadoEnNube = false;

      // Intentar guardar en Firestore
      try {
        const docRef = await addDoc(collection(db, "reservas"), nuevaReserva);
        nuevaReserva.id = docRef.id;
        guardadoEnNube = true;
      } catch (err) {
        console.warn("Aviso: No se pudo guardar en Firestore, guardando localmente:", err);
        nuevaReserva.id = "local-" + Date.now();
      }

      // Guardar en copia local
      misReservas.unshift(nuevaReserva);
      try {
        localStorage.setItem(`freechair_reservas_${currentAuth.user.uid}`, JSON.stringify(misReservas));
      } catch (_) {}

      if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.textContent = "🍽️ Confirmar Reservación";
      }

      formReserva.reset();
      establecerFechaMinima();

      renderizarTarjetasReservas(misReservas);
      actualizarContadorReservas(misReservas);

      mostrarToast(`¡Reservación ${codigoAleatorio} confirmada con éxito!`, "exito");

      // Desplazar la vista a la sección de mis reservas
      const misReservasSec = document.getElementById("seccion-mis-reservas");
      if (misReservasSec) {
        misReservasSec.scrollIntoView({ behavior: "smooth" });
      }
    });
  }

  // Botones de acceso rápido "Reservar aquí" en las tarjetas de restaurantes
  document.querySelectorAll(".btn-seleccionar-zona").forEach(btn => {
    btn.addEventListener("click", () => {
      const zona = btn.getAttribute("data-zona");
      const selectZona = document.getElementById("reserva-zona");
      if (selectZona && zona) {
        selectZona.value = zona;
      }
      const form = document.getElementById("seccion-formulario");
      if (form) {
        form.scrollIntoView({ behavior: "smooth" });
      }
      mostrarToast(`Zona seleccionada: ${zona}`, "info");
    });
  });
}

// ============================================================
// 1. CAPACIDAD EN VIVO PARA EL CLIENTE
// ============================================================

async function actualizarCapacidadCliente() {
  const badgeAforo = document.getElementById("cliente-aforo-disponible");
  if (!badgeAforo) return;

  try {
    const total = await obtenerCapacidadRestaurante();

    // Contar ocupación según mesas en local
    let ocupados = 0;
    try {
      const mesas = JSON.parse(localStorage.getItem("freechair_admin_mesas") || "[]");
      ocupados = mesas.reduce((sum, m) => {
        if (m.estado === "ocupada" || m.estado === "reservada") {
          return sum + (Number(m.capacidad) || 2);
        }
        return sum;
      }, 0);
    } catch (_) {}

    const disponibles = Math.max(0, total - ocupados);
    badgeAforo.textContent = `${disponibles} / ${total}`;
  } catch (e) {
    console.warn("Error al calcular aforo en cliente:", e);
  }
}

// ============================================================
// 2. MENÚ GASTRONÓMICO DEL CLIENTE
// ============================================================

async function cargarMenuCliente() {
  const contenedor = document.getElementById("cliente-menu-grid");
  if (contenedor) {
    contenedor.innerHTML = `<div style="grid-column: 1/-1; text-align:center; color:#888; padding:20px;">Cargando menú delicioso...</div>`;
  }

  try {
    listaMenuCliente = await obtenerMenu();
    renderizarMenuCliente(filtrarMenuCliente(listaMenuCliente, categoriaClienteSeleccionada));
  } catch (err) {
    console.error("Error al cargar menú en cliente:", err);
    if (contenedor) {
      contenedor.innerHTML = `<div style="grid-column: 1/-1; text-align:center; color:#c92a2a; padding:20px;">No se pudo cargar el menú gastronómico.</div>`;
    }
  }

  // Filtros de categoría en cliente
  const botonesCat = document.querySelectorAll("#cliente-menu-categories .btn-cat-filter");
  botonesCat.forEach(btn => {
    btn.addEventListener("click", () => {
      botonesCat.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      categoriaClienteSeleccionada = btn.getAttribute("data-cat");
      renderizarMenuCliente(filtrarMenuCliente(listaMenuCliente, categoriaClienteSeleccionada));
    });
  });
}

function filtrarMenuCliente(items, cat) {
  if (!cat || cat === "todos") return items;
  return items.filter(it => (it.categoria || "").toLowerCase() === cat.toLowerCase());
}

function renderizarMenuCliente(items) {
  const grid = document.getElementById("cliente-menu-grid");
  if (!grid) return;

  if (items.length === 0) {
    grid.innerHTML = `<div style="grid-column: 1/-1; text-align:center; color:#777; padding:20px;">No hay productos disponibles en esta categoría actualmente.</div>`;
    return;
  }

  grid.innerHTML = "";

  const iconosCat = {
    "Platos Fuertes": "🍔",
    "Entradas": "🥗",
    "Bebidas": "🍹",
    "Cocteles": "🍸",
    "Postres": "🍰"
  };

  items.forEach(plato => {
    const card = document.createElement("div");
    card.className = "menu-client-card";

    const disponible = plato.disponible !== false;
    const icono = iconosCat[plato.categoria] || "🍽️";

    card.innerHTML = `
      <div class="menu-card-top">
        <h4 class="menu-card-title">${icono} ${plato.nombre}</h4>
        <span class="menu-card-price">${formatearMoneda(plato.precio)}</span>
      </div>
      <p class="menu-card-desc">${plato.descripcion || "Preparación fresca de nuestra cocina de autor con ingredientes de primera calidad."}</p>
      <div class="menu-card-footer">
        <span class="tag" style="background:#fdf5f8; color:#da345d;">${plato.categoria || "Especial"}</span>
        <span class="${disponible ? 'badge-reserva-confirmada' : 'badge-reserva-cancelada'}" style="font-size:11px; padding:3px 8px; border-radius:6px;">
          ${disponible ? "Disponible" : "Agotado hoy"}
        </span>
      </div>
    `;

    grid.appendChild(card);
  });
}

// ============================================================
// 3. CALIFICACIONES Y PROPINAS A TRABAJADORES
// ============================================================

async function cargarTrabajadoresCliente() {
  const select = document.getElementById("calif-trabajador");
  if (!select) return;

  try {
    listaTrabajadoresCliente = await obtenerTrabajadores();
    select.innerHTML = `<option value="" disabled selected>-- Elige a la persona que te atendió --</option>`;

    listaTrabajadoresCliente.forEach(t => {
      const opt = document.createElement("option");
      opt.value = t.id;
      opt.textContent = `👤 ${t.nombre}`;
      select.appendChild(opt);
    });
  } catch (err) {
    console.error("Error al cargar trabajadores:", err);
  }
}

function configurarEventosCalificacionYPropinas() {
  // Selector de estrellas
  const starContainer = document.getElementById("rating-stars-picker");
  const hiddenEstrellas = document.getElementById("calif-estrellas");

  if (starContainer && hiddenEstrellas) {
    const stars = starContainer.querySelectorAll(".rating-star");
    stars.forEach(star => {
      star.addEventListener("click", () => {
        const val = Number(star.getAttribute("data-val")) || 5;
        hiddenEstrellas.value = val;

        stars.forEach(s => {
          const sVal = Number(s.getAttribute("data-val"));
          if (sVal <= val) {
            s.classList.add("selected");
          } else {
            s.classList.remove("selected");
          }
        });
      });
    });
  }

  // Botones de presets de propina
  const tipButtons = document.querySelectorAll(".btn-tip-preset");
  const tipInput = document.getElementById("propina-monto");

  tipButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      tipButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const monto = btn.getAttribute("data-monto");
      if (tipInput) {
        tipInput.value = monto;
      }
    });
  });

  if (tipInput) {
    tipInput.addEventListener("input", () => {
      tipButtons.forEach(b => b.classList.remove("active"));
    });
  }

  // Manejo del envío del formulario de Calificación y Propina
  const formCalif = document.getElementById("form-calificar-propina");
  if (formCalif) {
    formCalif.addEventListener("submit", async (e) => {
      e.preventDefault();

      const trabajadorId = document.getElementById("calif-trabajador")?.value;
      if (!trabajadorId) {
        mostrarToast("Por favor selecciona al trabajador que deseas calificar.", "error");
        return;
      }

      const trabajadorObj = listaTrabajadoresCliente.find(t => t.id === trabajadorId);
      const trabajadorNombre = trabajadorObj ? trabajadorObj.nombre : "Trabajador";

      const estrellas = Number(document.getElementById("calif-estrellas")?.value) || 5;
      const comentario = document.getElementById("calif-comentario")?.value.trim();
      const montoPropina = Number(document.getElementById("propina-monto")?.value) || 0;
      const mensajePropina = document.getElementById("propina-mensaje")?.value.trim();

      const btnSubmit = document.getElementById("btn-submit-calif-propina");
      if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.textContent = "Registrando tu reconocimiento...";
      }

      const clienteNombre = currentAuth?.userData?.nombre || currentAuth?.user?.displayName || "Cliente Agradecido";
      const clienteId = currentAuth?.user?.uid || "cliente-anon";

      try {
        // 1. Guardar calificación
        await enviarCalificacion({
          trabajadorId,
          trabajadorNombre,
          clienteId,
          clienteNombre,
          estrellas,
          comentario
        });

        // 2. Guardar propina si el monto es mayor a 0
        if (montoPropina > 0) {
          await enviarPropina({
            trabajadorId,
            trabajadorNombre,
            clienteId,
            clienteNombre,
            monto: montoPropina,
            mensaje: mensajePropina
          });
        }

        const mensajeExito = montoPropina > 0
          ? `¡Muchas gracias! Has calificado a ${trabajadorNombre} con ${estrellas}★ y le has enviado ${formatearMoneda(montoPropina)} de propina.`
          : `¡Muchas gracias! Has calificado el servicio de ${trabajadorNombre} con ${estrellas} estrellas.`;

        mostrarToast(mensajeExito, "exito");

        // Resetear formulario
        formCalif.reset();
        if (document.getElementById("calif-estrellas")) {
          document.getElementById("calif-estrellas").value = 5;
        }
        document.querySelectorAll("#rating-stars-picker .rating-star").forEach(s => s.classList.add("selected"));
        document.querySelectorAll(".btn-tip-preset").forEach(b => b.classList.remove("active"));
        const btnDefault = document.querySelector(".btn-tip-preset[data-monto='5000']");
        if (btnDefault) btnDefault.classList.add("active");
        if (document.getElementById("propina-monto")) {
          document.getElementById("propina-monto").value = 5000;
        }

      } catch (err) {
        console.error("Error al registrar calificación y propina:", err);
        mostrarToast("Ocurrió un error al procesar tu calificación.", "error");
      } finally {
        if (btnSubmit) {
          btnSubmit.disabled = false;
          btnSubmit.textContent = "⭐ Enviar Calificación y Propina";
        }
      }
    });
  }
}

/**
 * Toast flotante para avisos dinámicos
 */
export function mostrarToast(mensaje, tipo = "exito") {
  let toast = document.getElementById("cliente-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "cliente-toast";
    toast.className = "cliente-toast";
    document.body.appendChild(toast);
  }

  toast.textContent = mensaje;
  toast.className = `cliente-toast toast-${tipo} toast-show`;

  setTimeout(() => {
    toast.classList.remove("toast-show");
  }, 3500);
}
