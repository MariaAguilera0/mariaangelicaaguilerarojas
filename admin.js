// admin.js - Módulo de Control y Lógica del Panel de Administración FreeChair
import {
  obtenerUsuarioActual,
  cerrarSesion,
  obtenerTodosLosUsuarios,
  cambiarRolUsuario,
  eliminarUsuario,
  registrarUsuario,
  ROLES
} from "./auth.js";

// Estado global de la vista de administración
let currentUser = null;
let listaUsuariosGlobal = [];

// Lista predeterminada de mesas del restaurante FreeChair
const MESAS_INICIALES = [
  { id: "mesa-1", numero: 1, ubicacion: "Ventana Panorámica", capacidad: 4, estado: "disponible" },
  { id: "mesa-2", numero: 2, ubicacion: "Centro Principal", capacidad: 2, estado: "ocupada" },
  { id: "mesa-3", numero: 3, ubicacion: "Terraza Libre", capacidad: 6, estado: "reservada" },
  { id: "mesa-4", numero: 4, ubicacion: "Zona VIP Exclusiva", capacidad: 8, estado: "disponible" },
  { id: "mesa-5", numero: 5, ubicacion: "Familiar Jardín", capacidad: 5, estado: "disponible" },
  { id: "mesa-6", numero: 6, ubicacion: "Barra Lounge", capacidad: 2, estado: "disponible" }
];

document.addEventListener("DOMContentLoaded", () => {
  inicializarAdmin();
});

/**
 * Inicialización y verificación de permisos de administrador
 */
async function inicializarAdmin() {
  const loading = document.getElementById("admin-loading");
  const content = document.getElementById("admin-content");

  try {
    const userAuth = await obtenerUsuarioActual();

    // Validar autenticación
    if (!userAuth || !userAuth.user) {
      window.location.href = "login.html";
      return;
    }

    const rol = userAuth.rol || ROLES.CLIENTE;

    // Proteger ruta: sólo administrador y superadmin tienen acceso
    if (rol !== ROLES.SUPERADMIN && rol !== ROLES.ADMINISTRADOR) {
      alert("Acceso denegado: Esta sección es exclusiva para Administradores y Superadmins.");
      window.location.href = "index.html";
      return;
    }

    currentUser = userAuth;

    // Mostrar el contenedor principal
    if (loading) loading.style.display = "none";
    if (content) content.style.display = "block";

    // Cargar perfil en la barra superior
    renderizarPerfilUsuario();

    // Cargar estadísticas y tabla de usuarios
    await cargarUsuarios();

    // Inicializar gestión de mesas
    inicializarMesas();

    // Configurar escuchadores de eventos
    configurarEventos();

  } catch (err) {
    console.error("Error al inicializar panel admin:", err);
    mostrarToast("Error de conexión al cargar datos administrativos.", "error");
  }
}

/**
 * Renderiza los datos del usuario en la barra superior
 */
function renderizarPerfilUsuario() {
  const nombre = currentUser.userData.nombre || currentUser.user.displayName || "Administrador";
  const email = currentUser.user.email || "";
  const rol = currentUser.rol || ROLES.ADMINISTRADOR;

  const elNombre = document.getElementById("admin-user-name");
  const elEmail = document.getElementById("admin-user-email");
  const elBadge = document.getElementById("admin-user-badge");
  const elAvatar = document.getElementById("admin-user-avatar");

  if (elNombre) elNombre.textContent = nombre;
  if (elEmail) elEmail.textContent = email;
  if (elAvatar) elAvatar.textContent = nombre.charAt(0).toUpperCase();

  if (elBadge) {
    elBadge.textContent = rol;
    elBadge.className = `role-badge badge-${rol}`;
  }
}

/**
 * Carga los usuarios registrados desde Firestore y actualiza estadísticas
 */
