# Credencial Hakiatón Buenos Aires 2026: funda plástica transparente (como la de Nerdearla) con la ranura agujereada.
# La funda deja ver la mesa de concreto: sus puntitos se filtran (mediana) para que no queden como mugre en el plástico.
from PIL import Image, ImageDraw, ImageFilter
import numpy as np, sys
src, out = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGB')
X0, Y0, X1, Y1 = 370, 452, 1149, 1587          # funda
im = im.crop((X0, Y0, X1, Y1)); w, h = im.size
rgb = np.asarray(im).astype(float)
S = 4
def rr(box, r, elipse=False):
    m = Image.new('L', (w*S, h*S), 0); d = ImageDraw.Draw(m)
    (d.ellipse if elipse else d.rounded_rectangle)([v*S for v in box], **({} if elipse else {'radius': r*S}), fill=255)
    return np.asarray(m.resize((w, h), Image.LANCZOS)).astype(float)/255
funda = rr((0, 0, w-1, h-1), 16)
tarjeta = rr((396-X0, 572-Y0, 1128-X0, 1568-Y0), 3)
ranura = rr((705-X0, 485-Y0, 824-X0, 509-Y0), 12)
# plástico: lo liso deja ver lo de atrás; bordes, costuras y brillos quedan más marcados
L = np.asarray(im.convert('L').filter(ImageFilter.MedianFilter(7))).astype(float)
fondo = np.asarray(Image.fromarray(L.astype(np.uint8)).filter(ImageFilter.GaussianBlur(14))).astype(float)
detalle = np.abs(L - fondo)
alfa_pl = np.clip(0.2 + detalle/24 + np.clip((L-215)/35, 0, 1)*0.3 + np.clip((175-L)/40, 0, 1)*0.5, 0, 0.9)
gris = np.repeat(L[..., None], 3, 2)
color = tarjeta[..., None]*rgb + (1-tarjeta[..., None])*gris
alfa = (tarjeta + (1-tarjeta)*alfa_pl) * funda * (1 - ranura)
img = Image.fromarray(np.dstack([np.clip(color, 0, 255), alfa*255]).astype(np.uint8), 'RGBA')
n = 480
img.resize((n, round(h*n/w)), Image.LANCZOS).save(out, quality=90, method=6)
img.save(out.rsplit('.', 1)[0] + '_full.png')
