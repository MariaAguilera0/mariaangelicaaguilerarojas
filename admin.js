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

import {
  obtenerCapacidadRestaurante,
  guardarCapacidadRestaurante,
  obtenerMenu,
  crearItemMenu,
  actualizarItemMenu,
  eliminarItemMenu,
  formatearMoneda
} from "./restaurant-service.js";

import {
  obtenerTodasLasVentas,
  registrarNuevaVenta,
  calcularMetricasComerciales,
  obtenerReservasDeHoy,
  actualizarEstadoReserva,
  obtenerInventario,
  reabastecerInventario
} from "./sales-service.js";

// Estado global de la vista de administración
let currentUser = null;
let listaUsuariosGlobal = [];
let listaMenuGlobal = [];
let capacidadTotalRestaurante = 50;
let categoriaMenuSeleccionada = "todos";

// Estado comercial y operativo
let metricasComercialesGlobal = null;
let listaVentasGlobal = [];
let listaReservasHoyGlobal = [];
let listaInventarioGlobal = [];
let periodoVentasSeleccionado = "hoy";

// Lista predeterminada de mesas del restaurante FreeChair
const MESAS_INICIALES = [
  { id: "mesa-1", numero: 1, ubicacion: "Ventana Panorámica", capacidad: 4, estado: "disponible" },
  { id: "mesa-2", numero: 2, ubicacion: "Centro Principal", capacidad: 2, estado: "ocupada" },
  { id: "mesa-3", numero: 3, ubicacion: "Terraza Libre", capacidad: 6, estado: "reservada" },
  { id: "mesa-4", numero: 4, ubicacion: "Zona VIP Exclusiva", capacidad: 8, estado: "disponible" },
  { id: "mesa-5", numero: 5, ubicacion: "Familiar Jardín", capacidad: 5, estado: "disponible" },
  { id: "mesa-6", numero: 6, ubicacion: "Barra Lounge", capacidad: 2, estado: "disponible" }
];

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", inicializarAdmin);
} else {
  inicializarAdmin();
}

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
      if (loading) {
        loading.innerHTML = `
          <p style="color: #c92a2a; font-weight: bold;">⚠️ No has iniciado sesión</p>
          <p style="color: #666; font-size: 14px;">Redirigiendo a la pantalla de inicio de sesión...</p>
        `;
      }
      setTimeout(() => {
        window.location.href = "login.html";
      }, 800);
      return;
    }

    const rol = userAuth.rol || ROLES.CLIENTE;

    // Proteger ruta: sólo administrador y superadmin tienen acceso
    if (rol !== ROLES.SUPERADMIN && rol !== ROLES.ADMINISTRADOR) {
      if (loading) {
        loading.innerHTML = `
          <p style="color: #c92a2a; font-weight: bold;">⛔ Acceso denegado</p>
          <p style="color: #555; font-size: 14px;">Tu cuenta tiene el rol <strong>[${rol.toUpperCase()}]</strong>. Esta sección es exclusiva para Administradores y Superadmins.</p>
          <div style="margin-top: 15px;">
            <a href="index.html" class="btn-admin btn-admin-pink" style="display: inline-block; text-decoration: none;">Ir al Inicio</a>
            <a href="panel.html" class="btn-admin btn-admin-soft" style="display: inline-block; text-decoration: none; margin-left: 10px;">Ir a Mi Panel</a>
          </div>
        `;
      }
      alert(`Acceso denegado: Tu cuenta tiene el rol [${rol.toUpperCase()}]. Esta sección es exclusiva para Administradores y Superadmins.`);
      window.location.href = "index.html";
      return;
    }

    currentUser = userAuth;

    // Mostrar el contenedor principal
    if (loading) loading.style.display = "none";
    if (content) content.style.display = "block";

    // Cargar perfil en la barra superior
    renderizarPerfilUsuario();

    // Aplicar permisos estrictos de acceso: El CRUD de usuarios es exclusivo de Superadmin
    aplicarPermisosPorRol();

    // 1. Inicializar Dashboard Comercial (Ventas día/semana/mes, pedidos, ingresos, stock, reservas)
    await inicializarDashboardComercial();

    // 2. Cargar estadísticas y CRUD de usuarios únicamente si el usuario es Superadmin
    if (currentUser.rol === ROLES.SUPERADMIN) {
      await cargarUsuarios();
    }

    // 3. Inicializar gestión de mesas
    inicializarMesas();

    // 4. Inicializar capacidad del restaurante
    await inicializarCapacidad();

    // 5. Inicializar gestión del menú gastronómico
    await inicializarGestionMenu();

    // 6. Configurar escuchadores de eventos generales y comerciales
    configurarEventos();
    configurarEventosComerciales();

  } catch (err) {
    console.error("Error al inicializar panel admin:", err);
    if (loading) {
      loading.innerHTML = `
        <p style="color: #c92a2a; font-weight: bold;">❌ Error al inicializar panel administrativo</p>
        <p style="color: #666; font-size: 14px;">${err.message || "Error al conectar con la base de datos."}</p>
        <div style="margin-top: 15px;">
          <a href="login.html" class="btn-admin btn-admin-pink" style="display: inline-block; text-decoration: none;">Iniciar Sesión</a>
          <button onclick="location.reload()" class="btn-admin btn-admin-soft" style="margin-left: 10px; cursor: pointer;">Reintentar</button>
        </div>
      `;
    }
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

  // Personalizar títulos del banner según nivel de acceso
  const elBannerTitle = document.querySelector(".admin-banner h1");
  const elBannerDesc = document.querySelector(".admin-banner p");
  if (elBannerTitle && elBannerDesc) {
    if (rol === ROLES.SUPERADMIN) {
      elBannerTitle.textContent = "👑 Centro de Superadministración";
      elBannerDesc.textContent = "Acceso total del sistema: CRUD de usuarios, permisos, operaciones, ventas, pedidos e inventario.";
    } else {
      elBannerTitle.textContent = "📊 Centro de Gestión Administrativa";
      elBannerDesc.textContent = "Control operativo y comercial: ventas del día, pedidos, reservas de hoy, mesas, inventario y menú.";
    }
  }

  const elNote = document.getElementById("admin-user-roles-note");
  if (elNote) {
    if (rol === ROLES.SUPERADMIN) {
      elNote.innerHTML = `👑 <strong>Modo Superadmin:</strong> Tienes permisos completos para el CRUD de usuarios, modificación de roles y eliminación de cuentas.`;
      elNote.style.color = "#2b8a3e";
    } else {
      elNote.innerHTML = `🔒 <strong>Modo Administrador:</strong> El CRUD de usuarios está restringido a cuentas con rango <strong>Superadmin</strong>.`;
      elNote.style.color = "#d9480f";
    }
  }
}

