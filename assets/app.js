/* ============================================================
   Desertores CEBAS - SPA (HTML/CSS/JS puro + Firebase)
   ============================================================ */

// ===== CONFIGURACIÓN FIREBASE =====
const firebaseConfig = {
  apiKey: "AIzaSyBB0iuqkuy5OyLA9ddlnFq8gBCxDJuMHJ0",
  authDomain: "desertorescebas2.firebaseapp.com",
  projectId: "desertorescebas2",
  storageBucket: "desertorescebas2.firebasestorage.app",
  messagingSenderId: "20960762483",
  appId: "1:20960762483:web:ac9d45d37dd5ace6286806"
};

// ===== VARIABLES GLOBALES =====
let db = null;
let auth = null;
let usuarioActual = null;
let personas = [];
let personaEditandoId = null;
let verPersonaIdActual = null;

// ===== INICIALIZACIÓN =====
document.addEventListener("DOMContentLoaded", () => {
  iniciarFirebase();
  iniciarRouter();
  iniciarMenuMobile();
});

// ===== FIREBASE =====
function iniciarFirebase() {
  if (typeof firebase !== "undefined" && firebaseConfig.apiKey) {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    auth = firebase.auth();
    escucharAuth();
    console.log("Firebase conectado.");
  } else {
    console.warn("Firebase no configurado. Usando datos locales (localStorage).");
    cargarDatosLocales();
    mostrarApp();
  }
}

// ===== AUTH =====
function escucharAuth() {
  auth.onAuthStateChanged((user) => {
    if (user) {
      usuarioActual = user;
      cargarPerfilUsuario(user);
      mostrarApp();
      escucharPersonas();
      manejarRuta();
    } else {
      usuarioActual = null;
      mostrarLogin();
      if (db) personas = [];
    }
  });
}

function mostrarLogin() {
  document.getElementById("authScreen").style.display = "flex";
  document.getElementById("appWrapper").style.display = "none";
  document.getElementById("menuToggle").style.display = "none";
}

function mostrarApp() {
  document.getElementById("authScreen").style.display = "none";
  document.getElementById("appWrapper").style.display = "flex";
  document.getElementById("menuToggle").style.display = "";
}

function cargarPerfilUsuario(user) {
  const displayName = user.displayName || user.email.split("@")[0];
  const iniciales = displayName.split(" ").map(n => n[0]).join("").toUpperCase().substring(0, 2);
  document.getElementById("userName").textContent = displayName;
  document.getElementById("userAvatar").textContent = iniciales;
}

function mostrarAuthError(elementId, mensaje) {
  const el = document.getElementById(elementId);
  el.textContent = mensaje;
  el.style.display = "block";
}

function loginUsuario(event) {
  event.preventDefault();
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;
  document.getElementById("loginError").style.display = "none";

  auth.signInWithEmailAndPassword(email, password)
    .catch((err) => {
      const msg = traducirErrorAuth(err.code);
      mostrarAuthError("loginError", msg);
    });
}

function logoutUsuario() {
  if (auth) {
    auth.signOut();
  }
}

function traducirErrorAuth(codigo) {
  const traducciones = {
    "auth/email-already-in-use": "Este email ya está registrado.",
    "auth/invalid-email": "Email inválido.",
    "auth/weak-password": "La contraseña es muy débil (mínimo 6 caracteres).",
    "auth/user-not-found": "No existe una cuenta con ese email.",
    "auth/wrong-password": "Contraseña incorrecta.",
    "auth/invalid-credential": "Email o contraseña incorrectos.",
    "auth/too-many-requests": "Demasiados intentos. Intentá de nuevo más tarde.",
    "auth/network-request-failed": "Error de conexión. Verificá tu internet."
  };
  return traducciones[codigo] || "Error de autenticación. Intentá de nuevo.";
}

// ===== ESCUCHAR PERSONAS (Firestore realtime) =====
function escucharPersonas() {
  if (!db) return;
  db.collection("personas")
    .orderBy("nombre")
    .onSnapshot(
      (snapshot) => {
        personas = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data()
        }));
        const paginaActual = obtenerPaginaActual();
        if (paginaActual === "personas") {
          PersonasTabla.render();
        }
      },
      (error) => {
        console.error("Error escuchando personas:", error);
        mostrarToast("Error de conexión con Firebase.", "error");
      }
    );
}

