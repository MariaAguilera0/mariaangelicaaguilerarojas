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

let currentAuth = null;
let misReservas = [];

document.addEventListener("DOMContentLoaded", () => {
  inicializarPortalCliente();
});

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

    // Configurar eventos
    configurarEventos();

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
