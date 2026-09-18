(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const binder = $("#binder"), cover = $("#coverFront"), strap = $("#strap"), sheetsEl = $("#sheets");
  const castR = $(".cast-r"), castL = $(".cast-l");
  const hud = $(".hud"), countEl = $(".hud .count");
  const btnPrev = $("#prev"), btnNext = $("#next"), btnClose = $("#close");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Mecanismo real (img/anillas.png, 226×1180 px). k = em por px de la imagen.
     bands = filas [desde, hasta] de cada anilla en la imagen, medidas al recortarla. */
  const MECH = { k: 0.04730, top: -27.62, bands: [[143, 180], [266, 300], [389, 420], [762, 790], [880, 911], [998, 1032]] };
  const RING_Y = MECH.bands.map(([a, b]) => +(MECH.top + ((a + b) / 2) * MECH.k).toFixed(2)); // centro de cada anilla, em
  const PAGE_H = 56;

  /* ---------- Construcción ---------- */
  const rings = $(".rings");
  MECH.bands.forEach(([a, b]) => {
    const r = document.createElement("div"); r.className = "ring";
    r.style.top = MECH.top + a * MECH.k + "em";
    r.style.height = (b - a) * MECH.k + "em";
    r.style.backgroundPosition = `0 ${-a * MECH.k}em`;
    rings.appendChild(r);
  });

  const pages = [...document.querySelectorAll("#pages > .page")];
  const nSheets = Math.ceil(pages.length / 2);
  const sheets = [];
  let tabIndex = 0;

  function makeFace(side, page, sheetIdx) {
    const face = document.createElement("div");
    face.className = "face " + side + (page && page.classList.contains("dark") ? " dark" : "");
    const clip = document.createElement("div"); clip.className = "clip";
    if (page) { while (page.firstChild) clip.appendChild(page.firstChild); }
    const holes = document.createElement("div"); holes.className = "holes";
    RING_Y.forEach((y) => { const h = document.createElement("i"); h.style.top = PAGE_H / 2 + y + "em"; holes.appendChild(h); });
    const shade = document.createElement("div"); shade.className = "shade";
    face.append(clip, holes, shade);
    return face;
  }

  function makeTab(label, color, ink, k, target, hidden) {
    const b = document.createElement("button");
    b.className = "tab"; b.type = "button";
    // 7.2em entre solapas: con 7 solapas y 8.4em la última se salía de la hoja
    b.style.top = 3 + k * 7.2 + "em"; b.style.setProperty("--tab", color);
    if (ink) b.style.setProperty("--tab-ink", ink);
    b.innerHTML = "<span></span>"; b.firstChild.textContent = label;
    b.setAttribute("aria-label", "Ir a " + label);
    if (hidden) { b.tabIndex = -1; b.setAttribute("aria-hidden", "true"); }
    b.addEventListener("click", (e) => { e.stopPropagation(); goTo(target); });
    return b;
  }

  for (let i = 0; i < nSheets; i++) {
    const fp = pages[i * 2], bp = pages[i * 2 + 1];
    const el = document.createElement("div"); el.className = "sheet";
    // pila con grosor: cada hoja de abajo asoma un poco (la luz viene de arriba a la izquierda)
    el.style.top = -28 + i * 0.09 + "em";
    el.style.height = 56 - i * 0.04 + "em";
    const front = makeFace("front", fp, i), back = makeFace("back", bp, i);
    if (fp.dataset.tab) {
      front.appendChild(makeTab(fp.dataset.tab, fp.dataset.color || "#c8c2b4", fp.dataset.ink, tabIndex, i, false));
      back.appendChild(makeTab(fp.dataset.tab, fp.dataset.color || "#c8c2b4", fp.dataset.ink, tabIndex, i, true));
      tabIndex++;
    }
    el.append(front, back);
    sheetsEl.appendChild(el);
    sheets.push({ el, ang: 0, token: 0 });
  }
  // Caras en orden de lectura (frente de la hoja 1, dorso de la hoja 1, frente de la 2...)
  const caras = sheets.flatMap(({ el }) => [el.querySelector(".front"), el.querySelector(".back")])
    .filter((c) => c && c.querySelector(".pg"));

  // Si la última hoja no tiene dorso, no se la da vuelta: la doble página final es la anterior.
  const lastSpread = pages.length % 2 ? nSheets - 1 : nSheets;
  sheets.forEach((s, i) => rest(i));
  // Decodifica las imágenes de las hojas de antemano: si no, se decodifican justo al abrir la tapa.
  sheetsEl.querySelectorAll("img").forEach((im) => { if (im.decode) im.decode().catch(() => {}); });

  /* ---------- Estado ---------- */
  let isOpen = false, busy = false, spread = 0, focus = "right", zSeq = 0;
  const mobile = () => innerWidth / innerHeight < 0.8;

  /* ---------- Escala: 1em = una unidad del mundo. Sin transform: scale → texto nítido ----------
     Se ve la carpeta entera, abierta o cerrada. Para leer en grande, se saca la hoja (ver lector). */
  function layout() {
    const u = mobile() ? Math.min(innerWidth / 46, innerHeight / 66) : Math.min(innerWidth / 100, innerHeight / 67);
    binder.style.fontSize = u + "px";
    setCam();
  }
  function setCam() {
    let x = 0;
    if (!isOpen) x = -22;
    else if (mobile()) x = focus === "right" ? -20.6 : 20.6;
    binder.style.setProperty("--camx", x + "em");
    binder.style.perspectiveOrigin = -x + "em 0";
  }
  addEventListener("resize", layout);

  /* ---------- Animación ---------- */
  const ease = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
  const wait = (ms) => new Promise((r) => setTimeout(r, reduced ? 0 : ms));
  function tween(dur, fn, isAlive = () => true) {
    return new Promise((res) => {
      if (reduced) dur = 1;
      const t0 = performance.now();
      const step = (t) => {
        if (!isAlive()) return res(false);
        const p = Math.min(1, (t - t0) / dur);
        fn(ease(p), p);
        p < 1 ? requestAnimationFrame(step) : res(true);
      };
      requestAnimationFrame(step);
    });
  }

  function paint(i, a) {
    const s = sheets[i];
    s.ang = a;
    s.el.style.transform = a === 0 ? "none" : `rotateY(${-a}deg)`;
    s.el.style.setProperty("--lift", (Math.sin((a * Math.PI) / 180) * 0.85).toFixed(3));
  }
  function rest(i) {
    const s = sheets[i];
    paint(i, s.ang < 90 ? 0 : 180);
    s.el.style.zIndex = s.ang < 90 ? 200 - i : 10 + i;
  }
  // Sombra que proyecta lo que gira: el degradé es fijo (CSS); acá solo cambian opacidad y ancho.
  function cast(a) {
    const r = (a * Math.PI) / 180, lift = Math.sin(r);
    if (a <= 90) {
      const reach = 38.6 * Math.cos(r) + 1 + 9 * lift;
      castR.style.opacity = lift.toFixed(3); castL.style.opacity = 0;
      castR.style.transform = `scaleX(${(reach / 38.6).toFixed(4)})`;
    } else {
      const reach = 38.6 * -Math.cos(r) + 1 + 5 * lift;
      castL.style.opacity = lift.toFixed(3); castR.style.opacity = 0;
      castL.style.transform = `scaleX(${(reach / 38.6).toFixed(4)})`;
    }
  }
  const clearCast = () => { castR.style.opacity = 0; castL.style.opacity = 0; };

  let flipping = 0;
  async function flip(i, to, dur) {
    const s = sheets[i], from = s.ang, token = ++s.token;
    s.el.style.zIndex = 400 + ++zSeq;
    flipping++;
    const done = await tween(dur, (e) => { const a = from + (to - from) * e; paint(i, a); cast(a); }, () => s.token === token);
    flipping--;
    if (done) { rest(i); if (!flipping) clearCast(); }
  }

  function goTo(target) {
    if (!isOpen) { openBinder().then(() => goTo(target)); return; }
    target = Math.max(0, Math.min(lastSpread, target));
    if (target === spread) return;
    const jumps = Math.abs(target - spread), dur = jumps > 1 ? 750 : 950, gap = jumps > 1 ? 110 : 0;
    const list = [];
    if (target > spread) for (let i = spread; i < target; i++) list.push([i, 180]);
    else for (let i = spread - 1; i >= target; i--) list.push([i, 0]);
    list.forEach(([i, to], k) => setTimeout(() => flip(i, to, dur), reduced ? 0 : k * gap));
    focus = target > spread ? "left" : "right";
    if (target === 0) focus = "right";
    if (target === nSheets) focus = "left"; // solo ocurre cuando la última hoja tiene dorso
    spread = target;
    setCam(); updateHud();
    history.replaceState(null, "", "#" + spread);
  }

  function next() {
    if (!isOpen) return openBinder();
    if (mobile() && focus === "left" && spread < nSheets) { focus = "right"; setCam(); return; }
    goTo(spread + 1);
  }
  function prev() {
    if (!isOpen) return;
    if (mobile() && focus === "right" && spread > 0) { focus = "left"; setCam(); return; }
    if (spread === 0) return closeBinder();
    goTo(spread - 1);
    if (mobile()) { focus = "right"; setCam(); }
  }

  /* ---------- Tapa ---------- */
  function paintCover(a) {
    cover.style.transform = a === 0 ? "none" : `rotateY(${-a}deg)`;
    cover.style.zIndex = a < 90 ? 500 : 5;
    cover.style.setProperty("--lift", (Math.sin((a * Math.PI) / 180) * 0.7).toFixed(3));
    cast(a);
  }
  /* Correa: cerrada (sobre la tapa), afuera (a la derecha, fuera de la tapa) y guardada (bajo la carpeta, asoma la punta).
     Solo se cambia de "arriba" a "abajo" (z-index) cuando está afuera, así nunca atraviesa la tapa. */
  const STRAP = { closed: 28.6, out: 44.3, tucked: 30.6 };
  let strapToken = 0;
  function strapTo(pos, z, ms) {
    if (reduced) ms = 1;
    const token = ++strapToken;
    strap.style.transition = `transform ${ms}ms cubic-bezier(.5,0,.2,1), filter .25s ease`;
    strap.style.setProperty("--sx", pos - STRAP.closed + "em");
    strap.style.zIndex = z;
    // al terminar, vuelve la transición corta del hover
    setTimeout(() => { if (token === strapToken) strap.style.transition = ""; }, ms + 50);
  }

  async function openBinder() {
    if (isOpen || busy) return;
    busy = true;
    binder.classList.remove("is-closed"); binder.classList.add("is-opening");
    strapTo(STRAP.out, 600, 480); // se desabrocha: la correa sale de la tapa
    await wait(500);
    isOpen = true; focus = "right"; layout();
    binder.classList.add("is-open");
    strapTo(STRAP.tucked, 0, 1100); // y se guarda bajo la carpeta
    await tween(1350, (e) => {
      const a = 180 * e;
      paintCover(a);
      if (a > 40) binder.classList.add("rings-on"); // las anillas aparecen cuando la tapa ya se levantó
    });
    clearCast();
    binder.classList.remove("is-opening");
    busy = false; updateHud();
    strap.blur();
  }
  async function closeBinder() {
    if (!isOpen || busy) return;
    busy = true;
    if (spread > 0) { goTo(0); await wait(900 + spread * 110); }
    binder.classList.add("is-closing");
    await tween(1200, (e) => {
      const a = 180 * (1 - e);
      paintCover(a);
      if (a < 100) binder.classList.remove("rings-on"); // antes que al abrir: el fundido tiene que terminar antes de que la tapa se vea plana
    });
    clearCast();
    isOpen = false; binder.classList.remove("is-open", "rings-on"); binder.classList.add("is-closed"); layout();
    strapTo(STRAP.out, 0, 700); // la correa sale de abajo de la carpeta...
    await wait(720);
    strapTo(STRAP.closed, 600, 480); // ...y se abrocha sobre la tapa
    await wait(500);
    binder.classList.remove("is-closing"); binder.classList.add("is-closed");
    busy = false; updateHud(); history.replaceState(null, "", location.pathname);
    strap.focus({ preventScroll: true });
  }

  /* ---------- Lector: la hoja sale de la carpeta y se agranda ---------- */
  let lector = null;

  function medidaHoja() {
    // La hoja suelta se mide por el ancho, no por el alto: así el texto queda bastante más grande
    // que dentro de la carpeta. Si no entra a lo alto, la hoja se desplaza.
    const porAncho = innerWidth * 0.62 / 38.6;
    const minimo = parseFloat(binder.style.fontSize) * 1.35; // siempre más grande que en la carpeta
    return Math.max(minimo, Math.min(porAncho, 26));
  }

  function abrirLector(cara) {
    if (lector) return;
    const indice = caras.indexOf(cara);
    if (indice < 0) return;

    const fondo = document.createElement("div");
    fondo.className = "lector";
    const hoja = document.createElement("div");
    hoja.className = "hoja" + (cara.classList.contains("dark") ? " dark" : "");
    hoja.style.fontSize = medidaHoja() + "px";
    hoja.appendChild(cara.querySelector(".clip").cloneNode(true));

    const barra = document.createElement("div");
    barra.className = "lector-barra";
    const btn = (txt, etiqueta) => {
      const b = document.createElement("button");
      b.type = "button"; b.textContent = txt; b.setAttribute("aria-label", etiqueta);
      return b;
    };
    const anterior = btn("←", "Hoja anterior"), siguiente = btn("→", "Hoja siguiente"), cerrar = btn("Cerrar", "Cerrar la hoja");
    const cuenta = document.createElement("span");
    barra.append(anterior, cuenta, siguiente, cerrar);

    fondo.append(hoja, barra);
    document.body.appendChild(fondo);
    lector = { fondo, hoja, cuenta, anterior, siguiente, indice: -1, origen: cara };

    // FLIP: arranca del tamaño y lugar que tenía dentro de la carpeta y crece hasta el centro
    const desde = cara.getBoundingClientRect(), hasta = hoja.getBoundingClientRect();
    const escala = desde.width / hasta.width;
    hoja.style.transform = `translate(${desde.left - hasta.left}px, ${desde.top - hasta.top}px) scale(${escala})`;
    hoja.getBoundingClientRect();
    hoja.style.transition = "transform .45s cubic-bezier(.3,.7,.25,1)";
    hoja.style.transform = "none";
    requestAnimationFrame(() => fondo.classList.add("on"));

    mostrarCara(indice);
    anterior.onclick = () => mostrarCara(lector.indice - 1);
    siguiente.onclick = () => mostrarCara(lector.indice + 1);
    cerrar.onclick = cerrarLector;
    fondo.addEventListener("click", (e) => { if (e.target === fondo) cerrarLector(); });
  }

  function mostrarCara(i) {
    if (!lector || i < 0 || i >= caras.length || i === lector.indice) return;
    const cara = caras[i];
    lector.indice = i;
    lector.origen = cara;
    lector.hoja.classList.toggle("dark", cara.classList.contains("dark"));
    lector.hoja.replaceChild(cara.querySelector(".clip").cloneNode(true), lector.hoja.firstChild);
    lector.hoja.scrollTop = 0;
    lector.cuenta.textContent = `${i + 1} / ${caras.length}`;
    lector.anterior.disabled = i === 0;
    lector.siguiente.disabled = i === caras.length - 1;
  }

  function cerrarLector() {
    if (!lector) return;
    const { fondo, hoja, origen, indice } = lector;
    lector = null;
    // al cerrar, la carpeta queda abierta en la doble página de esa hoja
    goTo(indice % 2 ? Math.floor(indice / 2) + 1 : indice / 2);
    const desde = origen.getBoundingClientRect(), hasta = hoja.getBoundingClientRect();
    hoja.style.transform = `translate(${desde.left - hasta.left}px, ${desde.top - hasta.top}px) scale(${desde.width / hasta.width})`;
    fondo.classList.remove("on");
    setTimeout(() => fondo.remove(), 380);
  }

  /* ---------- HUD e interacción ---------- */
  function updateHud() {
    hud.classList.toggle("on", isOpen);
    countEl.textContent = `${spread + 1} / ${lastSpread + 1}`;
    btnNext.disabled = spread === lastSpread && !(mobile() && focus === "left");
  }
  btnPrev.onclick = prev; btnNext.onclick = next; btnClose.onclick = closeBinder;
  // Se abre solo desde la hebilla. Click en la tapa = la tapa se levanta un poco y la correa la frena (pista sin texto).
  strap.addEventListener("click", () => { if (!isOpen) openBinder(); });
  strap.addEventListener("keydown", (e) => { if (!isOpen && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); openBinder(); } });
  cover.addEventListener("click", () => {
    if (isOpen || busy) return;
    binder.classList.remove("nudge"); void binder.offsetWidth; binder.classList.add("nudge");
  });
  cover.addEventListener("animationend", () => binder.classList.remove("nudge"));

  addEventListener("keydown", (e) => {
    if (lector) {
      if (e.key === "Escape") cerrarLector();
      else if (e.key === "ArrowRight" || e.key === "PageDown") mostrarCara(lector.indice + 1);
      else if (e.key === "ArrowLeft" || e.key === "PageUp") mostrarCara(lector.indice - 1);
      return;
    }
    if (e.key === "ArrowRight" || e.key === "PageDown") next();
    else if (e.key === "ArrowLeft" || e.key === "PageUp") prev();
    else if (e.key === "Escape") closeBinder();
  });

  // Click en la hoja (fuera de links) = pasar página, como en papel. Swipe en táctil.
  let down = null;
  sheetsEl.addEventListener("pointerdown", (e) => { down = { x: e.clientX, y: e.clientY, t: Date.now() }; });
  sheetsEl.addEventListener("pointerup", (e) => {
    if (!down || !isOpen) return;
    const dx = e.clientX - down.x, dy = e.clientY - down.y; const d = down; down = null;
    if (e.target.closest("a, button") || String(getSelection())) return;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) return dx < 0 ? next() : prev();
    if (Math.hypot(dx, dy) < 6 && Date.now() - d.t < 400) {
      const cara = e.target.closest(".face");
      if (cara) abrirLector(cara); // tocar la hoja = sacarla de la carpeta y leerla en grande
    }
  });

  /* ---------- Arranque ---------- */
  binder.classList.add("no-anim");
  layout(); updateHud();
  binder.getBoundingClientRect();
  requestAnimationFrame(() => requestAnimationFrame(() => binder.classList.remove("no-anim")));
  // Cuero: si existe una foto en img/cuero.(jpg|png|webp) se usa esa; si no, la textura generada por código.
  const setLeather = (url, photo) => {
    document.documentElement.style.setProperty("--leather-img", `url("${url}")`);
    document.body.classList.add("leather-ready");
    document.body.classList.toggle("leather-photo", !!photo);
  };
  const procedural = () => {
    const u = 26; // resolución de la textura: px por unidad
    if (window.makeLeather) makeLeather({ width: 44.4 * u, height: 60 * u, seed: 11 }).then((url) => setLeather(url, false));
  };
  function tryPhoto(list) {
    if (!list.length) return procedural();
    const img = new Image();
    img.onload = () => { setLeather(fitPhoto(img), true); document.body.classList.toggle("leather-color", LEATHER.tint !== "negro"); };
    img.onerror = () => tryPhoto(list.slice(1));
    img.src = list[0];
  }
  // img/cuero-tapa.jpg = la foto ya adaptada por fitPhoto(), guardada como archivo. Así el navegador no la
  // procesa en cada carga (eso trababa la apertura). Si cambiás img/cuero.jpg, borrá cuero-tapa.jpg y regenerala.
  const prefit = new Image();
  prefit.onload = () => {
    const apply = () => { setLeather(prefit.src, true); document.body.classList.toggle("leather-color", LEATHER.tint !== "negro"); };
    prefit.decode ? prefit.decode().then(apply, apply) : apply();
  };
  prefit.onerror = () => tryPhoto(["img/cuero.jpg", "img/cuero.jpeg", "img/cuero.png", "img/cuero.webp"]);
  prefit.src = "img/cuero-tapa.jpg";

  /* Adapta cualquier foto de cuero a la tapa (vertical, 44.4 × 60):
     - recorta el centro al ancho LEATHER.crop (panza + algo de costados)
     - si la foto no alcanza de alto, busca la franja de la propia foto que mejor empalma con el borde
       de abajo y la continúa desde ahí con un fundido (sin espejo ni corte)
     - LEATHER.tint "negro": pasa a negro conservando relieve y brillo; "original": deja el color */
  const LEATHER = { tint: "original", crop: 0.72 };
  function fitPhoto(img) {
    const sw = img.naturalWidth * LEATHER.crop, sx = (img.naturalWidth - sw) / 2;
    // ancho = resolución real del recorte (antes 1160 fijo: achicaba la foto y el cuero perdía nitidez)
    const W = Math.round(Math.min(2048, sw)), H = Math.round(W * 60 / 44.4);
    const k = W / sw, ih = img.naturalHeight * k;
    const nh = img.naturalHeight;
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const g = c.getContext("2d");
    g.drawImage(img, sx, 0, sw, nh, 0, 0, W, ih);
    if (ih < H) {
      const band = Math.round(nh * 0.14);             // alto del fundido, en px de la foto
      const y0 = findSeam(img, sx, sw, band);          // fila de la foto que empalma con el borde inferior
      const pieceH = (nh - y0) * k, bandK = band * k;
      const t = document.createElement("canvas"); t.width = W; t.height = Math.ceil(pieceH);
      const tg = t.getContext("2d");
      tg.drawImage(img, sx, y0, sw, nh - y0, 0, 0, W, pieceH);
      const grad = tg.createLinearGradient(0, 0, 0, t.height);
      grad.addColorStop(0, "rgba(0,0,0,0)"); grad.addColorStop(bandK / t.height, "rgba(0,0,0,1)"); grad.addColorStop(1, "rgba(0,0,0,1)");
      tg.globalCompositeOperation = "destination-in";
      tg.fillStyle = grad; tg.fillRect(0, 0, W, t.height);
      for (let y = ih; y < H; y += pieceH - bandK) g.drawImage(t, 0, y - bandK);
    }
    if (LEATHER.tint === "negro") {
      const d = g.getImageData(0, 0, W, H), p = d.data;
      let sum = 0;
      for (let i = 0; i < p.length; i += 16) sum += 0.3 * p[i] + 0.59 * p[i + 1] + 0.11 * p[i + 2];
      const mean = sum / (p.length / 16);
      for (let i = 0; i < p.length; i += 4) {
        const l = (0.3 * p[i] + 0.59 * p[i + 1] + 0.11 * p[i + 2]) / mean;
        const v = Math.min(120, 9 + 24 * l * l * l);
        p[i] = v * 1.02; p[i + 1] = v; p[i + 2] = v * 0.97;
      }
      g.putImageData(d, 0, 0);
    }
    return c.toDataURL("image/jpeg", 0.9);
  }
  // Compara (en miniatura, escala de grises) la franja inferior de la foto contra cada franja de la mitad
  // de arriba y devuelve la que más se parece: ahí las filas de escamas quedan alineadas.
  function findSeam(img, sx, sw, band) {
    const nh = img.naturalHeight, sw2 = 160, s = sw2 / sw, h2 = Math.round(nh * s), b2 = Math.max(4, Math.round(band * s));
    const c = document.createElement("canvas"); c.width = sw2; c.height = h2;
    const g = c.getContext("2d", { willReadFrequently: true });
    g.drawImage(img, sx, 0, sw, nh, 0, 0, sw2, h2);
    const p = g.getImageData(0, 0, sw2, h2).data, L = new Float32Array(sw2 * h2);
    for (let i = 0; i < L.length; i++) L[i] = 0.3 * p[i * 4] + 0.59 * p[i * 4 + 1] + 0.11 * p[i * 4 + 2];
    const ref = (h2 - b2) * sw2;
    let best = 0, bestErr = Infinity;
    for (let y = 0; y <= Math.round(h2 * 0.45); y++) {
      let err = 0;
      for (let i = 0, o = y * sw2; i < b2 * sw2; i++) { const d = L[o + i] - L[ref + i]; err += d * d; }
      if (err < bestErr) { bestErr = err; best = y; }
    }
    return Math.round(best / s);
  }
  const start = parseInt(location.hash.slice(1), 10);
  if (!isNaN(start)) openBinder().then(() => goTo(start));
})();