// ===== DATOS LOCALES (fallback sin Firebase) =====
function cargarDatosLocales() {
  const datos = localStorage.getItem("ceb_personas");
  personas = datos ? JSON.parse(datos) : [];
}

function guardarDatosLocales() {
  localStorage.setItem("ceb_personas", JSON.stringify(personas));
}

// ===== ROUTER SPA =====
function iniciarRouter() {
  window.addEventListener("hashchange", manejarRuta);
  manejarRuta();
}

function manejarRuta() {
  const hash = window.location.hash || "#/";
  const pagina = obtenerPaginaActual();

  document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));

  const pageEl = document.getElementById(`page-${pagina}`);
  if (pageEl) {
    pageEl.classList.add("active");
  }

  document.querySelectorAll(".nav-link").forEach((link) => {
    link.classList.remove("active");
    if (link.getAttribute("data-page") === pagina) {
      link.classList.add("active");
    }
  });

  if (pagina === "personas") {
    PersonasTabla.render();
  }

  cerrarMenuMobile();
}

function obtenerPaginaActual() {
  const hash = (window.location.hash || "#/personas").replace("#/", "");
  return hash || "personas";
}

function navegarA(ruta) {
  window.location.hash = ruta;
}

// ===== PERSONAS TABLA (paginación, filtros, sort, bulk) =====
const PersonasTabla = {
  ITEMS_POR_PAGINA: 10,
  _page: 1,
  _sortField: "nombre",
  _sortDir: "asc",
  _seleccionados: new Set(),
  _debounceTimer: null,

  // --- Obtener datos filtrados y ordenados ---
  _getDatosFiltrados() {
    const query = (document.getElementById("buscarPersona").value || "").toLowerCase().trim();
    const fEstado = document.getElementById("filtroEstado").value;

    let datos = personas.filter((p) => {
      const matchQuery = !query ||
        (p.nombre || "").toLowerCase().includes(query) ||
        (p.dni || "").toLowerCase().includes(query);
      const matchEstado = !fEstado || p.estado === fEstado;
      return matchQuery && matchEstado;
    });

    // Ordenar
    const campo = this._sortField;
    const dir = this._sortDir === "asc" ? 1 : -1;
    datos.sort((a, b) => {
      const valA = (a[campo] || "").toString().toLowerCase();
      const valB = (b[campo] || "").toString().toLowerCase();
      return valA.localeCompare(valB, "es") * dir;
    });

    return datos;
  },

  // --- Render principal ---
  render() {
    const datos = this._getDatosFiltrados();
    const total = datos.length;
    const totalPages = Math.max(1, Math.ceil(total / this.ITEMS_POR_PAGINA));
    if (this._page > totalPages) this._page = totalPages;
    const inicio = (this._page - 1) * this.ITEMS_POR_PAGINA;
    const pagina = datos.slice(inicio, inicio + this.ITEMS_POR_PAGINA);

    const tbody = document.getElementById("tbodyPersonas");
    const sinResultados = document.getElementById("sinResultados");

    this._actualizarSortHeaders();
    this._actualizarBulkBar();

    if (total === 0) {
      tbody.innerHTML = "";
      sinResultados.style.display = "block";
      document.getElementById("pagination-personas").innerHTML = "";
      return;
    }

    sinResultados.style.display = "none";

    tbody.innerHTML = pagina.map((p) => {
      const checked = this._seleccionados.has(p.id) ? "checked" : "";

      const badgeClass = p.estado === "Activo" ? "badge-activo" : "badge-desertor";
      const estadoBadge = `<span class="badge ${badgeClass}">${escaparHTML(p.estado || "Desertor/a")}</span>`;

      return `
        <tr data-id="${p.id}" onclick="verPersona('${p.id}')">
          <td style="text-align:center" onclick="event.stopPropagation()">
            <label class="checkbox-wrap">
              <input type="checkbox" ${checked} onchange="PersonasTabla.toggleSeleccion('${p.id}', this.checked)">
            </label>
          </td>
          <td>${escaparHTML(p.nombre)}</td>
          <td>${escaparHTML(p.dni)}</td>
          <td style="text-align:right">${estadoBadge}</td>
        </tr>`;
    }).join("");

    this._renderPaginacion(totalPages, total);
  },

  // --- Paginación ---
  _renderPaginacion(totalPages, total) {
    const container = document.getElementById("pagination-personas");
    if (totalPages <= 1) { container.innerHTML = ""; return; }

    const inicio = (this._page - 1) * this.ITEMS_POR_PAGINA + 1;
    const fin = Math.min(this._page * this.ITEMS_POR_PAGINA, total);

    let html = '<div class="pagination">';
    html += `<button ${this._page <= 1 ? "disabled" : ""} onclick="PersonasTabla._page=1;PersonasTabla.render()">&laquo;</button>`;
    html += `<button ${this._page <= 1 ? "disabled" : ""} onclick="PersonasTabla._page--;PersonasTabla.render()">&lsaquo;</button>`;

    let startPage = Math.max(1, this._page - 2);
    let endPage = Math.min(totalPages, this._page + 2);
    if (startPage > 1) {
      html += `<button onclick="PersonasTabla._page=1;PersonasTabla.render()">1</button>`;
      if (startPage > 2) html += `<span class="page-info">...</span>`;
    }
    for (let i = startPage; i <= endPage; i++) {
      html += `<button class="${i === this._page ? 'active' : ''}" onclick="PersonasTabla._page=${i};PersonasTabla.render()">${i}</button>`;
    }
    if (endPage < totalPages) {
      if (endPage < totalPages - 1) html += `<span class="page-info">...</span>`;
      html += `<button onclick="PersonasTabla._page=${totalPages};PersonasTabla.render()">${totalPages}</button>`;
    }

    html += `<button ${this._page >= totalPages ? "disabled" : ""} onclick="PersonasTabla._page++;PersonasTabla.render()">&rsaquo;</button>`;
    html += `<button ${this._page >= totalPages ? "disabled" : ""} onclick="PersonasTabla._page=${totalPages};PersonasTabla.render()">&raquo;</button>`;
    html += `<span class="page-info">${inicio}-${fin} de ${total}</span>`;
    html += '</div>';
    container.innerHTML = html;
  },

  // --- Sorting ---
  onSort(field) {
    if (this._sortField === field) {
      this._sortDir = this._sortDir === "asc" ? "desc" : "asc";
    } else {
      this._sortField = field;
      this._sortDir = "asc";
    }
    this._page = 1;
    this.render();
  },

  _actualizarSortHeaders() {
    document.querySelectorAll("#tablaPersonas .sortable").forEach((th) => {
      th.classList.remove("sort-asc", "sort-desc");
      const field = th.getAttribute("data-sort");
      if (field === this._sortField) {
        th.classList.add(this._sortDir === "asc" ? "sort-asc" : "sort-desc");
      }
    });
  },

  // --- Búsqueda con debounce ---
  onSearch() {
    clearTimeout(this._debounceTimer);
    this._debounceTimer = setTimeout(() => {
      this._page = 1;
      this._seleccionados.clear();
      this.render();
    }, 300);
  },

  // --- Filtros ---
  onFilter() {
    this._page = 1;
    this._seleccionados.clear();
    this.render();
  },

  // --- Selección múltiple ---
  toggleSeleccion(id, checked) {
    if (checked) {
      this._seleccionados.add(id);
    } else {
      this._seleccionados.delete(id);
    }
    this._actualizarBulkBar();
    this._actualizarSelectAll();
  },

  toggleSeleccionarTodos(checked) {
    const datos = this._getDatosFiltrados();
    const inicio = (this._page - 1) * this.ITEMS_POR_PAGINA;
    const pagina = datos.slice(inicio, inicio + this.ITEMS_POR_PAGINA);
    pagina.forEach(p => {
      if (checked) this._seleccionados.add(p.id);
      else this._seleccionados.delete(p.id);
    });
    this._actualizarBulkBar();
    this.render();
  },

  deseleccionarTodos() {
    this._seleccionados.clear();
    document.getElementById("personas-select-all").checked = false;
    this._actualizarBulkBar();
    this.render();
  },

  _actualizarBulkBar() {
    const bar = document.getElementById("personas-bulk-bar");
    const count = this._seleccionados.size;
    if (count > 0) {
      bar.style.display = "flex";
      document.getElementById("personas-bulk-count").textContent = `${count} seleccionados`;
    } else {
      bar.style.display = "none";
    }
  },

  _actualizarSelectAll() {
    const datos = this._getDatosFiltrados();
    const inicio = (this._page - 1) * this.ITEMS_POR_PAGINA;
    const pagina = datos.slice(inicio, inicio + this.ITEMS_POR_PAGINA);
    const allChecked = pagina.length > 0 && pagina.every(p => this._seleccionados.has(p.id));
    document.getElementById("personas-select-all").checked = allChecked;
  },

  // --- Eliminar seleccionados ---
  eliminarSeleccionados() {
    if (this._seleccionados.size === 0) return;
    const count = this._seleccionados.size;
    const modal = document.getElementById("modalConfirmar");
    document.getElementById("modalMensaje").textContent =
      `¿Estás seguro de eliminar ${count} persona${count > 1 ? "s" : ""}?`;
    modal.classList.add("show");

    document.getElementById("modalBtnConfirmar").onclick = () => {
      modal.classList.remove("show");
      const ids = [...this._seleccionados];
      let promises = [];
      if (db) {
        ids.forEach(id => promises.push(db.collection("personas").doc(id).delete()));
        Promise.all(promises)
          .then(() => mostrarToast(`${count} persona${count > 1 ? "s" : ""} eliminada${count > 1 ? "s" : ""}.`, "success"))
          .catch(err => { console.error(err); mostrarToast("Error al eliminar.", "error"); });
      } else {
        personas = personas.filter(p => !this._seleccionados.has(p.id));
        guardarDatosLocales();
      }
      mostrarToast(`${count} persona${count > 1 ? "s" : ""} eliminada${count > 1 ? "s" : ""}.`, "success");
      this._seleccionados.clear();
      this.render();
    };
    document.getElementById("modalBtnCancelar").onclick = () => modal.classList.remove("show");
  }
};