/**
 * Control estricto de visibilidad por rol: El CRUD de usuarios es exclusivo de Superadmin
 */
function aplicarPermisosPorRol() {
  const esSuperadmin = currentUser && currentUser.rol === ROLES.SUPERADMIN;

  const seccionCrudUsuarios = document.getElementById("seccion-crud-usuarios");
  const seccionStatsUsuarios = document.getElementById("seccion-stats-usuarios");
  const btnCrearUsuario = document.getElementById("btn-open-create-modal");

  if (!esSuperadmin) {
    // Si el usuario es Administrador regular, NO tiene acceso al CRUD de usuarios
    if (seccionCrudUsuarios) seccionCrudUsuarios.style.display = "none";
    if (seccionStatsUsuarios) seccionStatsUsuarios.style.display = "none";
    if (btnCrearUsuario) btnCrearUsuario.style.display = "none";
  } else {
    // Si el usuario es Superadmin, tiene acceso completo al CRUD
    if (seccionCrudUsuarios) seccionCrudUsuarios.style.display = "block";
    if (seccionStatsUsuarios) seccionStatsUsuarios.style.display = "grid";
    if (btnCrearUsuario) btnCrearUsuario.style.display = "inline-flex";
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
        ${esSuperadmin ? `
          <select class="admin-role-select" id="role-select-${u.id}">
            <option value="superadmin" ${rolActual === "superadmin" ? "selected" : ""}>Superadmin</option>
            <option value="administrador" ${rolActual === "administrador" ? "selected" : ""}>Administrador</option>
            <option value="trabajador" ${rolActual === "trabajador" ? "selected" : ""}>Trabajador</option>
            <option value="cliente" ${rolActual === "cliente" ? "selected" : ""}>Cliente</option>
          </select>
        ` : `
          <span style="font-size: 12.5px; color: #888; display: inline-flex; align-items: center; gap: 5px;">
            <span>🔒</span> <em>Exclusivo Superadmin</em>
          </span>
        `}
      </td>
      <td>
        <div style="display: flex; gap: 6px; align-items: center;">
          ${esSuperadmin ? `
            <button class="btn-table-action btn-save" title="Guardar Rol" data-action="save" data-uid="${u.id}">
              💾 Guardar
            </button>
            ${!esElMismo ? `
              <button class="btn-table-action btn-delete" title="Eliminar Usuario" data-action="delete" data-uid="${u.id}" data-name="${u.nombre || u.email}">
                🗑️
              </button>
            ` : ""}
          ` : `
            <span style="font-size: 12px; color: #999; padding: 4px 8px; background: #f8f9fa; border-radius: 6px; border: 1px solid #eee;">
              Solo lectura
            </span>
          `}
        </div>
      </td>
    `;

    tbody.appendChild(tr);
  });

  // Delegar eventos de acciones de la tabla si es Superadmin
  if (esSuperadmin) {
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
}

/**
 * Guarda el rol modificado de un usuario (Función exclusiva de Superadmin)
 */
async function guardarCambioRol(uid) {
  // Validación estricta de rol
  if (currentUser.rol !== ROLES.SUPERADMIN) {
    mostrarToast("⛔ Acción restringida: Solo los usuarios con rol SUPERADMIN tienen autorización para cambiar roles.", "error");
    return;
  }

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
 * Elimina un usuario de Firestore (Función exclusiva de Superadmin)
 */
async function ejecutarEliminarUsuario(uid, nombre) {
  // Validación estricta de rol
  if (currentUser.rol !== ROLES.SUPERADMIN) {
    mostrarToast("⛔ Acción restringida: Solo los usuarios con rol SUPERADMIN pueden eliminar usuarios.", "error");
    return;
  }

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

      if (currentUser?.rol !== ROLES.SUPERADMIN) {
        mostrarToast("⛔ Acción restringida: Solo los usuarios con rol SUPERADMIN tienen autorización para crear cuentas.", "error");
        return;
      }

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
  actualizarMetricasCapacidad();
  actualizarResumenMesas();
  mostrarToast(`Estado de ${mesaId.toUpperCase()} actualizado a [${nuevoEstado.toUpperCase()}]`, "exito");
}

// ============================================================
// GESTIÓN DE CAPACIDAD DEL RESTAURANTE
// ============================================================

async function inicializarCapacidad() {
  capacidadTotalRestaurante = await obtenerCapacidadRestaurante();

  const inputCap = document.getElementById("admin-input-capacity");
  if (inputCap) {
    inputCap.value = capacidadTotalRestaurante;
  }

  const btnSave = document.getElementById("btn-save-capacity");
  if (btnSave) {
    btnSave.addEventListener("click", async () => {
      const nuevoValor = Number(document.getElementById("admin-input-capacity")?.value);
      if (!nuevoValor || nuevoValor < 1) {
        mostrarToast("Por favor ingresa una capacidad válida mayor a 0.", "error");
        return;
      }

      btnSave.disabled = true;
      btnSave.textContent = "Guardando...";

      await guardarCapacidadRestaurante(nuevoValor);
      capacidadTotalRestaurante = nuevoValor;

      btnSave.disabled = false;
      btnSave.textContent = "💾 Guardar";

      actualizarMetricasCapacidad();
      mostrarToast(`Aforo máximo establecido en ${nuevoValor} personas.`, "exito");
    });
  }

  actualizarMetricasCapacidad();
}

function actualizarMetricasCapacidad() {
  // Contar ocupación según mesas activas
  let mesas = MESAS_INICIALES;
  try {
    const guardadas = localStorage.getItem("freechair_admin_mesas");
    if (guardadas) mesas = JSON.parse(guardadas);
  } catch (_) {}

  const comensalesOcupados = mesas.reduce((total, m) => {
    if (m.estado === "ocupada" || m.estado === "reservada") {
      return total + (Number(m.capacidad) || 2);
    }
    return total;
  }, 0);

  const total = Number(capacidadTotalRestaurante) || 50;
  const disponibles = Math.max(0, total - comensalesOcupados);
  const porcentaje = Math.min(100, Math.round((comensalesOcupados / total) * 100));

  const elOcupados = document.getElementById("admin-capacity-occupied");
  const elDisponibles = document.getElementById("admin-capacity-available");
  const elPct = document.getElementById("admin-capacity-pct");
  const elBar = document.getElementById("admin-capacity-progress-fill");

  if (elOcupados) elOcupados.textContent = `${comensalesOcupados} pax`;
  if (elDisponibles) elDisponibles.textContent = `${disponibles} pax`;
  if (elPct) elPct.textContent = `${porcentaje}%`;
  if (elBar) elBar.style.width = `${porcentaje}%`;
}

// ============================================================
// GESTIÓN DEL MENÚ GASTRONÓMICO
// ============================================================

async function inicializarGestionMenu() {
  await cargarMenuAdmin();
  configurarEventosMenu();
}

async function cargarMenuAdmin() {
  const tbody = document.getElementById("admin-menu-tbody");
  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #888; padding: 20px;">Cargando productos del menú...</td></tr>`;
  }

  try {
    listaMenuGlobal = await obtenerMenu();
    renderizarTablaMenu(filtrarMenuPorCategoria(listaMenuGlobal, categoriaMenuSeleccionada));
  } catch (err) {
    console.error("Error al cargar menú:", err);
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #c92a2a; padding: 20px;">Error al cargar el menú.</td></tr>`;
    }
  }
}

