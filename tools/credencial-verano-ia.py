# Credencial Escuela Internacional de Verano en IA (versión limpia): se recorta la tarjeta sin el borde
# de la funda, y el clip de metal sin la argolla ni la cadena (la argolla pasa por detrás de la chapa del clip).
from PIL import Image, ImageDraw
import sys
src, out = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGBA')
W, H = im.size
S = 4
m = Image.new('L', (W*S, H*S), 0); d = ImageDraw.Draw(m)
def rr(x0, y0, x1, y1, r): d.rounded_rectangle([x0*S, y0*S, x1*S, y1*S], radius=r*S, fill=255)
rr(134, 717, 1003, 1280, 11)            # tarjeta: marco azul marino
rr(530, 522, 604, 640, 5)               # chapa de adelante del clip
rr(511, 606, 622, 722, 4)               # cuerpo del clip que muerde la tarjeta
for x in (498, 623):                    # remaches a los costados
    d.ellipse([x*S, 646*S, (x+15)*S, 676*S], fill=255)
im.putalpha(m.resize((W, H), Image.LANCZOS))
im = im.crop(im.getbbox())
n = 640
im.resize((n, round(im.height*n/im.width)), Image.LANCZOS).save(out, quality=90, method=6)
im.save(out.rsplit('.', 1)[0] + '_full.png')
print(im.size)
