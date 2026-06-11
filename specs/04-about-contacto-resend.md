# 04 — Página About y formulario de contacto con Resend

**Estado:** Aprobado
**Dependencias:** [01-pantallas-visuales](01-pantallas-visuales.md) (Nav, layout, globals.css ya portados)
**Fecha:** 2026-06-10

**Objetivo:** Portar la pantalla "Acerca de" de `references/templates/home-about/about.jsx` a una ruta real `/about` en Next.js, con un formulario de contacto funcional que envía el mensaje por correo electrónico usando Resend.

## Alcance

**Incluye:**

- Ruta `/about` (`app/about/page.tsx`, client component) adaptada de `references/templates/home-about/about.jsx`:
  - Sección hero "ACERCA DE ARCADE VAULT" con misión y los 3 highlights (HEART, BROWSER, PLANT) con sus iconos SVG.
  - Divisor animado (`about-divider`) con efecto reveal.
  - Sección de contacto con intro/tips y formulario (nombre, correo, mensaje).
  - Animación `reveal` con `IntersectionObserver` (igual que en Home).
- Validación cliente existente: si nombre, correo o mensaje están vacíos, se aplica el efecto `shake` y no se envía.
- Endpoint `app/api/contact/route.ts` (Route Handler POST) que recibe `{ name, email, msg }` y usa el SDK de Resend para enviar un correo a `frank941612@gmail.com`, con `from: onboarding@resend.dev` y `reply_to` configurado al correo del remitente del formulario.
- Estado de envío en el formulario:
  - Botón en estado `ENVIANDO...` (deshabilitado) mientras la petición está en curso.
  - Al recibir respuesta (éxito o fallo HTTP), se muestra siempre la animación `terminal-success` existente (decisión: errores de Resend solo se loguean en servidor, no se exponen al usuario).
- Dependencia `resend` agregada a `package.json`.
- `.env.template`: documenta `RESEND_API_KEY` y `CONTACT_EMAIL_TO` sin valores reales.
- `.env.local` (gitignored): mismas variables con placeholders para que el usuario complete su API key real.
- Estilos: portar de `references/templates/home-about/styles.css` a `app/globals.css` las clases usadas por About/Contact (`about-*`, `contact-*`, `highlight*`, `terminal-success`, `tip*`, etc.) que aún no existen en `globals.css`.
- Agregar el link "Acerca de" → `/about` en `app/components/Nav.tsx` (menú de escritorio y panel móvil), con resaltado de estado activo igual que los demás links.

**No incluye:**

- Verificación de dominio propio en Resend (se usa el remitente sandbox `onboarding@resend.dev`).
- Feedback visual de error en el formulario (queda para un spec futuro si se requiere).
- Rate limiting, captcha o protección anti-spam del endpoint.
- Persistencia de los mensajes de contacto (no se guardan en BD/archivo, solo se envían por correo).
- Autenticación o asociación del mensaje con un usuario logueado.
- Tests automatizados (no hay test runner configurado).
- Cambios a otras rutas/pantallas más allá del Nav.

## Modelo de datos

No se introduce ninguna entidad de dominio nueva (no hay base de datos ni persistencia). Se definen los siguientes contratos:

**Variables de entorno** (`.env.template` y `.env.local`):

```
RESEND_API_KEY=tu_api_key_de_resend_aqui
CONTACT_EMAIL_TO=frank941612@gmail.com
```

**Request del endpoint `POST /api/contact`** (`app/api/contact/route.ts`):

```typescript
interface ContactRequestBody {
  name: string;
  email: string;
  msg: string;
}
```

**Response del endpoint:**

```typescript
// Éxito (200)
interface ContactSuccessResponse {
  ok: true;
}

// Error (400/500) — el cliente lo trata igual que éxito (ver Alcance),
// pero el servidor responde con detalle para los logs
interface ContactErrorResponse {
  ok: false;
  error: string;
}
```

**Llamada a Resend** (dentro del route handler):

```typescript
resend.emails.send({
  from: "Arcade Vault <onboarding@resend.dev>",
  to: process.env.CONTACT_EMAIL_TO!,
  replyTo: email,         // correo ingresado en el formulario
  subject: `[Arcade Vault] Nuevo mensaje de ${name}`,
  text: msg,
});
```

## Plan de implementación

1. **Instalar dependencia `resend`**: `npm install resend`. Sin cambios funcionales todavía.

2. **Configurar variables de entorno**: crear `.env.template` con `RESEND_API_KEY` y `CONTACT_EMAIL_TO` documentadas (sin valores reales) y `.env.local` (gitignored) con placeholders para que el usuario los complete con su API key real de resend.com.

3. **Portar estilos**: copiar a `app/globals.css` las clases `about-*`, `contact-*`, `highlight*`, `hl-icon`, `terminal-success`, `term-*`, `tip*` y `about-divider`/`div-*` desde `references/templates/home-about/styles.css`, evitando duplicar reglas ya existentes (p. ej. `.reveal`, `.kicker`, `.btn`).

4. **Crear `app/api/contact/route.ts`**: Route Handler `POST` que valida el body (`name`, `email`, `msg` no vacíos → 400 si falta alguno), llama a `resend.emails.send(...)` con los datos del modelo, captura cualquier error con `try/catch` y lo loguea con `console.error`, y responde `{ ok: true }` en éxito o `{ ok: false, error }` en fallo (status 500).