export async function cargarUsuarios() {
  const tbody = document.getElementById("admin-users-tbody");
  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #888; padding: 20px;">Cargando usuarios de Firestore...</td></tr>`;
  }

  try {
    const usuarios = await obtenerTodosLosUsuarios();
    listaUsuariosGlobal = usuarios;

    actualizarEstadisticas(usuarios);
    renderizarTablaUsuarios(usuarios);
  } catch (error) {
    console.error("Error al consultar usuarios:", error);
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #c92a2a; padding: 20px;">
        No se pudieron cargar los usuarios de Firestore. (Verifica si la base de datos está creada y activa).
      </td></tr>`;
    }
  }
}

/**
 * Actualiza los contadores del panel
 */
function actualizarEstadisticas(usuarios) {
  const total = usuarios.length;
  const admins = usuarios.filter(u => u.rol === ROLES.ADMINISTRADOR || u.rol === ROLES.SUPERADMIN).length;
  const trabajadores = usuarios.filter(u => u.rol === ROLES.TRABAJADOR).length;
  const clientes = usuarios.filter(u => u.rol === ROLES.CLIENTE || !u.rol).length;

  const elTotal = document.getElementById("admin-stat-total");
  const elAdmins = document.getElementById("admin-stat-admins");
  const elTrabajadores = document.getElementById("admin-stat-workers");
  const elClientes = document.getElementById("admin-stat-clients");

  if (elTotal) elTotal.textContent = total;
  if (elAdmins) elAdmins.textContent = admins;
  if (elTrabajadores) elTrabajadores.textContent = trabajadores;
  if (elClientes) elClientes.textContent = clientes;
}

/**
 * Renderiza los renglones de la tabla de usuarios
 */
function renderizarTablaUsuarios(usuarios) {
  const tbody = document.getElementById("admin-users-tbody");
  if (!tbody) return;

  if (usuarios.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #777; padding: 20px;">No se encontraron usuarios coincidentes.</td></tr>`;
    return;
  }

  tbody.innerHTML = "";
  const esSuperadmin = currentUser.rol === ROLES.SUPERADMIN;

  usuarios.forEach((u) => {
    const tr = document.createElement("tr");
    const rolActual = u.rol || ROLES.CLIENTE;
    const esElMismo = u.id === currentUser.user.uid;

    tr.innerHTML = `
      <td>
        <div style="font-weight: bold; color: #333;">${u.nombre || "Sin nombre"}</div>
        <small style="color: #999; font-size: 11px;">ID: ${u.id.substring(0, 10)}...</small>
      </td>
      <td>${u.email || "Sin correo"}</td>
      <td>
        <span class="role-badge badge-${rolActual}">${rolActual}</span>
      </td>
      <td>
        <select class="admin-role-select" id="role-select-${u.id}" ${(!esSuperadmin && (rolActual === ROLES.SUPERADMIN || rolActual === ROLES.ADMINISTRADOR)) ? "disabled" : ""}>
          ${esSuperadmin ? `<option value="superadmin" ${rolActual === "superadmin" ? "selected" : ""}>Superadmin</option>` : ""}
          <option value="administrador" ${rolActual === "administrador" ? "selected" : ""}>Administrador</option>
          <option value="trabajador" ${rolActual === "trabajador" ? "selected" : ""}>Trabajador</option>
          <option value="cliente" ${rolActual === "cliente" ? "selected" : ""}>Cliente</option>
        </select>
      </td>
      <td>
        <div style="display: flex; gap: 6px; align-items: center;">
          <button class="btn-table-action btn-save" title="Guardar Rol" data-action="save" data-uid="${u.id}">
            💾 Guardar
          </button>
          ${esSuperadmin && !esElMismo ? `
            <button class="btn-table-action btn-delete" title="Eliminar Usuario" data-action="delete" data-uid="${u.id}" data-name="${u.nombre || u.email}">
              🗑️
            </button>
          ` : ""}
        </div>
      </td>
    `;

    tbody.appendChild(tr);
  });

  // Delegar eventos de acciones de la tabla
  tbody.querySelectorAll("button[data-action='save']").forEach(btn => {
    btn.addEventListener("click", () => {
      const uid = btn.getAttribute("data-uid");
      guardarCambioRol(uid);
    });
  });

  tbody.querySelectorAll("button[data-action='delete']").forEach(btn => {
    btn.addEventListener("click", () => {
      const uid = btn.getAttribute("data-uid");
      const name = btn.getAttribute("data-name");
      ejecutarEliminarUsuario(uid, name);
    });
  });
}