// ===== MODAL VER PERSONA (detalle) =====
function verPersona(id) {
  const persona = personas.find((p) => p.id === id);
  if (!persona) return;
  verPersonaIdActual = id;

  document.getElementById("verPersonaNombre").textContent = persona.nombre;

  const badgeClass = persona.estado === "Activo" ? "badge-activo" : "badge-desertor";

  // Lista de documentos con estado
  const documentos = [
    { key: "fichaIngreso", label: "Ficha de Ingreso" },
    { key: "fotocopiaDni", label: "Fotocopia del DNI" },
    { key: "fotocopiaPartida", label: "Fotocopia de la partida de nacimiento" },
    { key: "certificadoPrimaria", label: "Certificado de Primaria" },
    { key: "analiticoSecundario", label: "Analítico de secundario incompleto" }
  ];

  const docsHTML = documentos.map(d => {
    const tiene = !!persona[d.key];
    return `
      <div class="doc-item ${tiene ? 'doc-ok' : 'doc-pending'}">
        <span class="doc-icon">${tiene ? '&#10003;' : '&#10007;'}</span>
        <span class="doc-label">${d.label}</span>
      </div>`;
  }).join("");

  // Log de actividad
  const log = persona.log || [];
  let logHTML;
  if (log.length > 0) {
    logHTML = log.slice().reverse().map(l => `
      <div class="log-entry">
        <span class="log-date">${formatearFechaHora(l.fecha)}</span>
        <span class="log-action">${escaparHTML(l.accion)}</span>
      </div>`).join("");
  } else {
    logHTML = '<p class="log-empty">Sin registros de cambios.</p>';
  }

  document.getElementById("verPersonaBody").innerHTML = `
    <div class="detail-grid">
      <div class="detail-item full-width">
        <div class="detail-label">DNI</div>
        <div class="detail-value">${escaparHTML(persona.dni || "-")}</div>
      </div>
    </div>
    <div class="form-separator"></div>
    <div class="detail-label" style="margin-bottom:8px;">Documentación</div>
    <div class="documentos-list">${docsHTML}</div>
    <div class="form-separator"></div>
    <div class="detail-grid">
      <div class="detail-item full-width">
        <div class="detail-label">Estado</div>
        <div class="detail-value"><span class="badge ${badgeClass}">${escaparHTML(persona.estado || "Desertor/a")}</span></div>
      </div>
      <div class="detail-item full-width">
        <div class="detail-label">Observaciones</div>
        <div class="detail-value">${escaparHTML(persona.observaciones || "Sin observaciones.")}</div>
      </div>
    </div>
    <div class="activity-log">
      <div class="log-title">Historial</div>
      ${logHTML}
    </div>
  `;

  document.getElementById("modalVerPersona").classList.add("show");
}