function filtrarMenuPorCategoria(items, categoria) {
  if (!categoria || categoria === "todos") return items;
  return items.filter(it => (it.categoria || "").toLowerCase() === categoria.toLowerCase());
}

function renderizarTablaMenu(items) {
  const tbody = document.getElementById("admin-menu-tbody");
  if (!tbody) return;

  if (items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #777; padding: 20px;">No hay productos registrados en esta categoría.</td></tr>`;
    return;
  }

  tbody.innerHTML = "";

  items.forEach(item => {
    const tr = document.createElement("tr");
    const disponible = item.disponible !== false;
    const badgeClass = disponible ? "badge-available" : "badge-soldout";
    const badgeTexto = disponible ? "DISPONIBLE" : "AGOTADO";

    tr.innerHTML = `
      <td>
        <strong style="color: #2b1122;">${item.nombre}</strong>
        ${item.descripcion ? `<p style="margin: 3px 0 0; color: #777; font-size: 12px;">${item.descripcion}</p>` : ""}
      </td>
      <td>
        <span class="role-badge badge-trabajador" style="background:#fdf2f7; color:#cc2369;">${item.categoria || "Platos Fuertes"}</span>
      </td>
      <td style="font-weight: bold; color: #2b8a3e;">
        ${formatearMoneda(item.precio)}
      </td>
      <td>
        <span class="${badgeClass}">${badgeTexto}</span>
      </td>
      <td>
        <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap;">
          <button class="btn-table-action btn-save btn-toggle-disp" data-id="${item.id}" data-disp="${disponible}" title="Cambiar disponibilidad">
            ${disponible ? "Marcar Agotado" : "Habilitar"}
          </button>
          <button class="btn-table-action btn-edit-menu" data-id="${item.id}" title="Editar Producto" style="background:#1971c2; color:white; border:none; border-radius:6px; padding:6px 10px; cursor:pointer;">
            ✏️
          </button>
          <button class="btn-table-action btn-delete btn-delete-menu" data-id="${item.id}" data-nombre="${item.nombre}" title="Eliminar Producto">
            🗑️
          </button>
        </div>
      </td>
    `;

    tbody.appendChild(tr);
  });

  // Delegar eventos de acciones del menú
  tbody.querySelectorAll(".btn-toggle-disp").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-id");
      const actual = btn.getAttribute("data-disp") === "true";
      await actualizarItemMenu(id, { disponible: !actual });
      mostrarToast(`Disponibilidad de plato actualizada.`, "info");
      await cargarMenuAdmin();
    });
  });

  tbody.querySelectorAll(".btn-edit-menu").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id");
      const plato = listaMenuGlobal.find(p => p.id === id);
      if (plato) abrirModalMenu(plato);
    });
  });

  tbody.querySelectorAll(".btn-delete-menu").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-id");
      const nombre = btn.getAttribute("data-nombre");
      const confirmar = confirm(`¿Estás seguro de eliminar permanentemente "${nombre}" del menú?`);
      if (!confirmar) return;

      await eliminarItemMenu(id);
      mostrarToast(`Plato "${nombre}" eliminado del menú.`, "exito");
      await cargarMenuAdmin();
    });
  });
}

