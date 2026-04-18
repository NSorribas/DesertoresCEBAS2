/* ============================================================
   Desertores CEBAS - SPA (HTML/CSS/JS puro + Firebase)
   ============================================================ */

// ===== CONFIGURACIÓN FIREBASE =====
// Reemplazar con los datos reales de tu proyecto Firebase
const firebaseConfig = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};

// ===== VARIABLES GLOBALES =====
let db = null;             // Referencia a Firestore
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
    escucharPersonas();
    console.log("Firebase conectado.");
  } else {
    console.warn("Firebase no configurado. Usando datos locales (localStorage).");
    cargarDatosLocales();
    renderizarInicio();
  }
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
        renderizarInicio();
        // Si estamos en la página de personas, actualizar tabla
        const paginaActual = obtenerPaginaActual();
        if (paginaActual === "personas") {
          renderizarTabla(personas);
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
  if (pagina === "inicio") {
    renderizarInicio();
  } else if (pagina === "personas") {
    renderizarTabla(personas);
    reiniciarFormulario();
  } else if (pagina === "registrar") {
    reiniciarFormulario();
  }

  // Cerrar menú mobile
  cerrarMenuMobile();
}

function obtenerPaginaActual() {
  const hash = (window.location.hash || "#/").replace("#/", "");
  return hash || "inicio";
}

function navegarA(ruta) {
  window.location.hash = ruta;
}

// ===== DASHBOARD / INICIO =====
function renderizarInicio() {
  document.getElementById("statTotal").textContent = personas.length;
  document.getElementById("statActivos").textContent = personas.filter(p => p.estado === "Activo").length;
  document.getElementById("statInactivos").textContent = personas.filter(p => p.estado === "Inactivo").length;
}

// ===== TABLA DE PERSONAS =====
function renderizarTabla(lista) {
  const tbody = document.getElementById("tbodyPersonas");
  const sinResultados = document.getElementById("sinResultados");

  if (lista.length === 0) {
    tbody.innerHTML = "";
    sinResultados.style.display = "block";
    return;
  }

  sinResultados.style.display = "none";

  tbody.innerHTML = lista
    .map((p) => {
      const edad = calcularEdad(p.fechaNacimiento);
      const badgeClass = p.estado === "Activo" ? "badge-activo"
                       : p.estado === "Inactivo" ? "badge-inactivo"
                       : "badge-egresado";

      return `
        <tr>
          <td>${escaparHTML(p.nombre)}</td>
          <td>${escaparHTML(p.dni)}</td>
          <td>${edad}</td>
          <td>${escaparHTML(p.curso || "-")}</td>
          <td><span class="badge ${badgeClass}">${escaparHTML(p.estado || "Activo")}</span></td>
          <td>
            <div class="actions-cell">
              <button class="btn btn-primary btn-sm" onclick="editarPersona('${p.id}')">Editar</button>
              <button class="btn btn-danger btn-sm" onclick="confirmarEliminar('${p.id}')">Eliminar</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

function filtrarPersonas() {
  const query = document.getElementById("buscarPersona").value.toLowerCase().trim();
  const filtradas = personas.filter(
    (p) =>
      p.nombre.toLowerCase().includes(query) ||
      p.dni.toLowerCase().includes(query) ||
      (p.curso && p.curso.toLowerCase().includes(query))
  );
  renderizarTabla(filtradas);
}

// ===== FORMULARIO =====
function reiniciarFormulario() {
  document.getElementById("formPersona").reset();
  document.getElementById("personaId").value = "";
  personaEditandoId = null;
  document.getElementById("tituloFormulario").textContent = "Registrar Persona";
  document.getElementById("btnGuardar").textContent = "Guardar";
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
    // EDITAR
    datos.updatedAt = new Date().toISOString();
    if (db) {
      db.collection("personas").doc(personaEditandoId).update(datos)
        .then(() => {
          mostrarToast("Persona actualizada correctamente.", "success");
          navegarA("/personas");
        })
        .catch((err) => {
          console.error(err);
          mostrarToast("Error al actualizar.", "error");
        });
    } else {
      // Local
      const idx = personas.findIndex((p) => p.id === personaEditandoId);
      if (idx !== -1) {
        personas[idx] = { ...personas[idx], ...datos };
        guardarDatosLocales();
        mostrarToast("Persona actualizada correctamente.", "success");
        navegarA("/personas");
      }
    }
  } else {
    // CREAR
    datos.createdAt = new Date().toISOString();
    if (db) {
      db.collection("personas").add(datos)
        .then(() => {
          mostrarToast("Persona registrada correctamente.", "success");
          navegarA("/personas");
        })
        .catch((err) => {
          console.error(err);
          mostrarToast("Error al registrar.", "error");
        });
    } else {
      // Local
      datos.id = "local_" + Date.now();
      personas.push(datos);
      guardarDatosLocales();
      mostrarToast("Persona registrada correctamente.", "success");
      navegarA("/personas");
    }
  }
}

function editarPersona(id) {
  const persona = personas.find((p) => p.id === id);
  if (!persona) return;

  personaEditandoId = id;
  document.getElementById("tituloFormulario").textContent = "Editar Persona";
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

  navegarA("/registrar");
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
      .then(() => {
        mostrarToast("Persona eliminada.", "success");
      })
      .catch((err) => {
        console.error(err);
        mostrarToast("Error al eliminar.", "error");
      });
  } else {
    personas = personas.filter((p) => p.id !== id);
    guardarDatosLocales();
    renderizarTabla(personas);
    renderizarInicio();
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