function cerrarModalVerPersona() {
  document.getElementById("modalVerPersona").classList.remove("show");
  verPersonaIdActual = null;
}

function editarDesdeVista() {
  const id = verPersonaIdActual;
  cerrarModalVerPersona();
  setTimeout(() => abrirModalPersona(id), 200);
}

function eliminarDesdeVista() {
  const id = verPersonaIdActual;
  cerrarModalVerPersona();
  setTimeout(() => confirmarEliminar(id), 200);
}

// ===== MODAL PERSONA (agregar/editar) =====
function abrirModalPersona(id) {
  const modal = document.getElementById("modalPersona");
  reiniciarFormulario();

  if (id) {
    const persona = personas.find((p) => p.id === id);
    if (!persona) return;
    personaEditandoId = id;
    document.getElementById("modalPersonaTitulo").textContent = "Editar Persona";
    document.getElementById("btnGuardar").textContent = "Actualizar";
    document.getElementById("personaId").value = id;
    document.getElementById("nombre").value = persona.nombre || "";
    document.getElementById("dni").value = persona.dni || "";
    document.getElementById("fichaIngreso").checked = !!persona.fichaIngreso;
    document.getElementById("fotocopiaDni").checked = !!persona.fotocopiaDni;
    document.getElementById("fotocopiaPartida").checked = !!persona.fotocopiaPartida;
    document.getElementById("certificadoPrimaria").checked = !!persona.certificadoPrimaria;
    document.getElementById("analiticoSecundario").checked = !!persona.analiticoSecundario;
    document.getElementById("estado").value = persona.estado || "Desertor/a";
    document.getElementById("observaciones").value = persona.observaciones || "";
  } else {
    personaEditandoId = null;
    document.getElementById("modalPersonaTitulo").textContent = "Agregar Persona";
    document.getElementById("btnGuardar").textContent = "Guardar";
  }

  modal.classList.add("show");
}

