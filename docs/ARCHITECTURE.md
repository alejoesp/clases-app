# Cómo está organizada Clases App

Clases App funciona completamente en el navegador. No hay una API ni una base de datos externa: la información se guarda en LocalStorage.

## Flujo general

```text
Interfaz
   │
   ▼
eventos de usuario
   │
   ▼
app.js
   │
   ├── modifica el estado
   ├── guarda en LocalStorage
   └── vuelve a dibujar la interfaz
```

## `index.html`

Tiene la estructura de las distintas pantallas y los formularios:

- resumen del día;
- alumnos;
- agenda;
- calendario;
- caja;
- gestión;
- modales para cargar o editar información.

La mayor parte del contenido dinámico se completa después desde JavaScript.

## `app.js`

Acá está casi toda la lógica de la aplicación.

Se ocupa de:
- cargar y guardar datos;
- crear y editar alumnos;
- registrar horarios;
- guardar asistencias y reprogramaciones;
- registrar pagos;
- manejar combos de horas;
- calcular saldos;
- armar el calendario;
- actualizar las distintas vistas;
- exportar información.

## Datos

El estado principal tiene cinco grupos:

```js
{
  students: [],
  schedules: [],
  classes: [],
  payments: [],
  combos: []
}
```

Cuando cambia algo, el estado se convierte a JSON y se guarda en LocalStorage.

Eso permite usar la app sin servidor, aunque también significa que los datos quedan ligados al navegador donde se cargaron.

## PWA

`manifest.webmanifest` contiene los datos necesarios para instalar la aplicación.

`sw.js` se ocupa de guardar en caché los archivos principales:
- `index.html`
- `styles.css`
- `app.js`
- `manifest.webmanifest`
- `icon.svg`

Cuando cambia la versión de la caché, el Service Worker elimina las anteriores.

## Servidor local

`server.mjs` es solamente un servidor HTTP pequeño para levantar el proyecto de forma local.

Está hecho con módulos nativos de Node.js, así que no hace falta instalar Express ni otras dependencias.

## Cosas a tener en cuenta

La aplicación está hecha a propósito sin backend. Para el uso actual alcanza, pero por esa misma razón:
- no sincroniza datos entre dispositivos;
- no tiene cuentas de usuario;
- si se borran los datos del navegador se puede perder la información;
- `app.js` terminó concentrando bastante lógica en un solo archivo.

Si el proyecto creciera, lo primero que separaría serían alumnos, pagos, agenda y calendario en módulos distintos.