function configurarEventosMenu() {
  // Filtros de categoría
  const filtroBotones = document.querySelectorAll("#menu-admin-categories .btn-cat-filter");
  filtroBotones.forEach(btn => {
    btn.addEventListener("click", () => {
      filtroBotones.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      categoriaMenuSeleccionada = btn.getAttribute("data-cat");
      renderizarTablaMenu(filtrarMenuPorCategoria(listaMenuGlobal, categoriaMenuSeleccionada));
    });
  });

  // Botón abrir modal de nuevo producto
  const btnOpenModal = document.getElementById("btn-open-menu-modal");
  if (btnOpenModal) {
    btnOpenModal.addEventListener("click", () => {
      abrirModalMenu(null);
    });
  }

  // Cerrar modal
  const btnClose = document.getElementById("btn-close-menu-modal");
  const btnCancel = document.getElementById("btn-cancel-menu-modal");
  if (btnClose) btnClose.addEventListener("click", cerrarModalMenu);
  if (btnCancel) btnCancel.addEventListener("click", cerrarModalMenu);

  // Formulario submit
  const form = document.getElementById("form-menu-item");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btnSubmit = document.getElementById("btn-submit-menu");
      const idHidden = document.getElementById("menu-item-id")?.value;

      const nombre = document.getElementById("menu-item-nombre")?.value.trim();
      const categoria = document.getElementById("menu-item-categoria")?.value;
      const precio = Number(document.getElementById("menu-item-precio")?.value) || 0;
      const descripcion = document.getElementById("menu-item-descripcion")?.value.trim();
      const disponible = document.getElementById("menu-item-disponible")?.checked;

      if (!nombre || precio <= 0) {
        mostrarToast("Por favor ingresa un nombre y un precio válido.", "error");
        return;
      }

      if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.textContent = "Guardando...";
      }

      try {
        if (idHidden) {
          // Edición
          await actualizarItemMenu(idHidden, { nombre, categoria, precio, descripcion, disponible });
          mostrarToast(`¡Producto "${nombre}" actualizado correctamente!`, "exito");
        } else {
          // Nuevo
          await crearItemMenu({ nombre, categoria, precio, descripcion, disponible });
          mostrarToast(`¡Producto "${nombre}" agregado al menú!`, "exito");
        }

        cerrarModalMenu();
        await cargarMenuAdmin();
      } catch (error) {
        console.error("Error al guardar plato:", error);
        mostrarToast("No se pudo guardar el plato.", "error");
      } finally {
        if (btnSubmit) {
          btnSubmit.disabled = false;
          btnSubmit.textContent = "Guardar Producto";
        }
      }
    });
  }
}

function abrirModalMenu(item = null) {
  const modal = document.getElementById("modal-menu-item");
  const title = document.getElementById("modal-menu-title");
  const form = document.getElementById("form-menu-item");

  if (!modal) return;
  if (form) form.reset();

  if (item) {
    if (title) title.textContent = "✏️ Editar Producto del Menú";
    document.getElementById("menu-item-id").value = item.id;
    document.getElementById("menu-item-nombre").value = item.nombre || "";
    document.getElementById("menu-item-categoria").value = item.categoria || "Platos Fuertes";
    document.getElementById("menu-item-precio").value = item.precio || 0;
    document.getElementById("menu-item-descripcion").value = item.descripcion || "";
    document.getElementById("menu-item-disponible").checked = item.disponible !== false;
  } else {
    if (title) title.textContent = "➕ Agregar Producto al Menú";
    document.getElementById("menu-item-id").value = "";
    document.getElementById("menu-item-disponible").checked = true;
  }

  modal.style.display = "flex";
}