function cerrarModalPersona() {
  document.getElementById("modalPersona").classList.remove("show");
  reiniciarFormulario();
}

function editarPersona(id) {
  abrirModalPersona(id);
}

// ===== FORMULARIO =====
function reiniciarFormulario() {
  document.getElementById("formPersona").reset();
  document.getElementById("personaId").value = "";
  document.getElementById("estado").value = "Desertor/a";
  personaEditandoId = null;
}

function guardarPersona(event) {
  event.preventDefault();

  const datos = {
    nombre: document.getElementById("nombre").value.trim(),
    dni: document.getElementById("dni").value.trim(),
    fichaIngreso: document.getElementById("fichaIngreso").checked,
    fotocopiaDni: document.getElementById("fotocopiaDni").checked,
    fotocopiaPartida: document.getElementById("fotocopiaPartida").checked,
    certificadoPrimaria: document.getElementById("certificadoPrimaria").checked,
    analiticoSecundario: document.getElementById("analiticoSecundario").checked,
    estado: document.getElementById("estado").value,
    observaciones: document.getElementById("observaciones").value.trim()
  };

  if (personaEditandoId) {
    // Modo edición: generar log de cambios
    const personaActual = personas.find(p => p.id === personaEditandoId);
    const logEntry = generarLogCambios(personaActual, datos);

    datos.updatedAt = new Date().toISOString();

    // Agregar al log existente
    if (logEntry) {
      const logArray = personaActual && personaActual.log ? [...personaActual.log] : [];
      logArray.push({ fecha: new Date().toISOString(), accion: logEntry });
      datos.log = logArray;
    } else {
      datos.log = personaActual ? personaActual.log : [];
    }

    if (db) {
      db.collection("personas").doc(personaEditandoId).update(datos)
        .then(() => { mostrarToast("Persona actualizada.", "success"); cerrarModalPersona(); })
        .catch((err) => { console.error(err); mostrarToast("Error al actualizar.", "error"); });
    } else {
      const idx = personas.findIndex((p) => p.id === personaEditandoId);
      if (idx !== -1) { personas[idx] = { ...personas[idx], ...datos }; guardarDatosLocales(); }
      mostrarToast("Persona actualizada.", "success"); cerrarModalPersona();
    }
  } else {
    // Modo creación
    datos.createdAt = new Date().toISOString();
    datos.log = [{ fecha: datos.createdAt, accion: "Persona creada" }];

    if (db) {
      db.collection("personas").add(datos)
        .then(() => { mostrarToast("Persona registrada.", "success"); cerrarModalPersona(); })
        .catch((err) => { console.error(err); mostrarToast("Error al registrar.", "error"); });
    } else {
      datos.id = "local_" + Date.now();
      personas.push(datos);
      guardarDatosLocales();
      mostrarToast("Persona registrada.", "success"); cerrarModalPersona();
    }
  }
}

