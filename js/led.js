/* Hoja-pantalla LED (debajo del separador de plástico): toda la hoja es una grilla de LEDs y las palabras
   corren en tres franjas de derecha a izquierda. Las letras son de una fuente de 5×7 puntos, como los carteles
   reales: cada LED está prendido o apagado, sin medios tonos, y el texto avanza de a UNA columna por vez.
   Solo anima cuando la página está a la vista (binder.js pone data-spread en la carpeta). */
(() => {
  const pantalla = document.querySelector(".pantalla-led");
  if (!pantalla) return;
  const canvas = pantalla.querySelector("canvas");
  const binder = document.getElementById("binder");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const LETRA = 7, ENTRE = 4, MARGEN = 5;   // filas de LEDs: alto de letra, espacio entre franjas y arriba/abajo
  const PASO_MS = 80;                       // cada cuánto avanza una columna (más alto = más lento)

  // Fuente de 5×7: cada letra son 7 filas de 5 puntos (1 = prendido).
  const F = {
    A: "01110 10001 10001 11111 10001 10001 10001", B: "11110 10001 10001 11110 10001 10001 11110",
    C: "01110 10001 10000 10000 10000 10001 01110", D: "11100 10010 10001 10001 10001 10010 11100",
    E: "11111 10000 10000 11110 10000 10000 11111", F: "11111 10000 10000 11110 10000 10000 10000",
    G: "01110 10001 10000 10111 10001 10001 01111", H: "10001 10001 10001 11111 10001 10001 10001",
    I: "01110 00100 00100 00100 00100 00100 01110", J: "00111 00010 00010 00010 00010 10010 01100",
    K: "10001 10010 10100 11000 10100 10010 10001", L: "10000 10000 10000 10000 10000 10000 11111",
    M: "10001 11011 10101 10101 10001 10001 10001", N: "10001 10001 11001 10101 10011 10001 10001",
    O: "01110 10001 10001 10001 10001 10001 01110", P: "11110 10001 10001 11110 10000 10000 10000",
    Q: "01110 10001 10001 10001 10101 10010 01101", R: "11110 10001 10001 11110 10100 10010 10001",
    S: "01111 10000 10000 01110 00001 00001 11110", T: "11111 00100 00100 00100 00100 00100 00100",
    U: "10001 10001 10001 10001 10001 10001 01110", V: "10001 10001 10001 10001 10001 01010 00100",
    W: "10001 10001 10001 10101 10101 10101 01010", X: "10001 10001 01010 00100 01010 10001 10001",
    Y: "10001 10001 10001 01010 00100 00100 00100", Z: "11111 00001 00010 00100 01000 10000 11111",
    "Ï": "01010 00000 01110 00100 00100 00100 01110",
    "-": "00000 00000 00000 01110 00000 00000 00000",
    "·": "000 000 000 010 000 000 000",
    " ": "000 000 000 000 000 000 000",
  };
  // Pasa un texto a columnas de LEDs: cada columna es un número con 7 bits (uno por fila), y una columna vacía entre letras.
  function columnas(texto) {
    const cols = [];
    for (const ch of texto) {
      const filas = (F[ch] || F[" "]).split(" ");
      for (let x = 0; x < filas[0].length; x++) {
        let bits = 0;
        filas.forEach((f, y) => { if (f[x] === "1") bits |= 1 << y; });
        cols.push(bits);
      }
      cols.push(0);
    }
    return cols;
  }

  // Un LED prendido (con resplandor) y uno apagado se dibujan una vez y después se copian: es mucho más rápido.
  function sprite(tam, color) {
    const c = document.createElement("canvas"); c.width = c.height = Math.ceil(tam * 2);
    const g = c.getContext("2d"), m = tam, r = tam * 0.36;
    if (color) {
      const halo = g.createRadialGradient(m, m, r * 0.6, m, m, tam);
      halo.addColorStop(0, color + "66"); halo.addColorStop(1, color + "00");
      g.fillStyle = halo; g.fillRect(0, 0, c.width, c.height);
      const led = g.createRadialGradient(m - r * 0.3, m - r * 0.3, 0, m, m, r);
      led.addColorStop(0, "#ffffff"); led.addColorStop(0.35, color); led.addColorStop(1, color);
      g.fillStyle = led;
    } else {
      g.fillStyle = "rgba(255,255,255,.07)";   // apagado: un punto gris apenas visible
    }
    g.beginPath(); g.arc(m, m, r, 0, Math.PI * 2); g.fill();
    return c;
  }

  const franjas = [...pantalla.querySelectorAll("li")].map((li, k) => ({
    color: li.dataset.color || "#ff3b2c", cols: columnas(li.textContent), pos: k * 17, on: null,
  }));
  const FILAS = MARGEN * 2 + franjas.length * LETRA + (franjas.length - 1) * ENTRE;
  let tam = 0, nCols = 0, x0 = 0, apagado = null;

  // El tamaño del LED sale del alto de la hoja; las columnas, de cuántos LEDs entran a lo ancho.
  function medir() {
    const dpr = Math.min(2, devicePixelRatio || 1);
    const w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
    if (!w || !h || (w === canvas.width && h === canvas.height)) return false;
    canvas.width = w; canvas.height = h;
    tam = h / FILAS; nCols = Math.floor(w / tam); x0 = (w - nCols * tam) / 2;
    apagado = sprite(tam, null);
    franjas.forEach((f) => { f.on = sprite(tam, f.color); });
    return true;
  }
  function dibujar() {
    if (!tam) return;
    const g = canvas.getContext("2d");
    g.clearRect(0, 0, canvas.width, canvas.height);
    for (let y = 0; y < FILAS; y++) {
      // ¿esta fila de LEDs cae dentro de una franja de texto? → qué franja y qué fila de la letra
      const dentro = y - MARGEN, k = Math.floor(dentro / (LETRA + ENTRE)), fila = dentro - k * (LETRA + ENTRE);
      const franja = dentro >= 0 && k < franjas.length && fila < LETRA ? franjas[k] : null;
      for (let x = 0; x < nCols; x++) {
        const prendido = franja && (franja.cols[(franja.pos + x) % franja.cols.length] >> fila) & 1;
        g.drawImage(prendido ? franja.on : apagado, x0 + x * tam - tam / 2, y * tam - tam / 2);
      }
    }
    canvas.dispatchEvent(new Event("paso")); // avisa que cambió (el separador acanalado la vuelve a copiar)
  }
  new ResizeObserver(() => { if (medir()) dibujar(); }).observe(canvas);

  // Animar solo con la carpeta abierta y la página a la vista: en su doble página o en la anterior (a través del plástico).
  let hoja = -1, reloj = 0;
  function aLaVista() {
    if (hoja < 0) hoja = [...document.querySelectorAll(".sheet")].indexOf(pantalla.closest(".sheet"));
    const s = +binder.dataset.spread;
    return binder.classList.contains("is-open") && (s === hoja || s === hoja - 1);
  }
  // Un temporizador fijo (no requestAnimationFrame): la pantalla avanza a saltitos regulares, como las reales.
  // Se mide en cada paso además de con el ResizeObserver, por si la carpeta cambia de tamaño mientras anda.
  function avanzar() {
    medir();
    franjas.forEach((f) => { f.pos = (f.pos + 1) % f.cols.length; });
    dibujar();
  }
  function revisar() {
    const ahora = !reduced && aLaVista() && !document.hidden;
    if (ahora && !reloj) reloj = setInterval(avanzar, PASO_MS);
    if (!ahora && reloj) { clearInterval(reloj); reloj = 0; }
  }
  new MutationObserver(revisar).observe(binder, { attributes: true, attributeFilter: ["class", "data-spread"] });
  document.addEventListener("visibilitychange", revisar);
  revisar();
})();