function cerrarModalMenu() {
  const modal = document.getElementById("modal-menu-item");
  if (modal) modal.style.display = "none";
}

// ============================================================
// DASHBOARD COMERCIAL: VENTAS, PEDIDOS, GANANCIAS, RANKING E INVENTARIO
// ============================================================

async function inicializarDashboardComercial() {
  await Promise.all([
    actualizarMetricasComercialesYVentas(),
    cargarReservasHoy(),
    cargarInventarioAdmin()
  ]);
  actualizarResumenMesas();
}

/**
 * Carga y actualiza las métricas de Ventas del día, semana, mes, pedidos, ingresos y ranking
 */
async function actualizarMetricasComercialesYVentas() {
  try {
    metricasComercialesGlobal = await calcularMetricasComerciales();
    listaVentasGlobal = await obtenerTodasLasVentas();

    // 1. KPI Ventas de Hoy
    const elSalesToday = document.getElementById("admin-kpi-sales-today");
    const elOrdersTodaySub = document.getElementById("admin-kpi-orders-today-sub");
    if (elSalesToday) elSalesToday.textContent = formatearMoneda(metricasComercialesGlobal.ventasHoy);
    if (elOrdersTodaySub) elOrdersTodaySub.textContent = `${metricasComercialesGlobal.pedidosHoy} pedidos cobrados`;

    // 2. KPI Ventas de la Semana
    const elSalesWeek = document.getElementById("admin-kpi-sales-week");
    const elOrdersWeekSub = document.getElementById("admin-kpi-orders-week-sub");
    if (elSalesWeek) elSalesWeek.textContent = formatearMoneda(metricasComercialesGlobal.ventasSemana);
    if (elOrdersWeekSub) elOrdersWeekSub.textContent = `${metricasComercialesGlobal.pedidosSemana} pedidos esta semana`;

    // 3. KPI Ventas del Mes
    const elSalesMonth = document.getElementById("admin-kpi-sales-month");
    const elOrdersMonthSub = document.getElementById("admin-kpi-orders-month-sub");
    if (elSalesMonth) elSalesMonth.textContent = formatearMoneda(metricasComercialesGlobal.ventasMes);
    if (elOrdersMonthSub) elOrdersMonthSub.textContent = `${metricasComercialesGlobal.pedidosMes} facturaciones mes actual`;

    // 4. KPI Ingresos y Ganancias
    const elRevenueTotal = document.getElementById("admin-kpi-revenue-total");
    const elProfitTotal = document.getElementById("admin-kpi-profit-total");
    if (elRevenueTotal) elRevenueTotal.textContent = formatearMoneda(metricasComercialesGlobal.ingresosTotales);
    if (elProfitTotal) elProfitTotal.textContent = `Ganancia: ${formatearMoneda(metricasComercialesGlobal.gananciasTotales)}`;

    // 5. KPI Total Pedidos
    const elOrdersTotal = document.getElementById("admin-kpi-orders-total");
    if (elOrdersTotal) elOrdersTotal.textContent = metricasComercialesGlobal.totalPedidos;

    // 6. Renderizar ranking de productos más vendidos
    renderizarRankingTopVendidos(metricasComercialesGlobal.rankingProductos);

    // 7. Renderizar tabla de ventas según período seleccionado
    filtrarYRenderizarVentas();

  } catch (error) {
    console.error("Error al actualizar métricas comerciales:", error);
  }
}

/**
 * Filtra las ventas según el período y actualiza la tabla
 */
function filtrarYRenderizarVentas() {
  const ahora = new Date();
  const hoyStr = ahora.toISOString().split("T")[0];
  const sieteDiasAtras = new Date(ahora.getTime() - 7 * 24 * 60 * 60000);
  const mesActual = ahora.getMonth();
  const anioActual = ahora.getFullYear();

  let filtradas = [];

  switch (periodoVentasSeleccionado) {
    case "hoy":
      filtradas = listaVentasGlobal.filter(v => v.fecha === hoyStr || (new Date(v.timestamp || v.fecha).toDateString() === ahora.toDateString()));
      break;
    case "semana":
      filtradas = listaVentasGlobal.filter(v => new Date(v.timestamp || v.fecha) >= sieteDiasAtras);
      break;
    case "mes":
      filtradas = listaVentasGlobal.filter(v => {
        const d = new Date(v.timestamp || v.fecha);
        return d.getMonth() === mesActual && d.getFullYear() === anioActual;
      });
      break;
    case "todo":
    default:
      filtradas = listaVentasGlobal;
      break;
  }

  renderizarTablaVentas(filtradas);
}

