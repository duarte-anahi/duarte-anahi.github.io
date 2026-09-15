/* Figuras vectoriales "impresas" en las hojas. Vector = nítidas a cualquier tamaño. */
(() => {
  const NS = "http://www.w3.org/2000/svg";
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
  };

  document.querySelectorAll("[data-fig]").forEach((el) => { const f = figs[el.dataset.fig]; if (f) el.innerHTML = f(); });
})();
