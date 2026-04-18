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
let db = null;             // Referencia a Firestore
let auth = null;           // Referencia a Firebase Auth
let usuarioActual = null;  // Usuario logueado
let personas = [];         // Array local de personas (cache)
let personaEditandoId = null;

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

function mostrarTabAuth(tab) {
  document.getElementById("tabLogin").classList.toggle("active", tab === "login");
  document.getElementById("tabRegistro").classList.toggle("active", tab === "registro");
  document.getElementById("formLogin").style.display = tab === "login" ? "block" : "none";
  document.getElementById("formRegistro").style.display = tab === "registro" ? "block" : "none";
  // Limpiar errores
  document.getElementById("loginError").style.display = "none";
  document.getElementById("registroError").style.display = "none";
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

function registrarUsuario(event) {
  event.preventDefault();
  const nombre = document.getElementById("regNombre").value.trim();
  const email = document.getElementById("regEmail").value.trim();
  const password = document.getElementById("regPassword").value;
  const passwordConfirm = document.getElementById("regPasswordConfirm").value;
  document.getElementById("registroError").style.display = "none";

  if (password !== passwordConfirm) {
    mostrarAuthError("registroError", "Las contraseñas no coinciden.");
    return;
  }

  auth.createUserWithEmailAndPassword(email, password)
    .then((cred) => {
      // Actualizar el displayName del usuario
      return cred.user.updateProfile({ displayName: nombre });
    })
    .then(() => {
      mostrarToast("Cuenta creada correctamente.", "success");
    })
    .catch((err) => {
      const msg = traducirErrorAuth(err.code);
      mostrarAuthError("registroError", msg);
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
        PersonasTabla.actualizarFiltroCursos();
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
  manejarRuta(); // Renderizar ruta inicial
}

function manejarRuta() {
  const hash = window.location.hash || "#/";
  const pagina = obtenerPaginaActual();

  // Ocultar todas las páginas
  document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));

  // Mostrar la página correspondiente
  const pageEl = document.getElementById(`page-${pagina}`);
  if (pageEl) {
    pageEl.classList.add("active");
  }

  // Actualizar nav activo
  document.querySelectorAll(".nav-link").forEach((link) => {
    link.classList.remove("active");
    if (link.getAttribute("data-page") === pagina) {
      link.classList.add("active");
    }
  });

  // Acciones por página
  if (pagina === "personas") {
    PersonasTabla.render();
  }

  // Cerrar menú mobile
  cerrarMenuMobile();
}

function obtenerPaginaActual() {
  const hash = (window.location.hash || "#/personas").replace("#/", "");
  return hash || "personas";
}

function navegarA(ruta) {
  window.location.hash = ruta;
}

// ===== PERSONAS TABLA (con paginación, filtros, sort, bulk) =====
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
    const fGenero = document.getElementById("filtroGenero").value;
    const fCurso = document.getElementById("filtroCurso").value;

    let datos = personas.filter((p) => {
      const matchQuery = !query ||
        (p.nombre || "").toLowerCase().includes(query) ||
        (p.dni || "").toLowerCase().includes(query) ||
        (p.curso || "").toLowerCase().includes(query);
      const matchEstado = !fEstado || p.estado === fEstado;
      const matchGenero = !fGenero || p.genero === fGenero;
      const matchCurso = !fCurso || p.curso === fCurso;
      return matchQuery && matchEstado && matchGenero && matchCurso;
    });

    // Ordenar
    const campo = this._sortField;
    const dir = this._sortDir === "asc" ? 1 : -1;
    datos.sort((a, b) => {
      let valA, valB;
      if (campo === "edad") {
        valA = calcularEdad(a.fechaNacimiento);
        valB = calcularEdad(b.fechaNacimiento);
        if (valA === "-" && valB === "-") return 0;
        if (valA === "-") return 1;
        if (valB === "-") return -1;
        return (valA - valB) * dir;
      } else {
        valA = (a[campo] || "").toString().toLowerCase();
        valB = (b[campo] || "").toString().toLowerCase();
      }
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

      return `
        <tr data-id="${p.id}" onclick="verPersona('${p.id}')">
          <td style="text-align:center" onclick="event.stopPropagation()">
            <label class="checkbox-wrap">
              <input type="checkbox" ${checked} onchange="PersonasTabla.toggleSeleccion('${p.id}', this.checked)">
            </label>
          </td>
          <td>${escaparHTML(p.nombre)}</td>
          <td>${escaparHTML(p.dni)}</td>
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

    // Rango de páginas
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

  actualizarFiltroCursos() {
    const select = document.getElementById("filtroCurso");
    const current = select.value;
    const cursos = [...new Set(personas.map(p => p.curso).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));
    select.innerHTML = '<option value="">Todos los cursos</option>' +
      cursos.map(c => `<option value="${escaparHTML(c)}">${escaparHTML(c)}</option>`).join("");
    select.value = current;
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

// ===== MODAL VER PERSONA (detalle) =====\nlet verPersonaIdActual = null;\n\nfunction verPersona(id) {\n  const persona = personas.find((p) => p.id === id);\n  if (!persona) return;\n  verPersonaIdActual = id;\n\n  document.getElementById(\"verPersonaNombre\").textContent = persona.nombre;\n\n  const edad = calcularEdad(persona.fechaNacimiento);\n  const badgeClass = persona.estado === \"Activo\" ? \"badge-activo\"\n                   : persona.estado === \"Inactivo\" ? \"badge-inactivo\"\n                   : \"badge-egresado\";\n\n  document.getElementById(\"verPersonaBody\").innerHTML = `\n    <div class=\"detail-grid\">\n      <div class=\"detail-item\">\n        <div class=\"detail-label\">DNI</div>\n        <div class=\"detail-value\">${escaparHTML(persona.dni || \"-\")}</div>\n      </div>\n      <div class=\"detail-item\">\n        <div class=\"detail-label\">Edad</div>\n        <div class=\"detail-value\">${edad}</div>\n      </div>\n      <div class=\"detail-item\">\n        <div class=\"detail-label\">Fecha de nacimiento</div>\n        <div class=\"detail-value\">${persona.fechaNacimiento ? formatearFecha(persona.fechaNacimiento) : \"-\"}</div>\n      </div>\n      <div class=\"detail-item\">\n        <div class=\"detail-label\">Género</div>\n        <div class=\"detail-value\">${escaparHTML(persona.genero || \"-\")}</div>\n      </div>\n      <div class=\"detail-item\">\n        <div class=\"detail-label\">Teléfono</div>\n        <div class=\"detail-value\">${escaparHTML(persona.telefono || \"-\")}</div>\n      </div>\n      <div class=\"detail-item\">\n        <div class=\"detail-label\">Email</div>\n        <div class=\"detail-value\">${escaparHTML(persona.email || \"-\")}</div>\n      </div>\n      <div class=\"detail-item full-width\">\n        <div class=\"detail-label\">Dirección</div>\n        <div class=\"detail-value\">${escaparHTML(persona.direccion || \"-\")}</div>\n      </div>\n      <div class=\"detail-item full-width\">\n        <div class=\"detail-label\">Tutor / Apoderado</div>\n        <div class=\"detail-value\">${escaparHTML(persona.tutor || \"-\")}</div>\n      </div>\n      <div class=\"detail-item\">\n        <div class=\"detail-label\">Curso / División</div>\n        <div class=\"detail-value\">${escaparHTML(persona.curso || \"-\")}</div>\n      </div>\n      <div class=\"detail-item\">\n        <div class=\"detail-label\">Estado</div>\n        <div class=\"detail-value\"><span class=\"badge ${badgeClass}\">${escaparHTML(persona.estado || \"Activo\")}</span></div>\n      </div>\n      <div class=\"detail-item full-width\">\n        <div class=\"detail-label\">Observaciones</div>\n        <div class=\"detail-value\">${escaparHTML(persona.observaciones || \"-\")}</div>\n      </div>\n    </div>\n  `;\n\n  document.getElementById(\"modalVerPersona\").classList.add(\"show\");\n}\n\nfunction cerrarModalVerPersona() {\n  document.getElementById(\"modalVerPersona\").classList.remove(\"show\");\n  verPersonaIdActual = null;\n}\n\nfunction editarDesdeVista() {\n  const id = verPersonaIdActual;\n  cerrarModalVerPersona();\n setTimeout(() => abrirModalPersona(id), 200);\n}\n\nfunction eliminarDesdeVista() {\n  const id = verPersonaIdActual;\n  cerrarModalVerPersona();\n setTimeout(() => confirmarEliminar(id), 200);\n}\n\n// ===== MODAL PERSONA (agregar/editar) =====
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
    document.getElementById("fechaNacimiento").value = persona.fechaNacimiento || "";
    document.getElementById("genero").value = persona.genero || "";
    document.getElementById("telefono").value = persona.telefono || "";
    document.getElementById("email").value = persona.email || "";
    document.getElementById("direccion").value = persona.direccion || "";
    document.getElementById("tutor").value = persona.tutor || "";
    document.getElementById("curso").value = persona.curso || "";
    document.getElementById("estado").value = persona.estado || "Activo";
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

// Redirigir editarPersona al modal
function editarPersona(id) {
  abrirModalPersona(id);
}

// ===== FORMULARIO =====
function reiniciarFormulario() {
  document.getElementById("formPersona").reset();
  document.getElementById("personaId").value = "";
  personaEditandoId = null;
}

function guardarPersona(event) {
  event.preventDefault();

  const datos = {
    nombre: document.getElementById("nombre").value.trim(),
    dni: document.getElementById("dni").value.trim(),
    fechaNacimiento: document.getElementById("fechaNacimiento").value,
    genero: document.getElementById("genero").value,
    telefono: document.getElementById("telefono").value.trim(),
    email: document.getElementById("email").value.trim(),
    direccion: document.getElementById("direccion").value.trim(),
    tutor: document.getElementById("tutor").value.trim(),
    curso: document.getElementById("curso").value.trim(),
    estado: document.getElementById("estado").value,
    observaciones: document.getElementById("observaciones").value.trim(),
    updatedAt: new Date().toISOString()
  };

  if (personaEditandoId) {
    datos.updatedAt = new Date().toISOString();
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
    datos.createdAt = new Date().toISOString();
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
function calcularEdad(fechaNacimiento) {
  if (!fechaNacimiento) return "-";
  const hoy = new Date();
  const nacimiento = new Date(fechaNacimiento + "T00:00:00");
  let edad = hoy.getFullYear() - nacimiento.getFullYear();
  const m = hoy.getMonth() - nacimiento.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nacimiento.getDate())) {
    edad--;
  }
  return edad;
}

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
