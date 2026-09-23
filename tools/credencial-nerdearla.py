# Credencial: saca el gancho, deja la funda semitransparente y le pone un ojal de metal.
from PIL import Image, ImageDraw, ImageFilter
import numpy as np, sys
src, out = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGB')
# 1) tapar gancho con la franja vecina
for dx in (352, 440):
    im.paste(im.crop((250,150,350,262)), (dx,150))
X0,Y0,X1,Y1 = 70,164,706,1222
im = im.crop((X0,Y0,X1,Y1)); w,h = im.size
rgb = np.asarray(im).astype(float)
L = rgb.mean(2)
S=4
def rr(box, r):
    m=Image.new('L',(w*S,h*S),0); ImageDraw.Draw(m).rounded_rectangle([v*S for v in box],radius=r*S,fill=255)
    return np.asarray(m.resize((w,h),Image.LANCZOS)).astype(float)/255
outer = rr((0,0,w-1,h-1),20)
card  = rr((102-X0,324-Y0,683-X0,1199-Y0),22)
# 2) plástico: lo liso deja ver lo de atrás; bordes, cierre y brillos quedan más marcados
blur = np.asarray(Image.fromarray(L.astype(np.uint8)).filter(ImageFilter.GaussianBlur(12))).astype(float)
detail = np.abs(L-blur)
bright = np.clip((L-205)/40,0,1)          # brillos
dark   = np.clip((200-L)/40,0,1)          # sombras / bordes del plástico
a_pl = np.clip(0.22 + detail/28 + 0.35*bright + 0.55*dark, 0, 0.9)
# color del plástico: blanco para brillos, gris para líneas
g = np.repeat(L[...,None],3,2)
col_pl = np.where(dark[...,None]>0, g, np.clip(g*1.05,0,255))
alpha = card + (1-card)*a_pl
alpha *= outer
color = card[...,None]*rgb + (1-card[...,None])*col_pl
# 3) ojal: agujero real + aro de metal
cx,cy = (X1-X0)/2, 44
ys,xs = np.mgrid[0:h,0:w]
def ring_mask(rad):
    m=Image.new('L',(w*S,h*S),0); ImageDraw.Draw(m).ellipse([(cx-rad)*S,(cy-rad)*S,(cx+rad)*S,(cy+rad)*S],fill=255)
    return np.asarray(m.resize((w,h),Image.LANCZOS)).astype(float)/255
R_out, R_in = 21, 12
m_out, m_in = ring_mask(R_out), ring_mask(R_in)
metal = m_out - m_in
ang = np.arctan2(ys-cy, xs-cx)
r = np.hypot(xs-cx, ys-cy)
t = np.clip((r-R_in)/(R_out-R_in),0,1)
bevel = np.sin(t*np.pi)                            # abombado del aro
light = 0.5 + 0.5*np.cos(ang + 2.3)              # luz desde arriba a la izquierda
v = 95 + 110*bevel*light + 40*bevel + 30*(1-bevel)*(1-light)
spec = np.clip((bevel*light-0.75)/0.25,0,1)*60
v = np.clip(v+spec,0,255)
mcol = np.stack([v*1.0, v*0.99, v*0.96],2)
color = color*(1-metal[...,None]) + mcol*metal[...,None]
alpha = alpha*(1-m_out) + metal                  # agujero: alfa 0
# sombrita del aro sobre el plástico
sh = np.asarray(Image.fromarray((m_out*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(3))).astype(float)/255
sh = np.roll(np.roll(sh,2,0),2,1)*(1-m_out)
alpha = np.maximum(alpha, sh*0.45*(1-m_in)); color = color*(1-sh[...,None]*0.6)
res = np.dstack([np.clip(color,0,255), np.clip(alpha*255,0,255)]).astype(np.uint8)
img = Image.fromarray(res,'RGBA')
n=480; img.resize((n,round(h*n/w)),Image.LANCZOS).save(out, quality=90, method=6)
img.save(out.rsplit('.',1)[0]+'_full.png')
