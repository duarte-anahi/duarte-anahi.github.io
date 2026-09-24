# Credencial Ekoparty 20 (imagen generada): se endereza (estaba fotografiada torcida sobre la mesa),
# se borra el cordón donde pisa la tarjeta, el agujero queda transparente y se recortan las esquinas redondeadas.
from PIL import Image, ImageDraw
import numpy as np, sys
src, out = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGB')
TL, TR, BR, BL = (712, 154), (1622, 509), (1203, 1885), (178, 1498)   # esquinas de la tarjeta en la foto
W, H, M = 980, 1440, 20
def coeffs(dst, src):
    A, b = [], []
    for (x, y), (u, v) in zip(dst, src):
        A += [[x, y, 1, 0, 0, 0, -u*x, -u*y], [0, 0, 0, x, y, 1, -v*x, -v*y]]; b += [u, v]
    return np.linalg.solve(np.array(A, float), np.array(b, float)).tolist()
img = im.transform((W + 2*M, H + 2*M), Image.PERSPECTIVE, coeffs([(M, M), (W+M, M), (W+M, H+M), (M, H+M)], [TL, TR, BR, BL]), Image.BICUBIC)

# cordón sobre la tarjeta: en esa zona el diseño son franjas verticales, así que cada columna se rellena
# con la misma columna de más abajo; el borde fucsia de arriba se copia de al lado.
parche = img.crop((470, 214, 606, 290))                   # columnas de más abajo, sin cordón ni texto
borde = np.ones((parche.height, parche.width))
f = np.linspace(0, 1, 14)
borde[:, :14] *= f; borde[:, -14:] *= f[::-1]; borde[-14:, :] *= f[::-1, None]   # bordes suaves: se funde con lo de al lado
img.paste(parche, (470, 26), Image.fromarray((borde * 255).astype(np.uint8)))
img.paste(img.crop((420, M, 507, M + 9)), (503, M))

S = 4
m = Image.new('L', (img.width*S, img.height*S), 0); d = ImageDraw.Draw(m)
d.rounded_rectangle([M*S, M*S, (W+M)*S, (H+M)*S], radius=30*S, fill=255)
cx, cy, r = 545, 110, 34                                  # agujero
d.ellipse([(cx-r)*S, (cy-r)*S, (cx+r)*S, (cy+r)*S], fill=0)
img.putalpha(m.resize(img.size, Image.LANCZOS))
img = img.crop((M-2, M-2, W+M+2, H+M+2))
n = 480
img.resize((n, round(img.height*n/img.width)), Image.LANCZOS).save(out, quality=90, method=6)
img.save(out.rsplit('.', 1)[0] + '_full.png')
