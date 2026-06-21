# J.A.R.V.I.S · Móvil (PWA)

Front-end **standalone** del asistente J.A.R.V.I.S. para el móvil. Funciona con el **PC apagado**:
el teléfono habla **directamente** con MiniMax (que está en la nube) desde el navegador.

- **Chat + voz** (dictado y voz del navegador, Web Speech API).
- **Instalable** como app (Añadir a pantalla de inicio → PWA a pantalla completa).
- Solo conversación; el control del PC/archivos necesita el JARVIS de escritorio por WiFi.

## Seguridad

- La **API key de MiniMax** se introduce una sola vez en la app y se guarda **solo en el móvil**
  (`localStorage`). **Nunca** está en este código ni se sube a ningún sitio.
- Este repo es público **solo** para poder servir la app por GitHub Pages; **no** contiene secretos.
  El código principal de JARVIS vive en un repo privado aparte.

## Uso

1. Abre la URL de GitHub Pages en el móvil.
2. Pulsa el engranaje ⚙ y pega tu API key de MiniMax.
3. Habla o escribe.
