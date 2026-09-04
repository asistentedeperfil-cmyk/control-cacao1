# Sistema de Control de Cacao FUMISA

Aplicación web para gestionar proveedores, compras, lotes, inventario, reportes e importación desde Excel.

## Uso local

1. Descargue o clone el repositorio.
2. Abra `index.html` en un navegador moderno.
3. Los datos se guardan únicamente en el almacenamiento local del navegador.

## Publicación en Netlify

El repositorio incluye `netlify.toml`. En Netlify, importe este repositorio y publique la rama `main`; no requiere comando de compilación.

## Importante sobre seguridad y datos

Esta versión es una aplicación estática y de un solo navegador. La autenticación y los datos residen en `localStorage`, por lo que no debe considerarse un sistema multiusuario seguro ni usarse para información sensible. Para operación empresarial se requiere un backend con base de datos, autenticación y autorización aplicadas en el servidor.

## Estructura

- `index.html`: interfaz principal.
- `css/styles.css`: estilos.
- `js/db.js`: almacenamiento y reglas de datos.
- `js/auth.js`: sesión y roles locales.
- `js/compras.js`, `js/lotes.js`, `js/proveedores.js`: módulos operativos.
- `js/reportes.js`: reportes.
- `js/importar.js`: importación de CSV y Excel.
- `js/app.js`: inicialización y navegación.
