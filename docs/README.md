# Mis Enlaces — PWA

App móvil instalable que lee tus categorías (`noticias.json`, `recetas.json`,
etc.) directamente del mismo repositorio de GitHub que alimenta la extensión
"Incluir enlace en...". Sin backend propio: GitHub es la fuente de datos.

## Cómo funciona

- Lee cada categoría desde
  `https://raw.githubusercontent.com/<usuario>/<repo>/<rama>/<archivo>.json`
- Requiere que el **repositorio sea público** (o accesible sin autenticación)
  — `raw.githubusercontent.com` no admite tokens desde el navegador de forma
  simple. Si tu repo es privado, dímelo y adaptamos la app para pedir un
  token (con más fricción de seguridad).
- Guarda en caché los datos y el "esqueleto" de la app (service worker), así
  que **funciona sin conexión** mostrando la última versión descargada.
- Botón ↻ para forzar una actualización inmediata; si no, se refresca solo
  al reabrir la app (estrategia stale-while-revalidate).

## 1. Despliega los archivos (necesitas HTTPS para que sea instalable)

La forma más simple, ya que todo vive en GitHub: usa **GitHub Pages**.

1. Sube esta carpeta (`index.html`, `styles.css`, `app.js`, `sw.js`,
   `manifest.webmanifest`, `icons/`) a un repositorio — puede ser el mismo
   `mis-enlaces` (en una carpeta `/docs`) o uno nuevo, p. ej. `enlaces-app`.
2. Repositorio → **Settings** → **Pages** → Source: rama `main`, carpeta
   `/docs` (o `/root` si usas repo aparte).
3. En unos minutos tendrás la app en
   `https://<usuario>.github.io/<repo>/`.

## 2. Ábrela en el móvil y configúrala

1. Abre esa URL en Chrome/Firefox/Safari del móvil.
2. Se abrirá el panel de Ajustes automáticamente la primera vez: introduce
   tu usuario de GitHub, el repo **donde guarda enlaces la extensión**, la
   rama, y las mismas categorías (nombre + archivo) que configuraste allí.
3. Guarda. La app cargará los enlaces ya guardados.

## 3. Instálala en la pantalla de inicio

- **Android/Chrome**: aparecerá un aviso "Instala esta app..." — pulsa
  Instalar. También puedes hacerlo desde el menú ⋮ → "Añadir a pantalla de
  inicio".
- **iPhone/Safari**: Safari no dispara el aviso automático — usa el botón
  Compartir → **Añadir a pantalla de inicio**.

## Flujo completo, de principio a fin

1. Navegas en el PC con Firefox → clic derecho en un enlace → "Incluir
   enlace en..." → categoría → se guarda en GitHub.
2. Abres la app en el móvil → pulsas ↻ (o simplemente la reabres) → el
   enlace aparece en su categoría.
3. Sin conexión, sigues viendo la última copia guardada en el móvil.

## Próximas mejoras posibles

- Notificación push real en cuanto se guarda un enlace nuevo (GitHub Action
  en cada `push` → Firebase Cloud Messaging).
- Buscador y favoritos dentro de la app.
- Soporte para repos privados (pidiendo un token limitado, guardado solo en
  el propio móvil).
