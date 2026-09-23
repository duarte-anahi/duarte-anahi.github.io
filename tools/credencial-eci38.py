# Credencial ECI 38: logo de Exactas a la mitad, carnet más corto, fondo afuera y ojal agujereado.
from PIL import Image, ImageDraw, ImageFilter
import numpy as np, sys
src, out = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGB')
a = np.asarray(im).astype(float)
H, W = a.shape[:2]
S = 4
def rr(box, r, blur=0):
    m = Image.new('L', (W*S, H*S), 0); ImageDraw.Draw(m).rounded_rectangle([v*S for v in box], radius=r*S, fill=255)
    m = m.resize((W, H), Image.LANCZOS)
    if blur: m = m.filter(ImageFilter.GaussianBlur(blur))
    return np.asarray(m).astype(float)/255

LX0, LY0, LX1, LY1 = 505, 1188, 1120, 1558          # logo de Exactas
# 1) logo recortado: el blanco se queda, el violeta y los circuitos no
mn = a[LY0:LY1, LX0:LX1].min(2)
la = np.clip((mn-185)/45, 0, 1)
logo = Image.fromarray(np.dstack([np.full(la.shape+(3,), 250.), la*255]).astype(np.uint8), 'RGBA')
logo = logo.resize((logo.width//2, logo.height//2), Image.LANCZOS)

# 2) color de fondo sin circuitos: promedio de los píxeles violetas de alrededor, sin contar las líneas
#    (las líneas son más claras que el fondo: se marcan comparando con un mínimo local)
L = a.mean(2)
dark = np.asarray(Image.fromarray(L.astype(np.uint8)).filter(ImageFilter.MinFilter(17)).filter(ImageFilter.GaussianBlur(6))).astype(float)
plain = (L < dark + 22).astype(float)
def box(x, r, ax):
    c = np.cumsum(np.pad(x, [(r+1, r) if i == ax else (0, 0) for i in range(2)], mode='edge'), axis=ax)
    return (np.take(c, range(2*r+1, c.shape[ax]), axis=ax) - np.take(c, range(0, c.shape[ax]-2*r-1), axis=ax)) / (2*r+1)
def gblur(x, r):                      # tres pasadas de caja ≈ desenfoque gaussiano
    for _ in range(3): x = box(box(x, r, 0), r, 1)
    return x
w8 = gblur(plain, 30) + 1e-6
bg = np.dstack([gblur(a[..., c]*plain, 30)/w8 for c in range(3)])
# zona despejada donde estaba el logo: se rellena interpolando el violeta de los costados
ZX0, ZY0, ZX1, ZY1 = 455, 1140, 1170, 1610
zone = rr((ZX0+22, ZY0+22, ZX1-22, ZY1-22), 60, blur=10)
fill = a.copy()
xl, xr = ZX0-15, ZX1+15
t = ((np.arange(W)-xl)/(xr-xl)).clip(0,1)[None,:,None]
fill = bg[:, [xl]]*(1-t) + bg[:, [xr]]*t
fill = fill + np.random.default_rng(0).normal(0, 2.2, fill.shape[:2])[..., None]
a = a*(1-zone[...,None]) + fill*zone[...,None]

# 3) acortar: sacar una franja del medio de la zona despejada, con un fundido corto en la unión
CUT0, CUT = 1330, 170
top, bot = a[:CUT0+12], a[CUT0+CUT-12:]
k = np.linspace(0,1,24)[:,None,None]
seam = top[-24:]*(1-k) + bot[:24]*k
a = np.concatenate([top[:-24], seam, bot[24:]])
H = a.shape[0]

# 4) logo chico centrado en la zona
img = Image.fromarray(np.clip(a,0,255).astype(np.uint8)).convert('RGBA')
cy = (ZY0 + ZY1 - CUT)/2
img.alpha_composite(logo, (round((LX0+LX1)/2 - logo.width/2), round(cy - logo.height/2)))

# 5) recorte del carnet (esquinas redondeadas) + agujero del ojal
X0, Y0, X1, Y1 = 356, 177, 1262, 1803 - CUT
mask = rr((X0, Y0, X1, Y1), 18) * (1 - rr((767, 220, 859, 246), 12))
img.putalpha(Image.fromarray((mask*255).astype(np.uint8)))
img = img.crop((X0-2, Y0-2, X1+3, Y1+3))
n = 480
img.resize((n, round(img.height*n/img.width)), Image.LANCZOS).save(out, quality=90, method=6)
img.save(out.rsplit('.',1)[0]+'_full.png')
