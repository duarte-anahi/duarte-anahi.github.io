/* Separador de acrílico acanalado ("fluted"): cada estría vertical funciona como una lente cilíndrica y
   muestra un pedacito de lo que hay debajo, comprimido y corrido. Lo que hay debajo es la pantalla LED
   (js/led.js), que dibujamos nosotros: por eso se puede copiar y deformar en un <canvas> del frente del separador.
   La deformación cambia con el ángulo de la hoja (al darla vuelta) y un poco con el mouse, como cuando uno
   mueve la cabeza frente a un vidrio acanalado. El dorso (arriba del índice, que es HTML) queda esmerilado con CSS. */
(() => {
  const hoja = document.querySelector(".sheet.plastico");
  const led = document.querySelector(".pantalla-led canvas");
  if (!hoja || !led) return;
  const binder = document.getElementById("binder");
  const frente = hoja.querySelector(".face.front");

  const ESTRIA_EM = 1.4;     // ancho de cada estría (tiene que coincidir con el brillo de css/binder.css)
  const COMPRIME = 2.2;      // cada estría muestra un pedazo 2.2 veces más ancho que ella, apretado
  const PARTES = 4;          // cada estría se dibuja en 4 tajadas: los bordes se aprietan más que el centro

  const canvas = document.createElement("canvas"); canvas.className = "acanalado";
  const brillo = document.createElement("div"); brillo.className = "acanalado-brillo";
  frente.prepend(canvas, brillo);
  const g = canvas.getContext("2d");

  let mouse = 0, mouseMeta = 0, sucio = true, ultimoAng = null;
  frente.addEventListener("pointermove", (e) => {
    const r = frente.getBoundingClientRect();
    mouseMeta = ((e.clientX - r.left) / r.width - 0.5) * 2; // -1 a 1
  });
  frente.addEventListener("pointerleave", () => { mouseMeta = 0; });
  led.addEventListener("paso", () => { sucio = true; });

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
    const sh = Math.min(led.height, h * k);
    for (let x = 0; x < w; x += rw) {
      const centro = (x + rw / 2 + corrimiento) * k;
      for (let p = 0; p < PARTES; p++) {
        const u0 = p / PARTES, u1 = (p + 1) / PARTES;
        // lente: el borde de la estría mira más lejos que el centro (seno), así se aprietan los costados
        const s0 = centro + ((rw * COMPRIME) / 2) * Math.sin(Math.PI * (u0 - 0.5)) * k;
        const s1 = centro + ((rw * COMPRIME) / 2) * Math.sin(Math.PI * (u1 - 0.5)) * k;
        const a = Math.max(0, Math.min(led.width - 1, s0)), b = Math.max(a + 1, Math.min(led.width, s1));
        g.drawImage(led, a, 0, b - a, sh, x + u0 * rw, 0, rw / PARTES + 0.5, h);
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
        sucio = false; ultimoAng = ang;
      }
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
