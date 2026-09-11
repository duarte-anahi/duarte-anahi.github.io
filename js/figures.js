/* Figuras vectoriales "impresas" en las hojas. Vector = nítidas a cualquier tamaño. */
(() => {
  const NS = "http://www.w3.org/2000/svg";
  const rnd = ((s) => () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9 | 0) >>> 0) / 4294967296)(42);
  const svg = (w, h, inner) => `<svg viewBox="0 0 ${w} ${h}" xmlns="${NS}">${inner}</svg>`;

  const figs = {
    net() {
      const layers = [3, 4, 4, 2], W = 300, H = 220, ink = "#2f8f7a";
      const pts = layers.map((n, l) => Array.from({ length: n }, (_, i) => [30 + l * 80, H / 2 + (i - (n - 1) / 2) * 48]));
      let s = "";
      for (let l = 0; l < pts.length - 1; l++)
        for (const a of pts[l]) for (const b of pts[l + 1])
          s += `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${ink}" stroke-width="1.6" opacity=".8"/>`;
      for (const L of pts) for (const p of L) s += `<circle cx="${p[0]}" cy="${p[1]}" r="11" fill="#f2f0ea" stroke="${ink}" stroke-width="2.6"/>`;
      return svg(W, H, s);
    },

    pipeline() {
      const ink = "#2b5d8a", box = (x, y, w, t, sub) =>
        `<rect x="${x}" y="${y}" width="${w}" height="54" rx="6" fill="#dfe9f2" stroke="${ink}" stroke-width="1.5"/>` +
        `<text x="${x + w / 2}" y="${y + 24}" text-anchor="middle" font-family="Inter,sans-serif" font-size="14" font-weight="600" fill="#1e3550">${t}</text>` +
        `<text x="${x + w / 2}" y="${y + 42}" text-anchor="middle" font-family="IBM Plex Mono,monospace" font-size="10.5" fill="#4a6682">${sub}</text>`;
      const arrow = (x1, y1, x2, y2) => `<path d="M${x1} ${y1} L${x2} ${y2}" stroke="${ink}" stroke-width="1.5" marker-end="url(#ah)" fill="none"/>`;
      let s = `<defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="${ink}"/></marker></defs>`;
      s += box(10, 10, 130, "Foto", "celular / web") + arrow(140, 37, 178, 37);
      s += box(180, 10, 150, "Preprocesado", "resize · normalizar") + arrow(255, 64, 255, 98);
      s += box(160, 100, 190, "CNN preentrenada", "fine-tuning · 6 clases") + arrow(255, 154, 255, 188);
      s += box(180, 190, 150, "API", "FastAPI · /predict") + arrow(180, 217, 142, 217);
      s += box(10, 190, 130, "Respuesta", "contenedor + conf.");
      s += `<path d="M75 64 C75 120, 120 140, 158 127" stroke="${ink}" stroke-width="1.2" stroke-dasharray="4 4" fill="none"/>`;
      s += `<text x="40" y="150" font-family="IBM Plex Mono,monospace" font-size="10" fill="#4a6682">dataset</text>`;
      return svg(360, 254, s);
    },

    chart() {
      const W = 360, H = 250, n = 40, ink = "#1f5f9a", pred = "#2f9a6a";
      const real = [], p = [];
      for (let i = 0; i < n; i++) {
        const base = 120 + 38 * Math.sin(i / 3.2) + i * 1.3;
        real.push(base + (rnd() - 0.5) * 26 + (i === 27 ? 55 : 0));
        p.push(base + (rnd() - 0.5) * 8);
      }
      const X = (i) => 34 + (i / (n - 1)) * (W - 44), Y = (v) => H - 30 - (v - 60) * 0.95;
      let s = "";
      for (let g = 0; g <= 5; g++) { const y = 20 + g * 40; s += `<line x1="34" x2="${W - 10}" y1="${y}" y2="${y}" stroke="#9aa7b4" stroke-width=".6" opacity=".6"/>`; }
      for (let g = 0; g < 8; g++) { const x = 34 + g * 45; s += `<line y1="20" y2="${H - 30}" x1="${x}" x2="${x}" stroke="#9aa7b4" stroke-width=".6" opacity=".4"/><text x="${x}" y="${H - 14}" font-family="IBM Plex Mono,monospace" font-size="9" fill="#7c8894" text-anchor="middle">S${g * 5 + 1}</text>`; }
      const line = (arr, c, w, dash = "") => `<polyline points="${arr.map((v, i) => X(i).toFixed(1) + "," + Y(v).toFixed(1)).join(" ")}" fill="none" stroke="${c}" stroke-width="${w}" ${dash} stroke-linejoin="round"/>`;
      s += line(real, ink, 1.8) + line(p, pred, 2.2, 'stroke-dasharray="5 3"');
      s += `<rect x="${W - 128}" y="26" width="112" height="40" fill="#f2f0ea" stroke="#b9c2cb" stroke-width=".6"/>`;
      s += `<line x1="${W - 120}" x2="${W - 100}" y1="40" y2="40" stroke="${ink}" stroke-width="1.8"/><text x="${W - 94}" y="43" font-family="IBM Plex Mono,monospace" font-size="9.5" fill="#39434d">real</text>`;
      s += `<line x1="${W - 120}" x2="${W - 100}" y1="56" y2="56" stroke="${pred}" stroke-width="2.2" stroke-dasharray="5 3"/><text x="${W - 94}" y="59" font-family="IBM Plex Mono,monospace" font-size="9.5" fill="#39434d">predicción</text>`;
      return svg(W, H, s);
    },

    mesh() {
      // nube de puntos en clusters + malla de vecinos cercanos
      const W = 360, H = 300, pts = [];
      const C = [[90, 110, "#5fd0c0"], [230, 80, "#7ab8ff"], [270, 210, "#9be38f"], [120, 225, "#6fa8dc"]];
      for (const [cx, cy, col] of C) for (let i = 0; i < 26; i++) {
        const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * 52;
        pts.push([cx + Math.cos(a) * r * 1.2, cy + Math.sin(a) * r, col]);
      }
      let s = "";
      pts.forEach((a, i) => {
        const near = pts.map((b, j) => [Math.hypot(a[0] - b[0], a[1] - b[1]), j]).sort((x, y) => x[0] - y[0]).slice(1, 4);
        for (const [d, j] of near) if (j > i && d < 60) s += `<line x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${pts[j][0].toFixed(1)}" y2="${pts[j][1].toFixed(1)}" stroke="${a[2]}" stroke-width=".7" opacity=".45"/>`;
      });
      for (const [x, y, c] of pts) s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(2 + rnd() * 2.4).toFixed(1)}" fill="${c}" opacity=".9"/>`;
      const lab = [["álgebra", 40, 40], ["redes", 250, 20], ["probabilidad", 260, 290], ["optimización", 40, 292]];
      for (const [t, x, y] of lab) s += `<text x="${x}" y="${y}" font-family="IBM Plex Mono,monospace" font-size="10" fill="#b8c4c8">${t}</text>`;
      return svg(W, H, s);
    },
  };

  document.querySelectorAll("[data-fig]").forEach((el) => { const f = figs[el.dataset.fig]; if (f) el.innerHTML = f(); });
})();