5. **Crear `app/about/page.tsx`**: client component adaptado de `about.jsx`. Mantiene `useReveal` (igual patrón que Home), el hero con highlights, el divisor animado y el formulario de contacto controlado con `useState`. El `onSubmit` ahora es `async`: valida campos vacíos (shake), si son válidos pone `loading=true`, hace `fetch("/api/contact", { method: "POST", body: JSON.stringify(form) })`, y al resolver (éxito o error) muestra siempre `terminal-success` con el nombre ingresado, restaurando `loading=false`. El botón muestra "ENVIANDO..." y `disabled` mientras `loading` es `true`.

6. **Agregar link "Acerca de" al Nav**: en `app/components/Nav.tsx`, agregar `Link href="/about"` en el menú de escritorio y en el panel móvil, con clase `active` cuando `pathname === "/about"`, siguiendo el mismo patrón que los demás links.

7. **Verificación final**: `npm run lint` y `npm run build` sin errores; recorrido manual por `/about` comprobando que el hero, highlights, divisor y formulario se vean igual que en `references/templates/home-about/arcade-vault-standalone.html`; probar el envío del formulario (con `RESEND_API_KEY` real del usuario) y confirmar que llega el correo a `frank941612@gmail.com`, y que con campos vacíos se activa el `shake`.

## Criterios de aceptación

- [ ] La ruta `/about` muestra la sección hero "ACERCA DE ARCADE VAULT" con el texto de misión y los 3 highlights (HEART, BROWSER, PLANT) con sus iconos.
- [ ] El divisor animado (`about-divider`) y las animaciones `reveal` funcionan igual que en Home (aparecen al hacer scroll).
- [ ] La sección de contacto muestra la intro, los 3 tips y el formulario con campos NOMBRE, CORREO ELECTRÓNICO y MENSAJE.
- [ ] Si se intenta enviar el formulario con algún campo vacío, se aplica el efecto `shake` y no se envía la petición.
- [ ] Al enviar el formulario con todos los campos completos, el botón cambia a "ENVIANDO..." y queda deshabilitado hasta recibir respuesta.
- [ ] Tras la respuesta (éxito o error), se muestra la animación `terminal-success` con el nombre ingresado, y el botón "ENVIAR OTRO MENSAJE" reinicia el formulario.
- [ ] `POST /api/contact` con un body válido y `RESEND_API_KEY` configurada correctamente envía un correo a `CONTACT_EMAIL_TO` (frank941612@gmail.com) con `reply_to` igual al correo del formulario.
- [ ] Si Resend falla (API key inválida, error de red, etc.), el endpoint responde `{ ok: false, error }` y loguea el error en consola del servidor, sin que el cliente muestre un estado distinto al de éxito.
- [ ] `.env.template` documenta `RESEND_API_KEY` y `CONTACT_EMAIL_TO` sin valores reales; `.env.local` existe con placeholders y está ignorado por git.
- [ ] El Nav muestra el link "Acerca de" → `/about` en escritorio y en el panel móvil, resaltado como activo cuando la ruta actual es `/about`.
- [ ] `npm run lint` y `npm run build` finalizan sin errores.
- [ ] El aspecto visual de `/about` coincide con `references/templates/home-about/arcade-vault-standalone.html` abierto en el navegador.

## Decisiones tomadas y descartadas

- **Resend con remitente sandbox (`onboarding@resend.dev`)**: se descarta exigir un dominio verificado porque el usuario aún no tiene uno configurado en Resend; permite que el envío funcione de inmediato en cuanto se agregue una API key válida. Migrar a un dominio propio quedaría para un spec futuro si se decide.
- **Errores de Resend solo se loguean en servidor, UI siempre muestra éxito**: se descarta agregar un estado de error visual en el formulario por simplicidad; el riesgo es que el usuario crea que su mensaje llegó cuando no fue así, pero se acepta como compromiso para esta primera versión. Se deja anotado como posible mejora futura.
- **`.env.local` con placeholders en vez de pedir la key ahora**: se descarta bloquear el spec/implementación a que el usuario consiga la key de Resend; el proyecto queda funcional en build/lint, y el envío real solo requiere completar `.env.local`.
- **Endpoint propio (`/api/contact`) en vez de llamar a Resend desde el cliente**: se descarta exponer `RESEND_API_KEY` en el bundle del cliente; es una buena práctica de seguridad básica y la única opción viable con el SDK de Resend (requiere entorno servidor).
- **Reutilizar `useReveal` y patrón de animaciones de Home**: se descarta crear una nueva implementación; ya existe el mismo hook/patrón portado en `app/page.tsx` para Home, y About usa exactamente el mismo `IntersectionObserver`.
- **Agregar "Acerca de" al Nav como parte de este spec**: aunque es un cambio fuera de `about.jsx`/`about` en sentido estricto, se incluye porque sin él la ruta `/about` sería inaccesible desde la navegación, dejando la feature incompleta.

## Riesgos identificados

- **Restricción del modo sandbox de Resend**: con `onboarding@resend.dev` como remitente y sin dominio verificado, Resend solo permite enviar correos a la dirección de email asociada a la cuenta de Resend del usuario. Si `CONTACT_EMAIL_TO` (frank941612@gmail.com) no coincide con esa cuenta, los envíos fallarán (capturado como error y logueado, según lo definido). Mitigación: el usuario debe registrar su cuenta de Resend con frank941612@gmail.com inicialmente, y verificar un dominio propio más adelante para levantar esta restricción.
