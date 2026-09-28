/* Separador de acrílico acanalado ("fluted"): cada estría vertical funciona como una lente cilíndrica y
   muestra un pedacito de lo que hay debajo, comprimido y corrido. Lo que hay debajo es la pantalla LED
   (js/led.js), que dibujamos nosotros: por eso se puede copiar y deformar en un <canvas> del frente del separador.
   La deformación cambia con el ángulo de la hoja (al darla vuelta) y un poco con el mouse, como cuando uno
   mueve la cabeza frente a un vidrio acanalado.
   Dorso: al dar vuelta el separador queda apoyado sobre el índice, que es HTML y no se puede copiar a un canvas.
   Ahí la deformación se arma con copias del índice cortadas en tajadas verticales (3 por estría), cada una estirada
   con transform, puestas sobre la hoja del índice (no sobre el separador). Sin filtros: el navegador las pinta una vez y al girar la hoja solo la mueve, así no se traba.
   Las canaletas salen de la foto del dorso (img/acrilico-dorso.webp), medidas una por una. */
(() => {
  const hoja = document.querySelector(".sheet.plastico");
  const led = document.querySelector(".pantalla-led canvas");
  if (!hoja || !led) return;
  const binder = document.getElementById("binder");
  const frente = hoja.querySelector(".face.front");

  // ancho de cada estría y dónde cae la primera canaleta: medidos sobre img/acrilico.jpg (la foto del acrílico),
  // para que la deformación coincida con las estrías de la foto. Tienen que coincidir con css/binder.css.
  const ESTRIA_EM = 1.929, FASE_EM = 0.33;
  const COMPRIME = 3.4;      // cada estría muestra un pedazo 3.4 veces más ancho que ella, apretado (y dado vuelta, como una lupa)
  const PARTES = 10;         // cada estría se dibuja en 10 tajadas: los bordes se aprietan más que el centro
  const BLUR = 0.14;         // desenfoque de lo que está atrás del plástico, en fracción del ancho de estría

  const canvas = document.createElement("canvas"); canvas.className = "acanalado";
  const brillo = document.createElement("div"); brillo.className = "acanalado-brillo";
  const foto = document.createElement("div"); foto.className = "acanalado-foto"; // rayones, huellas y canto: img/acrilico.jpg
  frente.prepend(canvas, brillo, foto);
  const g = canvas.getContext("2d");
  // copia borrosa de la pantalla: lo que está unos milímetros atrás del acrílico nunca se ve nítido
  const borroso = document.createElement("canvas"), gb = borroso.getContext("2d");
  let borrosoSucio = true;

  let mouse = 0, mouseMeta = 0, sucio = true, ultimoAng = null;
  frente.addEventListener("pointermove", (e) => {
    const r = frente.getBoundingClientRect();
    mouseMeta = ((e.clientX - r.left) / r.width - 0.5) * 2; // -1 a 1
  });
  frente.addEventListener("pointerleave", () => { mouseMeta = 0; });
  led.addEventListener("paso", () => { sucio = true; borrosoSucio = true; });

  // ---- Dorso: índice visto a través del plástico ----
  // Canaletas de img/acrilico-dorso.webp, en em sobre una hoja de 58.2em (tools/acrilico-dorso.py endereza la foto).
  const CANALETAS_DORSO = [1.27, 2.88, 4.28, 6.23, 7.91, 9.38, 11.26, 12.94, 14.34, 16.09, 17.67, 19.27, 20.92, 22.56,
    24.31, 25.88, 27.46, 29.1, 30.74, 32.28, 33.96, 35.6, 37.28, 38.96, 40.64, 42.42, 44.13, 45.84, 47.52, 49.26,
    50.98, 52.72, 54.37, 55.97];
  // Apoyado sobre el papel, cada estría agranda poquito y derecho: muestra el 80% de lo que tiene abajo,
  // el centro casi sin estirar y los costados más estirados (ahí la curva de la estría es más fuerte).
  const FUENTE = 0.8, CENTRO = 0.6, MAG_CENTRO = 1.1;
  const hojas = [...document.querySelectorAll(".sheet")];
  const dorso = hoja.querySelector(".face.back");
  const debajo = hojas[hojas.indexOf(hoja) - 1]?.querySelector(".face.back"); // la cara sobre la que cae (el índice)
  const clipDebajo = debajo && debajo.querySelector(".clip");
  let vista = null;
  if (dorso && clipDebajo) {
    vista = document.createElement("div"); vista.className = "acanalado-dorso"; vista.inert = true;
    vista.setAttribute("aria-hidden", "true");
    const ANCHO = 58.2; // ancho de la hoja en em (css/binder.css, .sheet)
    const bordes = [0, ...CANALETAS_DORSO, ANCHO];
    const tajada = (x0, x1, f0, f1) => {
      // muestra en [x0, x1] lo que el índice tiene en [f0, f1], estirado a lo ancho
      const t = document.createElement("div"); t.className = "tajada";
      t.style.left = x0 + "em"; t.style.width = x1 - x0 + "em";
      const c = clipDebajo.cloneNode(true);
      const k = (x1 - x0) / (f1 - f0);
      c.style.width = ANCHO + "em"; c.style.left = -x0 + "em";
      c.style.transform = `translateX(${x0 - k * f0}em) scaleX(${k})`;
      t.appendChild(c); vista.appendChild(t);
    };
    for (let i = 0; i < bordes.length - 1; i++) {
      const a = bordes[i], b = bordes[i + 1], w = b - a, m = (a + b) / 2;
      const fc = (w * CENTRO) / MAG_CENTRO / 2;       // media fuente del centro
      const fb = (w * FUENTE) / 2;                    // media fuente de toda la estría
      const c0 = m - (w * CENTRO) / 2, c1 = m + (w * CENTRO) / 2;
      tajada(a, c0, m - fb, m - fc);
      tajada(c0, c1, m - fc, m + fc);
      tajada(c1, b, m + fc, m + fb);
    }
    // va en la hoja del ÍNDICE, no en el separador: así al levantar el plástico la deformación no se va con él,
    // se apaga ahí mismo (el separador se lleva solo sus brillos, la foto del dorso)
    debajo.insertBefore(vista, debajo.querySelector(".shade"));
  }

  function dibujar(ang) {
    const dpr = Math.min(2, devicePixelRatio || 1);
    const w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
    if (!w || !h) return;
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    g.fillStyle = "#070708"; g.fillRect(0, 0, w, h);
    if (led.width === 300 && led.height === 150) return; // la pantalla todavía no se midió

    const fontPx = parseFloat(getComputedStyle(frente).fontSize) * dpr;
    const rw = ESTRIA_EM * fontPx;                       // ancho de estría en píxeles del canvas
    const k = led.width / w;                            // escala entre este canvas y el de la pantalla
    // corrimiento de lo que se ve dentro de las estrías: depende del giro de la hoja y del mouse
    const fase = (ang * Math.PI) / 180 * 3 + mouse * 0.9;
    const corrimiento = rw * 1.1 * Math.sin(fase);
    if (borrosoSucio || borroso.width !== led.width || borroso.height !== led.height) {
      borroso.width = led.width; borroso.height = led.height;
      gb.filter = `blur(${(rw * k * BLUR).toFixed(1)}px)`;
      gb.drawImage(led, 0, 0);
      borrosoSucio = false;
    }
    // la luz de la pantalla se abre un poco al atravesar el plástico (brillo que "sangra" entre estrías)
    g.globalCompositeOperation = "lighter"; g.globalAlpha = 0.35;
    g.filter = `blur(${(rw * 0.5).toFixed(1)}px)`;
    g.drawImage(borroso, 0, 0, led.width, Math.min(led.height, h * k), 0, 0, w, h);
    g.filter = "none"; g.globalAlpha = 1; g.globalCompositeOperation = "source-over";

    const sh = Math.min(led.height, h * k);
    for (let x = FASE_EM * fontPx - rw; x < w; x += rw) {
      const centro = (x + rw / 2 + corrimiento) * k;
      for (let p = 0; p < PARTES; p++) {
        const u0 = p / PARTES, u1 = (p + 1) / PARTES;
        // lente: el borde de la estría mira más lejos que el centro (seno), así se aprietan los costados.
        // El signo menos da vuelta la imagen dentro de cada estría, como una lupa mirando algo lejano.
        const s0 = centro - ((rw * COMPRIME) / 2) * Math.sin(Math.PI * (u0 - 0.5)) * k;
        const s1 = centro - ((rw * COMPRIME) / 2) * Math.sin(Math.PI * (u1 - 0.5)) * k;
        const a = Math.max(0, Math.min(led.width - 1, Math.min(s0, s1))), b = Math.max(a + 1, Math.min(led.width, Math.max(s0, s1)));
        // dibuja la tajada espejada (scale -1) para que el contenido quede invertido de verdad
        const dx = x + u0 * rw, dw = rw / PARTES + 0.5;
        g.save(); g.translate(dx + dw, 0); g.scale(-1, 1);
        g.globalAlpha = 0.72; // un poco de la luz se pierde en el plástico
        g.drawImage(borroso, a, 0, b - a, sh, 0, 0, dw, h);
        g.restore();
      }
    }
  }

  // Dibuja solo cuando cambia algo (la pantalla avanzó, la hoja giró o se movió el mouse)
  // y solo con el separador a la vista: su doble página (frente) o la siguiente (dorso).
  const idx = [...document.querySelectorAll(".sheet")].indexOf(hoja);
  function loop() {
    const s = +binder.dataset.spread, ang = +(hoja.dataset.ang || 0);
    const cerca = binder.classList.contains("is-open") && (s === idx || s === idx + 1 || (ang > 0 && ang < 180));
    if (cerca) {
      mouse += (mouseMeta - mouse) * 0.12;           // el mouse se sigue suave, no a los saltos
      const moviendo = Math.abs(mouseMeta - mouse) > 0.002;
      if (sucio || moviendo || ang !== ultimoAng) {
        dibujar(ang);
        // al levantarse, la hoja deja de estar sobre la pantalla: la distorsión se apaga y queda el acrílico solo
        canvas.style.opacity = String(1 - Math.min(1, Math.max(0, (ang - 15) / 55)));
        // el reflejo de cada estría se corre según desde dónde se la mire (giro de la hoja y mouse)
        brillo.style.setProperty("--luz", (Math.sin((ang * Math.PI) / 180 * 2) * 0.8 + mouse * 0.6).toFixed(3));
        if (vista) {
          // la deformación del índice solo existe con el separador apoyado sobre él: apenas se despega (180° → 155°) se apaga
          const op = Math.min(1, Math.max(0, (ang - 155) / 25));
          vista.style.opacity = String(op);
          vista.style.visibility = op > 0 ? "visible" : "hidden";
        }
        sucio = false; ultimoAng = ang;
      }
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