function renderizarTablaVentas(ventas) {
  const tbody = document.getElementById("admin-sales-tbody");
  if (!tbody) return;

  if (!ventas || ventas.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; color: #888; padding: 25px;">
          No hay ventas registradas en el período seleccionado.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = "";

  ventas.slice(0, 20).forEach(v => {
    const tr = document.createElement("tr");

    // Formatear items
    const detalleItems = Array.isArray(v.items)
      ? v.items.map(it => `<strong>${it.cantidad}x</strong> ${it.nombre}`).join(", ")
      : "Consumo en Restaurante";

    // Formatear fecha y hora
    const fechaObj = new Date(v.timestamp || v.fecha);
    const fechaFormateada = isNaN(fechaObj) ? v.fecha : `${fechaObj.toLocaleDateString("es-CO")} ${fechaObj.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}`;

    const estadoBadge = v.estado === "Entregado"
      ? `<span class="badge-available">ENTREGADO</span>`
      : `<span class="stock-level-badge stock-level-low">${(v.estado || "EN PROCESO").toUpperCase()}</span>`;

    tr.innerHTML = `
      <td><strong>#${v.numeroPedido || v.id.slice(-4)}</strong></td>
      <td>${v.cliente || "Cliente"}</td>
      <td><span style="color: #da345d; font-weight: 600;">${v.mesa || "Mesa"}</span></td>
      <td style="max-width: 250px; font-size: 13px;">${detalleItems}</td>
      <td><span style="font-size: 12px; color: #555;">💳 ${v.metodoPago || "Efectivo"}</span></td>
      <td><strong style="color: #2b8a3e; font-size: 14px;">${formatearMoneda(v.total || 0)}</strong></td>
      <td>${estadoBadge}</td>
      <td style="font-size: 12px; color: #777;">${fechaFormateada}</td>
    `;

    tbody.appendChild(tr);
  });
}

/**
 * Renderiza el ranking Top 5 de productos más vendidos
 */
function renderizarRankingTopVendidos(ranking) {
  const contenedor = document.getElementById("admin-ranking-products-list");
  if (!contenedor) return;

  if (!ranking || ranking.length === 0) {
    contenedor.innerHTML = `<p style="text-align: center; color: #888; padding: 20px;">No hay datos de ventas para generar el ranking.</p>`;
    return;
  }

  const maxVentas = Math.max(...ranking.map(r => r.cantidadVendida), 1);
  const topItems = ranking.slice(0, 5);

  contenedor.innerHTML = "";

  topItems.forEach((prod, index) => {
    const pct = Math.round((prod.cantidadVendida / maxVentas) * 100);
    const badgeClass = index === 0 ? "top-1" : (index === 1 ? "top-2" : (index === 2 ? "top-3" : ""));

    const card = document.createElement("div");
    card.className = "ranking-card";
    card.innerHTML = `
      <div class="ranking-badge ${badgeClass}">#${index + 1}</div>
      <div class="ranking-info">
        <div class="ranking-name">${prod.nombre}</div>
        <div class="ranking-meta">
          <span>📦 <strong>${prod.cantidadVendida}</strong> unidades</span>
          <span>🔥 ${pct}% demanda</span>
        </div>
        <div class="ranking-bar-track">
          <div class="ranking-bar-fill" style="width: ${pct}%;"></div>
        </div>
      </div>
      <div class="ranking-total-box">
        <div class="ranking-total-amount">${formatearMoneda(prod.ingresos)}</div>
        <div class="ranking-total-units">facturado</div>
      </div>
    `;

    contenedor.appendChild(card);
  });
}

/**
 * Carga las reservas de hoy y las renderiza en la tabla
 */
async function cargarReservasHoy() {
  try {
    listaReservasHoyGlobal = await obtenerReservasDeHoy();

    // Actualizar KPI Reservas de Hoy
    const elKpiReservas = document.getElementById("admin-kpi-reservations-today");
    const elKpiComensales = document.getElementById("admin-kpi-diners-today");

    const totalComensales = listaReservasHoyGlobal.reduce((acc, r) => acc + (Number(r.personas) || 2), 0);

    if (elKpiReservas) elKpiReservas.textContent = listaReservasHoyGlobal.length;
    if (elKpiComensales) elKpiComensales.textContent = `${totalComensales} comensales`;

    renderizarTablaReservasHoy(listaReservasHoyGlobal);
  } catch (error) {
    console.error("Error al cargar reservas de hoy:", error);
  }
}

function renderizarTablaReservasHoy(reservas) {
  const tbody = document.getElementById("admin-today-reservations-tbody");
  if (!tbody) return;

  if (!reservas || reservas.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; color: #888; padding: 25px;">
          No hay reservaciones agendadas para el día de hoy.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = "";

  reservas.forEach(r => {
    const tr = document.createElement("tr");

    const estadoBadge = r.estado === "Confirmada"
      ? `<span class="badge-available">CONFIRMADA</span>`
      : (r.estado === "Completada"
        ? `<span class="stock-level-badge stock-level-ok">COMPLETADA</span>`
        : `<span class="stock-level-badge stock-level-low">${(r.estado || "EN ESPERA").toUpperCase()}</span>`);

    tr.innerHTML = `
      <td><strong>${r.userNombre || "Cliente"}</strong></td>
      <td style="font-size: 13px; color: #666;">${r.userEmail || "Sin email"}</td>
      <td><span style="color: #da345d; font-weight: 600;">📍 ${r.mesa || "Mesa asignada"}</span></td>
      <td><strong style="color: #2b1122;">⏰ ${r.hora || "Por definir"}</strong></td>
      <td>👥 ${r.personas || 2} personas</td>
      <td style="font-size: 13px; color: #555;">${r.ocasion || r.notas || "Reserva estándar"}</td>
      <td>${estadoBadge}</td>
      <td>
        <select class="admin-select-reserva-status" data-id="${r.id}" style="padding: 4px 8px; border-radius: 6px; border: 1px solid #ffd2e5; font-size: 12px;">
          <option value="Confirmada" ${r.estado === "Confirmada" ? "selected" : ""}>Confirmada</option>
          <option value="En sala" ${r.estado === "En sala" ? "selected" : ""}>En sala</option>
          <option value="Completada" ${r.estado === "Completada" ? "selected" : ""}>Completada</option>
          <option value="Cancelada" ${r.estado === "Cancelada" ? "selected" : ""}>Cancelada</option>
        </select>
      </td>
    `;

    tbody.appendChild(tr);
  });

  // Escuchar cambios de estado en las reservas
  tbody.querySelectorAll(".admin-select-reserva-status").forEach(sel => {
    sel.addEventListener("change", async (e) => {
      const id = e.target.getAttribute("data-id");
      const nuevoEstado = e.target.value;
      await actualizarEstadoReserva(id, nuevoEstado);
      mostrarToast(`Estado de la reserva actualizado a [${nuevoEstado}]`, "exito");
      await cargarReservasHoy();
    });
  });
}

/**
 * Carga el inventario, actualiza KPI de stock bajo y alerta si hay insumos críticos
 */
async function cargarInventarioAdmin() {
  try {
    listaInventarioGlobal = await obtenerInventario();

    let criticos = 0;
    let bajos = 0;

    listaInventarioGlobal.forEach(it => {
      const stock = Number(it.stock || 0);
      const min = Number(it.stockMinimo || 8);
      if (stock <= 5) criticos++;
      else if (stock <= min) bajos++;
    });

    const totalAlertas = criticos + bajos;

    // Actualizar KPI Alertas de Inventario
    const elKpiLowStock = document.getElementById("admin-kpi-low-stock");
    const elKpiCriticalTag = document.getElementById("admin-kpi-critical-tag");
    if (elKpiLowStock) elKpiLowStock.textContent = totalAlertas;
    if (elKpiCriticalTag) {
      elKpiCriticalTag.textContent = `${criticos} Críticos`;
      elKpiCriticalTag.className = criticos > 0 ? "kpi-tag-trend kpi-tag-danger" : "kpi-tag-trend kpi-tag-positive";
    }

    // Banner de advertencia si hay críticos
    const banner = document.getElementById("admin-stock-alert-banner");
    const bannerText = document.getElementById("admin-stock-alert-text");
    if (banner) {
      if (criticos > 0) {
        banner.style.display = "flex";
        if (bannerText) bannerText.textContent = `¡Alerta! Hay ${criticos} producto(s) en nivel crítico de inventario (≤ 5 porciones).`;
      } else {
        banner.style.display = "none";
      }
    }

    renderizarTablaInventario(listaInventarioGlobal);
  } catch (error) {
    console.error("Error al cargar inventario:", error);
  }
}

function renderizarTablaInventario(inventario) {
  const tbody = document.getElementById("admin-inventory-tbody");
  if (!tbody) return;

  tbody.innerHTML = "";

  inventario.forEach(it => {
    const tr = document.createElement("tr");
    const stock = Number(it.stock || 0);
    const min = Number(it.stockMinimo || 8);

    let badge = "";
    if (stock <= 5) {
      badge = `<span class="stock-level-badge stock-level-critical">🚨 CRÍTICO (${stock})</span>`;
    } else if (stock <= min) {
      badge = `<span class="stock-level-badge stock-level-low">⚡ BAJO (${stock})</span>`;
    } else {
      badge = `<span class="stock-level-badge stock-level-ok">✅ ÓPTIMO (${stock})</span>`;
    }

    tr.innerHTML = `
      <td>
        <strong>${it.nombre}</strong>
        <div style="font-size: 11px; color: #888;">${it.categoria || "Gastronomía"}</div>
      </td>
      <td><strong>${stock}</strong> ${it.unidad || "unidades"}</td>
      <td style="color: #666;">${min} ${it.unidad || "unidades"}</td>
      <td>${badge}</td>
      <td>
        <button class="btn-restock-quick" data-inv-id="${it.id}" title="Añadir 10 unidades al stock">
          ➕ +10 Reabastecer
        </button>
      </td>
    `;

    tbody.appendChild(tr);
  });

  // Delegar clic de reabastecimiento rápido
  tbody.querySelectorAll(".btn-restock-quick").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-inv-id");
      btn.disabled = true;
      btn.textContent = "Surtir...";
      const res = await reabastecerInventario(id, 10);
      if (res.success) {
        mostrarToast(`Stock de "${res.item.nombre}" reabastecido (+10 unidades).`, "exito");
        await cargarInventarioAdmin();
      }
    });
  });
}