/**
 * Guarda el rol modificado de un usuario
 */
async function guardarCambioRol(uid) {
  const select = document.getElementById(`role-select-${uid}`);
  if (!select) return;

  const nuevoRol = select.value;
  const confirmar = confirm(`¿Estás seguro de asignar el rol [${nuevoRol.toUpperCase()}] a este usuario?`);
  if (!confirmar) return;

  try {
    const res = await cambiarRolUsuario(uid, nuevoRol);
    if (res.success) {
      mostrarToast(`¡Rol actualizado exitosamente a ${nuevoRol.toUpperCase()}!`, "exito");
      await cargarUsuarios();
    } else {
      mostrarToast("Error al cambiar rol: " + res.error, "error");
    }
  } catch (e) {
    console.error("Error al guardar rol:", e);
    mostrarToast("No se pudo conectar para actualizar el rol.", "error");
  }
}

/**
 * Elimina un usuario de Firestore
 */
async function ejecutarEliminarUsuario(uid, nombre) {
  const confirmar = confirm(`¿Deseas eliminar permanentemente el registro de ${nombre}? Esta acción no se puede deshacer.`);
  if (!confirmar) return;

  try {
    const res = await eliminarUsuario(uid);
    if (res.success) {
      mostrarToast(`Usuario ${nombre} eliminado de la base de datos.`, "exito");
      await cargarUsuarios();
    } else {
      mostrarToast("Error al eliminar usuario: " + res.error, "error");
    }
  } catch (e) {
    console.error("Error al eliminar:", e);
    mostrarToast("Error al procesar la eliminación.", "error");
  }
}

/**
 * Configurar eventos del panel (Buscador, Modal, Logout, Refrescar)
 */
function configurarEventos() {
  // Filtro / Buscador en tiempo real
  const searchInput = document.getElementById("admin-search-users");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      const query = e.target.value.toLowerCase().trim();
      const filtrados = listaUsuariosGlobal.filter(u => {
        const nombre = (u.nombre || "").toLowerCase();
        const email = (u.email || "").toLowerCase();
        const rol = (u.rol || "").toLowerCase();
        return nombre.includes(query) || email.includes(query) || rol.includes(query);
      });
      renderizarTablaUsuarios(filtrados);
    });
  }

  // Botón refrescar
  const btnRefresh = document.getElementById("btn-refresh-users");
  if (btnRefresh) {
    btnRefresh.addEventListener("click", () => {
      cargarUsuarios();
      mostrarToast("Lista de usuarios actualizada.", "info");
    });
  }

  // Cerrar sesión
  const btnLogout = document.getElementById("btn-admin-logout");
  if (btnLogout) {
    btnLogout.addEventListener("click", () => {
      cerrarSesion();
    });
  }

  // Modal Crear Usuario
  const btnOpenModal = document.getElementById("btn-open-create-modal");
  const modal = document.getElementById("modal-create-user");
  const btnCloseModal = document.getElementById("btn-close-modal");
  const btnCancelModal = document.getElementById("btn-cancel-modal");
  const formCreate = document.getElementById("form-create-user");

  if (btnOpenModal && modal) {
    btnOpenModal.addEventListener("click", () => {
      modal.style.display = "flex";
      if (formCreate) formCreate.reset();
    });
  }

  const cerrarModal = () => {
    if (modal) modal.style.display = "none";
  };

  if (btnCloseModal) btnCloseModal.addEventListener("click", cerrarModal);
  if (btnCancelModal) btnCancelModal.addEventListener("click", cerrarModal);

  // Enviar formulario de creación de usuario
  if (formCreate) {
    formCreate.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btnSubmit = formCreate.querySelector("button[type='submit']");

      const nombre = document.getElementById("new-user-name").value.trim();
      const email = document.getElementById("new-user-email").value.trim();
      const password = document.getElementById("new-user-password").value;
      const rol = document.getElementById("new-user-role").value;

      if (!nombre || !email || !password) {
        mostrarToast("Todos los campos son obligatorios.", "error");
        return;
      }

      if (password.length < 6) {
        mostrarToast("La contraseña debe tener mínimo 6 caracteres.", "error");
        return;
      }

      if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.textContent = "Creando...";
      }

      try {
        const res = await registrarUsuario(nombre, email, password, rol);

        if (btnSubmit) {
          btnSubmit.disabled = false;
          btnSubmit.textContent = "Crear Usuario";
        }

        if (res.success) {
          mostrarToast(`¡Usuario ${nombre} creado con rol [${rol.toUpperCase()}]!`, "exito");
          cerrarModal();
          await cargarUsuarios();
        } else {
          mostrarToast(res.error || "No se pudo registrar el usuario.", "error");
        }
      } catch (err) {
        console.error("Error al registrar:", err);
        if (btnSubmit) {
          btnSubmit.disabled = false;
          btnSubmit.textContent = "Crear Usuario";
        }
        mostrarToast("Ocurrió un error inesperado al crear el usuario.", "error");
      }
    });
  }
}