// ===== LOG DE CAMBIOS =====
function generarLogCambios(viejo, nuevo) {
  if (!viejo) return "Persona creada";

  const campos = {
    nombre: "Nombre",
    dni: "DNI",
    fichaIngreso: "Ficha de Ingreso",
    fotocopiaDni: "Fotocopia del DNI",
    fotocopiaPartida: "Partida de nacimiento",
    certificadoPrimaria: "Certificado de Primaria",
    analiticoSecundario: "Analítico secundario",
    estado: "Estado",
    observaciones: "Observaciones"
  };

  const cambios = [];
  for (const [key, label] of Object.entries(campos)) {
    const valViejo = viejo[key];
    const valNuevo = nuevo[key];

    if (JSON.stringify(valViejo) !== JSON.stringify(valNuevo)) {
      if (typeof valNuevo === "boolean") {
        cambios.push(`${label}: ${valNuevo ? "Presente" : "Pendiente"}`);
      } else {
        const vStr = (valViejo !== undefined && valViejo !== "") ? String(valViejo) : "(vacío)";
        const nStr = (valNuevo !== undefined && valNuevo !== "") ? String(valNuevo) : "(vacío)";
        cambios.push(`${label}: ${vStr} → ${nStr}`);
      }
    }
  }

  if (cambios.length === 0) return null;
  return "Modificado: " + cambios.join(", ");
}

// ===== ELIMINAR =====
function confirmarEliminar(id) {
  const persona = personas.find((p) => p.id === id);
  if (!persona) return;

  const modal = document.getElementById("modalConfirmar");
  document.getElementById("modalMensaje").textContent =
    `¿Estás seguro de eliminar a "${persona.nombre}"?`;

  modal.classList.add("show");

  document.getElementById("modalBtnConfirmar").onclick = () => {
    eliminarPersona(id);
    modal.classList.remove("show");
  };

  document.getElementById("modalBtnCancelar").onclick = () => {
    modal.classList.remove("show");
  };
}

function eliminarPersona(id) {
  if (db) {
    db.collection("personas").doc(id).delete()
      .then(() => { mostrarToast("Persona eliminada.", "success"); PersonasTabla.render(); })
      .catch((err) => { console.error(err); mostrarToast("Error al eliminar.", "error"); });
  } else {
    personas = personas.filter((p) => p.id !== id);
    guardarDatosLocales();
    PersonasTabla.render();
    mostrarToast("Persona eliminada.", "success");
  }
}

// ===== MENÚ MOBILE =====
function iniciarMenuMobile() {
  const toggle = document.getElementById("menuToggle");
  const overlay = document.getElementById("overlay");

  toggle.addEventListener("click", () => {
    document.getElementById("sidebar").classList.toggle("open");
    overlay.classList.toggle("show");
  });

  overlay.addEventListener("click", cerrarMenuMobile);
}

function cerrarMenuMobile() {
  document.getElementById("sidebar").classList.remove("open");
  document.getElementById("overlay").classList.remove("show");
}

// ===== TOAST =====
function mostrarToast(mensaje, tipo) {
  const toast = document.getElementById("toast");
  toast.textContent = mensaje;
  toast.className = "toast show";
  if (tipo) toast.classList.add(tipo);

  setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}

// ===== UTILIDADES =====
function escaparHTML(texto) {
  if (!texto) return "";
  const div = document.createElement("div");
  div.textContent = texto;
  return div.innerHTML;
}

function formatearFecha(fechaStr) {
  if (!fechaStr) return "-";
  const [year, month, day] = fechaStr.split("-");
  return `${day}/${month}/${year}`;
}

function formatearFechaHora(fechaStr) {
  if (!fechaStr) return "-";
  const fecha = new Date(fechaStr);
  const dia = String(fecha.getDate()).padStart(2, "0");
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const anio = fecha.getFullYear();
  const hora = String(fecha.getHours()).padStart(2, "0");
  const min = String(fecha.getMinutes()).padStart(2, "0");
  return `${dia}/${mes}/${anio} ${hora}:${min}`;
}
