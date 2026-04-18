<p align="center">
  <img src="assets/logo-cebas48.png" alt="Logo CEBAS" width="96" height="96">
</p>

<h1 align="center">Desertores CEBAS</h1>

<p align="center">
  Registro y seguimiento de estudiantes — CEBAS
</p>

<p align="center">
  <img src="https://img.shields.io/badge/HTML5-E34F26?style=flat&logo=html5&logoColor=white" alt="HTML5">
  <img src="https://img.shields.io/badge/CSS3-1572B6?style=flat&logo=css3&logoColor=white" alt="CSS3">
  <img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=flat&logo=javascript&logoColor=black" alt="JavaScript">
  <img src="https://img.shields.io/badge/Firebase-FFCA28?style=flat&logo=firebase&logoColor=black" alt="Firebase">
</p>

---

## Descripcion

Sistema web para el registro y seguimiento de estudiantes desertores del **CEBAS** (Centro de Educación Básica para Adultos). Permite gestionar datos personales, documentacion presentada, estado de cada estudiante y lleva un historial automatico de todos los cambios realizados.

Construido como una **SPA (Single Page Application)** con HTML, CSS y JavaScript puro — sin frameworks ni dependencias de compilacion — desplegado en **GitHub Pages** con **Firebase** como backend (Auth + Firestore).

## Funcionalidades

- **Autenticacion** con Firebase Auth (login protegido, sesiones persistentes)
- **CRUD completo** de personas con modales (agregar, editar, eliminar)
- **Modal de detalle** con vista rapida de toda la informacion por persona
- **Toggles de documentacion** — control de entrega de documentos (Ficha de Ingreso, DNI, Partida, Primaria, Analitico)
- **Estados** — Desertor/a (por defecto) y Activo, con badges de colores
- **Historial de cambios** automatico (log con fecha y accion por cada modificacion)
- **Busqueda** con debounce por nombre o DNI
- **Filtros** por estado
- **Ordenamiento** por columnas (Nombre, DNI)
- **Paginacion** (10 items por pagina)
- **Seleccion multiple** y eliminacion en lote
- **Interfaz glassmorphism** con fuente Montserrat
- **100% responsive** — mobile, tablet y desktop

## Estructura del Proyecto

```
DesertoresCEBAS2/
├── index.html              # SPA principal
├── assets/
│   ├── app.js              # Logica de la app (router, Firebase, CRUD, tabla)
│   ├── style.css           # Estilos (glassmorphism, responsive, componentes)
│   └── logo-cebas48.png    # Logo del sistema
└── README.md
```

## Stack Tecnologico

| Tecnologia | Uso |
|---|---|
| HTML5 | Estructura de la SPA |
| CSS3 | Estilos, glassmorphism, responsive design |
| JavaScript (vanilla) | Logica, router, Firebase SDK |
| Firebase Auth | Autenticacion de usuarios |
| Firebase Firestore | Base de datos en tiempo real |
| GitHub Pages | Hosting estatico |

## Deploy

La app esta desplegada en GitHub Pages. Los cambios en la rama `main` se publican automaticamente.

Firebase esta configurado con el SDK compat (v11.9.1) cargado directamente desde CDN, sin necesidad de bundler.

## Configuracion de Firebase

1. Crear un proyecto en [Firebase Console](https://console.firebase.google.com/)
2. Habilitar **Authentication** → Email/Password
3. Crear base de datos **Firestore**
4. Crear las cuentas de usuario desde Firebase Console (no hay registro publico)
5. Configurar reglas de seguridad en Firestore:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /personas/{id} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## Licencia

Proyecto privado — CEBAS.
