/*
  Cuero de cocodrilo procedural.
  Genera la textura en un Web Worker (no bloquea la página) y la devuelve como URL de imagen.
  Nada de fotos: escamas = diagrama de Voronoi, relieve = mapa de alturas, luz = lateral desde arriba a la izquierda.
*/
(function () {
  function worker(self) {
    self.onmessage = function (e) {
      const { W, H, seed } = e.data;
      let s = seed >>> 0;
      const rnd = () => {
        s = (s + 0x6d2b79f5) | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
      const sstep = (a, b, x) => {
        const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
        return t * t * (3 - 2 * t);
      };

      // 1) Sitios de escamas, en filas alineadas (como la piel real):
      //    centro = "panza": 4 columnas de rectángulos anchos; costados = escamas chicas casi cuadradas.
      const rowH = W / 23;
      const sx = [], sy = [], sh = [], stx = [], sty = [];
      // las filas se arquean hacia los costados (como la panza del animal)
      const bend = (x) => { const u = (x - W / 2) / (W / 2); return -rowH * 1.1 * u * u; };
      const push = (x, y) => {
        sx.push(x); sy.push(y + bend(x)); sh.push(rnd());
        stx.push((rnd() - 0.5) * 0.012); sty.push((rnd() - 0.5) * 0.012);
      };
      const nc = 4, bw = rowH * 2.5, b0 = W / 2 - (nc * bw) / 2, b1 = W / 2 + (nc * bw) / 2;
      let row = 0;
      for (let y = -rowH; y < H + rowH * 3; row++) {
        const h = rowH * (0.8 + rnd() * 0.4);
        const cy = y + h / 2;
        for (let c = 0; c < nc; c++) {
          const x = b0 + (c + 0.5) * bw + (rnd() - 0.5) * bw * 0.16;
          push(x, cy + (rnd() - 0.5) * h * 0.12);
        }
        // costados: desde el borde de la panza hacia afuera, escamas que se achican hacia el canto
        for (const dir of [-1, 1]) {
          let x = dir < 0 ? b0 : b1;
          let first = true;
          while (x > -rowH * 2 && x < W + rowH * 2) {
            const t = Math.min(1, Math.abs(x - W / 2) / (W / 2));
            const w = rowH * (first ? 1.5 : 1.05 - 0.3 * t) * (0.85 + rnd() * 0.3);
            push(x + dir * w / 2 + (rnd() - 0.5) * w * 0.15, cy + (rnd() - 0.5) * h * 0.22 + (row % 2 ? 0.08 : -0.08) * h * t);
            x += dir * w; first = false;
          }
        }
        y += h;
      }

      // 2) Grilla de buckets para buscar vecinos rápido.
      const B = Math.ceil(rowH * 2.6);
      const GW = Math.ceil(W / B) + 4, GH = Math.ceil(H / B) + 4;
      const grid = Array.from({ length: GW * GH }, () => []);
      for (let i = 0; i < sx.length; i++) {
        const gx = Math.floor(sx[i] / B) + 2, gy = Math.floor(sy[i] / B) + 2;
        if (gx >= 0 && gy >= 0 && gx < GW && gy < GH) grid[gy * GW + gx].push(i);
      }

      // 3) Mapa de alturas.
      const hmap = new Float32Array(W * H);
      const groove = rowH * 0.075;
      for (let y = 0; y < H; y++) {
        const gy = Math.floor(y / B) + 2;
        for (let x = 0; x < W; x++) {
          const gx = Math.floor(x / B) + 2;
          let d1 = 1e12, d2 = 1e12, i1 = -1, i2 = -1;
          for (let oy = -1; oy <= 1; oy++) {
            for (let ox = -1; ox <= 1; ox++) {
              const cell = grid[(gy + oy) * GW + gx + ox];
              if (!cell) continue;
              for (let k = 0; k < cell.length; k++) {
                const i = cell[k];
                const dx = x - sx[i], dy = y - sy[i];
                const dd = dx * dx + dy * dy;
                if (dd < d1) { d2 = d1; i2 = i1; d1 = dd; i1 = i; }
                else if (dd < d2) { d2 = dd; i2 = i; }
              }
            }
          }
          let edge = 20;
          if (i2 >= 0) {
            const ex = sx[i2] - sx[i1], ey = sy[i2] - sy[i1];
            edge = (d2 - d1) / (2 * Math.sqrt(ex * ex + ey * ey));
          }
          // tapa plana con borde redondeado (almohadilla), sin crestas en el medio
          const tile = sstep(0, groove * 2.4, edge);
          const pillow = sstep(0, rowH * 0.22, edge);
          const tilt = (x - sx[i1]) * stx[i1] + (y - sy[i1]) * sty[i1];
          hmap[y * W + x] = tile * (0.6 + 0.25 * pillow + 0.1 * sh[i1] + tilt) + (rnd() - 0.5) * 0.03;
        }
      }

      // 4) Iluminación (normal desde gradiente de alturas).
      const out = new Uint8ClampedArray(W * H * 4);
      let lx = -0.55, ly = -0.6, lz = 0.58;
      const ll = Math.hypot(lx, ly, lz); lx /= ll; ly /= ll; lz /= ll;
      let hx = lx, hy = ly, hz = lz + 1;
      const hl = Math.hypot(hx, hy, hz); hx /= hl; hy /= hl; hz /= hl;
      const k = rowH * 0.07;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const i = y * W + x;
          const xl = hmap[i - (x > 0 ? 1 : 0)], xr = hmap[i + (x < W - 1 ? 1 : 0)];
          const yu = hmap[i - (y > 0 ? W : 0)], yd = hmap[i + (y < H - 1 ? W : 0)];
          let nx = (xl - xr) * k, ny = (yu - yd) * k, nz = 1;
          const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
          const diff = Math.max(0, nx * lx + ny * ly + nz * lz);
          const spec = Math.pow(Math.max(0, nx * hx + ny * hy + nz * hz), 22);
          const ao = 0.35 + 0.65 * Math.min(1, hmap[i] * 1.5);
          const v = (12 + 26 * diff) * ao + spec * 70;
          const p = i * 4;
          out[p] = v * 1.02; out[p + 1] = v; out[p + 2] = v * 0.97; out[p + 3] = 255;
        }
      }
      self.postMessage({ W, H, buf: out.buffer }, [out.buffer]);
    };
  }

  window.makeLeather = function ({ width, height, seed = 11 }) {
    return new Promise((resolve) => {
      const job = { W: Math.round(width), H: Math.round(height), seed };
      const done = ({ W, H, buf }) => {
        const c = document.createElement("canvas");
        c.width = W; c.height = H;
        c.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(buf), W, H), 0, 0);
        resolve(c.toDataURL("image/jpeg", 0.9));
      };
      let w = null;
      try {
        if (!/[?&]sync/.test(location.search)) {
          w = new Worker(URL.createObjectURL(new Blob(["(" + worker.toString() + ")(self)"], { type: "text/javascript" })));
        }
      } catch (err) { w = null; }
      if (w) {
        w.onmessage = (e) => { done(e.data); w.terminate(); };
        w.postMessage(job);
      } else {
        // respaldo: mismo cálculo en el hilo principal
        const fake = { postMessage: (d) => done(d) };
        worker(fake);
        fake.onmessage({ data: job });
      }
    });
  };
})();