/**
 * Actualiza en tiempo real el KPI de Mesas Libres vs Ocupadas
 */
function actualizarResumenMesas() {
  let mesas = MESAS_INICIALES;
  try {
    const guardadas = localStorage.getItem("freechair_admin_mesas");
    if (guardadas) mesas = JSON.parse(guardadas);
  } catch (_) {}

  const libres = mesas.filter(m => m.estado === "disponible").length;
  const ocupadas = mesas.filter(m => m.estado === "ocupada").length;
  const reservadas = mesas.filter(m => m.estado === "reservada").length;

  const elRatio = document.getElementById("admin-kpi-tables-ratio");
  const elAvailableBadge = document.getElementById("admin-kpi-tables-available-badge");
  const elOccupiedText = document.getElementById("admin-kpi-tables-occupied-text");

  if (elRatio) elRatio.textContent = `${libres} / ${ocupadas + reservadas}`;
  if (elAvailableBadge) elAvailableBadge.textContent = `${libres} Libres`;
  if (elOccupiedText) elOccupiedText.textContent = `${ocupadas} Ocupadas | ${reservadas} Reservadas`;
}

/**
 * Configurar eventos del panel comercial (Filtros de ventas, reservas, modal de nueva venta)
 */
function configurarEventosComerciales() {
  // Filtros de período de ventas (Hoy / Semana / Mes / Todo)
  const filterBtns = document.querySelectorAll("#admin-sales-period-filters .btn-period-filter");
  filterBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      filterBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      periodoVentasSeleccionado = btn.getAttribute("data-period") || "hoy";
      filtrarYRenderizarVentas();
    });
  });

  // Botón refrescar reservas de hoy
  const btnRefreshRes = document.getElementById("btn-refresh-reservations");
  if (btnRefreshRes) {
    btnRefreshRes.addEventListener("click", async () => {
      await cargarReservasHoy();
      mostrarToast("Reservas de hoy actualizadas.", "info");
    });
  }

  // Modal para Registrar Venta / Pedido Rápido
  const btnOpenSale = document.getElementById("btn-open-sale-modal");
  const modalSale = document.getElementById("modal-register-sale");
  const btnCloseSale = document.getElementById("btn-close-sale-modal");
  const btnCancelSale = document.getElementById("btn-cancel-sale-modal");
  const formSale = document.getElementById("form-register-sale");
  const selectProduct = document.getElementById("sale-input-product");
  const inputQuantity = document.getElementById("sale-input-quantity");
  const previewTotal = document.getElementById("sale-total-preview");

  const actualizarPrecioVentaPreview = () => {
    if (!selectProduct || !inputQuantity || !previewTotal) return;
    const selectedOption = selectProduct.options[selectProduct.selectedIndex];
    const precio = Number(selectedOption?.getAttribute("data-precio") || 0);
    const cantidad = Number(inputQuantity.value || 1);
    previewTotal.textContent = formatearMoneda(precio * cantidad);
  };

  const poblarSelectProductosVenta = async () => {
    if (!selectProduct) return;
    selectProduct.innerHTML = "";

    const menu = await obtenerMenu();
    menu.forEach(item => {
      const opt = document.createElement("option");
      opt.value = item.nombre;
      opt.textContent = `${item.nombre} (${formatearMoneda(item.precio)})`;
      opt.setAttribute("data-precio", item.precio);
      opt.setAttribute("data-categoria", item.categoria);
      selectProduct.appendChild(opt);
    });

    actualizarPrecioVentaPreview();
  };

  if (btnOpenSale && modalSale) {
    btnOpenSale.addEventListener("click", async () => {
      await poblarSelectProductosVenta();
      modalSale.style.display = "flex";
    });
  }

  const cerrarModalVenta = () => {
    if (modalSale) modalSale.style.display = "none";
  };

  if (btnCloseSale) btnCloseSale.addEventListener("click", cerrarModalVenta);
  if (btnCancelSale) btnCancelSale.addEventListener("click", cerrarModalVenta);

  if (selectProduct) selectProduct.addEventListener("change", actualizarPrecioVentaPreview);
  if (inputQuantity) inputQuantity.addEventListener("input", actualizarPrecioVentaPreview);

  if (formSale) {
    formSale.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btnSubmit = formSale.querySelector("button[type='submit']");

      const selectedOption = selectProduct.options[selectProduct.selectedIndex];
      const nombreProducto = selectedOption?.value || "Plato FreeChair";
      const precioUnitario = Number(selectedOption?.getAttribute("data-precio") || 25000);
      const cantidad = Number(inputQuantity.value || 1);
      const mesa = document.getElementById("sale-input-table")?.value || "Mesa 1";
      const cliente = document.getElementById("sale-input-client")?.value || "Cliente en Sala";
      const metodoPago = document.getElementById("sale-input-payment")?.value || "Efectivo";

      // Costo estimado ~45%
      const costoUnitario = Math.round(precioUnitario * 0.45);

      if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.textContent = "Procesando...";
      }

      const res = await registrarNuevaVenta({
        cliente,
        mesa,
        items: [
          {
            nombre: nombreProducto,
            cantidad,
            precio: precioUnitario,
            costo: costoUnitario
          }
        ],
        metodoPago
      });

      if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.textContent = "💳 Confirmar y Facturar";
      }

      if (res.success) {
        mostrarToast(`¡Venta registrada exitosamente por ${formatearMoneda(res.venta.total)}!`, "exito");
        cerrarModalVenta();
        formSale.reset();
        await Promise.all([
          actualizarMetricasComercialesYVentas(),
          cargarInventarioAdmin()
        ]);
      } else {
        mostrarToast("No se pudo registrar la venta.", "error");
      }
    });
  }
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
