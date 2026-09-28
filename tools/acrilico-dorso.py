# Arma img/acrilico-dorso.webp (dorso del separador acanalado) a partir de una foto de Gemini del acrílico:
# endereza la perspectiva, se queda solo con el relieve (canaletas, filos, rayones, huellas) y lo guarda sobre transparente.
# Uso: python tools/acrilico-dorso.py   (la foto original quedó en Descargas; cambiar la ruta si se mueve)
from PIL import Image, ImageFilter
import numpy as np, os
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
src = Image.open(r'C:/Users/nova/Downloads/Gemini_Generated_Image_rpn48krpn48krpn4.jpg').convert('L')
W, H = 1700, 1636
# esquinas de la cara de arriba de la lámina (medidas): arriba-izq, arriba-der, abajo-der, abajo-izq
quad = [(274, 85), (2528, 85), (2703, 1400), (111, 1400)]
dst = [(0, 0), (W, 0), (W, H), (0, H)]
A = []; b = []
for (x, y), (u, v) in zip(quad, dst):
    A.append([u, v, 1, 0, 0, 0, -x * u, -x * v]); b.append(x)
    A.append([0, 0, 0, u, v, 1, -y * u, -y * v]); b.append(y)
coef = np.linalg.solve(np.array(A, float), np.array(b, float))
img = src.transform((W, H), Image.PERSPECTIVE, tuple(coef), Image.BICUBIC)

a = np.asarray(img).astype(float)
low = np.asarray(img.filter(ImageFilter.GaussianBlur(18))).astype(float)
det = a - low                                  # solo el relieve: canaletas, filos, rayones, huellas
n = np.percentile(np.abs(det), 99.5)
luz = np.clip(det / n, 0, 1); sombra = np.clip(-det / n, 0, 1)
veloBase = np.asarray(img.filter(ImageFilter.GaussianBlur(120))).astype(float)
velo = 0.03 + 0.05 * (veloBase - veloBase.min()) / (np.ptp(veloBase) + 1e-6)   # velo lechoso, más claro donde la foto es más clara

# capas: velo blanco, encima luces blancas y sombras gris oscuro (composición "over")
def over(ct, at, cb, ab):
    ao = at + ab * (1 - at)
    co = (ct * at + cb * ab * (1 - at)) / np.maximum(ao, 1e-6)
    return co, ao
c, al = over(255.0, 0.5 * luz, 255.0, velo)
c, al = over(28.0, 0.6 * sombra, c, al)
rgba = np.dstack([c, c, c * 1.0 + 0, al * 255]).clip(0, 255).astype(np.uint8)
rgba[..., 2] = np.clip(c + 4, 0, 255)  # apenas azulado, como el acrílico
out = Image.fromarray(rgba, 'RGBA')
out = out.resize((1275, 1227), Image.LANCZOS); out.save('img/acrilico-dorso.webp', quality=80, method=6)
print(os.path.getsize('img/acrilico-dorso.webp'))
