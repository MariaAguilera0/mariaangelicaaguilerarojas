/* =====================================================
   CHATBOT — motor (no necesitas editar este archivo)
   El conocimiento se edita en conocimiento.js
   ===================================================== */

/* ---- CONFIGURACIÓN OPCIONAL: IA real con Google Gemini (gratis) ----
   Déjalo vacío ("") para usar solo tu base de conocimiento.
   Si haces el Paso 9, pega aquí la URL de tu Worker de Cloudflare.   */
const CHATBOT_URL_IA = "";

(function () {
  const KB = window.CONOCIMIENTO || (typeof CONOCIMIENTO !== "undefined" ?
    CONOCIMIENTO : null);
  if (!KB) { console.error("Chatbot: falta conocimiento.js"); return; }

  const UMBRAL = 0.42; // qué tan parecida debe ser la pregunta (0 a 1)
  const STOP = new Set(("a al algo alguna como con cual cuales de del ella ellos en es esa eso esta este esto la las le les lo los me mi mis muy no o para por por que quien se si sin sobre su sus te tu tus un una unos unas y ya yo hay puede puedo pueden quiero quisiera saber favor usted ustedes ser son están tienen tengo hola").split(" "));

  /* ----------- Procesamiento de texto ----------- */
  const normalizar = t =>
    t.toLowerCase().normalize("NFD").replace(/[\p{Diacritic}]/gu, "")
     .replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

  const raiz = w => w.length > 5 && w.endsWith("es") ? w.slice(0, -2)
               : w.length > 3 && w.endsWith("s") ? w.slice(0, -1) : w;

  function tokens(t) {
    const todas = normalizar(t).split(" ").filter(Boolean);
    const utiles = todas.filter(w => !STOP.has(w));
    return (utiles.length ? utiles : todas).map(raiz);
  }

  function distancia(a, b) { // Levenshtein para tolerar errores de escritura
    if (Math.abs(a.length - b.length) > 2) return 99;
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++)
      for (let j = 1; j <= b.length; j++)
        d[i][j] = Math.min(d[i-1][j] + 1, d[i][j-1] + 1, d[i-1][j-1] + (a[i-1] ===
          b[j-1] ? 0 : 1));
    return d[a.length][b.length];
  }

  function parecidas(a, b) {
    if (a === b) return 1;
    if (a.length >= 5 && b.length >= 5 && (a.startsWith(b) || b.startsWith(a)))
      return 0.9;
    const tol = Math.min(a.length, b.length) >= 7 ? 2 : Math.min(a.length,
      b.length) >= 4 ? 1 : 0;
    return tol && distancia(a, b) <= tol ? 0.8 : 0;
  }

  function similitud(tu, tp) {
    if (!tu.length || !tp.length) return 0;
    let suma = 0;
    for (const u of tu) suma += Math.max(0, ...tp.map(p => parecidas(u, p)));
    const cubreUsuario = suma / tu.length;
    const cubrepregunta = suma / tp.length;
    return 0.65 * cubreUsuario + 0.35 * Math.min(1, cubrepregunta);
  }

  const indice = KB.temas.map(t => ({ tema: t, variantes: t.preguntas.map(tokens)
  }));

  function buscar(texto) {
    const tu = tokens(texto);
    let mejor = null, puntaje = 0;
    for (const item of indice) {
      for (const tp of item.variantes) {
        const s = similitud(tu, tp);
        if (s > puntaje) { puntaje = s; mejor = item.tema; }
      }
    }
    return puntaje >= UMBRAL ? mejor : null;
  }

  /* ----------- Interfaz ----------- */
  const esc = s => s.replace(/[<>&"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">":
    "&gt;", '"': "&quot;" }[c]));
  const formato = s => esc(s)
    .replace(/\*\*\*(.*?)\*\*\*/g, "<strong>$1</strong>")
    .replace(/\n/g, "<br>");

  const raizUI = document.createElement("div");
  raizUI.className = "cb";
  raizUI.innerHTML = `
    <button class="cb-toggle" aria-label="Abrir chat">
      <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor"><path
d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6l-4 4V6a2 2 0 0 1 2-2z"/></svg>
    </button>
    <section class="cb-ventana" role="dialog" aria-label="${esc(KB.nombreBot)}">
      <header class="cb-cabecera">
        <div class="cb-avatar">🤖</div>
        <div><strong>${esc(KB.nombreBot)}</strong><small>En línea</small></div>
        <button class="cb-cerrar" aria-label="Cerrar chat">✕</button>
      </header>
      <div class="cb-mensajes" aria-live="polite"></div>
      <form class="cb-form">
        <input type="text" placeholder="Escribe tu pregunta..." autocomplete="off"
maxlength="300" aria-label="Mensaje">
        <button type="submit" aria-label="Enviar">➤</button>
      </form>
    </section>`;
  document.body.appendChild(raizUI);

  const $ = s => raizUI.querySelector(s);
  const lista = $(".cb-mensajes"), entrada = $(".cb-form input");
  let historial = [];
  let iniciado = false;

  function abrir(on) {
    raizUI.classList.toggle("abierto", on);
    if (on && !iniciado) { iniciado = true; responderBot(KB.bienvenida, null,
      KB.sugerencias); }
    if (on) setTimeout(() => entrada.focus(), 200);
  }

  $(".cb-toggle").onclick = () => abrir(!raizUI.classList.contains("abierto"));
  $(".cb-cerrar").onclick = () => abrir(false);

  function agregar(html, quien) {
    const div = document.createElement("div");
    div.className = "cb-msg cb-" + quien;
    div.innerHTML = html;
    lista.appendChild(div);
    lista.scrollTop = lista.scrollHeight;
    return div;
  }

  function ejecutarAccion(a) {
    if (a.pagina) {
      if (typeof window.cargar === "function" && document.getElementById("visor"))
      {
        window.cargar(a.pagina);
        document.getElementById("visor").scrollIntoView({ behavior: "smooth" });
      } else location.href = a.pagina;
    } else if (a.url) {
      if (a.url.startsWith("#")) document.querySelector(a.url)?.scrollIntoView({
        behavior: "smooth" });
      else location.href = a.url;
    }
  }

  function responderBot(texto, accion, sugerencias) {
    const div = agregar(formato(texto), "bot");
    if (accion) {
      const b = document.createElement("button");
      b.className = "cb-accion"; b.textContent = accion.texto + " →";
      b.onclick = () => ejecutarAccion(accion);
      div.appendChild(b);
    }
    if (sugerencias?.length) {
      const cont = document.createElement("div");
      cont.className = "cb-chips";
      sugerencias.forEach(s => {
        const c = document.createElement("button");
        c.textContent = s; c.onclick = () => enviar(s);
        cont.appendChild(c);
      });
      lista.appendChild(cont);
    }
    historial.push({ rol: "bot", texto });
    lista.scrollTop = lista.scrollHeight;
  }

  const escribiendo = () => agregar('<span class="cb-puntos"><i></i><i></i><i></i>' +
    '</span>', "bot cb-escribiendo");

  async function preguntarIA(texto) {
    const contexto = KB.temas.map(t => `- ${t.preguntas[0]}:\n${t.respuesta}`).join("\n");
    const r = await fetch(CHATBOT_URL_IA, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mensaje: texto, contexto, historial:
        historial.slice(-6) })
    });
    if (!r.ok) throw new Error("IA no disponible");
    return (await r.json()).respuesta;
  }

  async function enviar(texto) {
    texto = texto.trim();
    if (!texto) return;
    lista.querySelectorAll(".cb-chips").forEach(c => c.remove());
    agregar(esc(texto), "usuario");
    historial.push({ rol: "usuario", texto });
    entrada.value = "";

    const tema = buscar(texto);
    const cargando = escribiendo();

    if (tema) {
      await new Promise(r => setTimeout(r, 450 + Math.random() * 400));
      cargando.remove();
      return responderBot(tema.respuesta, tema.accion);
    }
    if (CHATBOT_URL_IA) {
      try {
        const resp = await preguntarIA(texto);
        cargando.remove();
        return responderBot(resp);
      } catch (e) { console.warn(e); }
    }
    await new Promise(r => setTimeout(r, 400));
    cargando.remove();
    responderBot(KB.noEntiendo, null, KB.sugerencias);
  }

  $(".cb-form").onsubmit = e => { e.preventDefault(); enviar(entrada.value); };
  document.addEventListener("keydown", e => { if (e.key === "Escape") abrir(false); });
  abrir(false);

  // Para probar desde la consola del navegador: chatbotProbar("cuanto vale")
  window.chatbotProbar = t => { const r = buscar(t); console.log(r ?
    r.preguntas[0] : "sin coincidencia"); };
})();