/**
 * Gestión de mesas del restaurante
 */
function inicializarMesas() {
  const grid = document.getElementById("admin-tables-grid");
  if (!grid) return;

  // Recuperar estados persistidos en localStorage si existen
  let mesas = MESAS_INICIALES;
  try {
    const guardadas = localStorage.getItem("freechair_admin_mesas");
    if (guardadas) {
      mesas = JSON.parse(guardadas);
    }
  } catch (_) {}

  renderizarMesas(mesas);
}

function renderizarMesas(mesas) {
  const grid = document.getElementById("admin-tables-grid");
  if (!grid) return;

  grid.innerHTML = "";

  mesas.forEach(mesa => {
    const card = document.createElement("div");
    card.className = `table-card table-status-${mesa.estado}`;

    card.innerHTML = `
      <div class="table-header">
        <h4>Mesa ${mesa.numero}</h4>
        <span class="table-badge badge-${mesa.estado}">${mesa.estado.toUpperCase()}</span>
      </div>
      <p class="table-info">📍 ${mesa.ubicacion}</p>
      <p class="table-info">👥 Capacidad: <strong>${mesa.capacidad} personas</strong></p>
      <div class="table-actions">
        <label>Cambiar Estado:</label>
        <select class="table-state-select" data-mesa-id="${mesa.id}">
          <option value="disponible" ${mesa.estado === "disponible" ? "selected" : ""}>Disponible</option>
          <option value="ocupada" ${mesa.estado === "ocupada" ? "selected" : ""}>Ocupada</option>
          <option value="reservada" ${mesa.estado === "reservada" ? "selected" : ""}>Reservada</option>
        </select>
      </div>
    `;

    grid.appendChild(card);
  });

  // Escuchar cambios de estado en las mesas
  grid.querySelectorAll(".table-state-select").forEach(sel => {
    sel.addEventListener("change", (e) => {
      const mesaId = e.target.getAttribute("data-mesa-id");
      const nuevoEstado = e.target.value;
      cambiarEstadoMesa(mesaId, nuevoEstado);
    });
  });
}

function cambiarEstadoMesa(mesaId, nuevoEstado) {
  let mesas = MESAS_INICIALES;
  try {
    const guardadas = localStorage.getItem("freechair_admin_mesas");
    if (guardadas) mesas = JSON.parse(guardadas);
  } catch (_) {}

  mesas = mesas.map(m => m.id === mesaId ? { ...m, estado: nuevoEstado } : m);

  try {
    localStorage.setItem("freechair_admin_mesas", JSON.stringify(mesas));
  } catch (_) {}

  renderizarMesas(mesas);
  mostrarToast(`Estado de ${mesaId.toUpperCase()} actualizado a [${nuevoEstado.toUpperCase()}]`, "exito");
}

/**
 * Componente Toast para alertas dinámicas en la vista administrativa
 */
export function mostrarToast(mensaje, tipo = "exito") {
  let toast = document.getElementById("admin-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "admin-toast";
    toast.className = "admin-toast";
    document.body.appendChild(toast);
  }

  toast.textContent = mensaje;
  toast.className = `admin-toast toast-${tipo} toast-show`;

  setTimeout(() => {
    toast.classList.remove("toast-show");
  }, 3500);
}
