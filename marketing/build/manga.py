# Coloca un tatuaje de manga (imagen de referencia) envolviendo el antebrazo de la foto: marketing/assets/brazo-manga.jpg
import sys, numpy as np
from PIL import Image, ImageFilter, ImageChops
ref_path = sys.argv[1]
base = Image.open("marketing/assets/brazo-giro.jpg").convert("RGB")
Wf, Hf = base.size
ref = Image.open(ref_path).convert("L").crop((106, 0, 189, 222))
a = np.clip((np.asarray(ref).astype(float) - 25) / 200, 0, 1) ** 1.15
s = 6.8
P = Image.fromarray((a * 255).astype("uint8")).resize((int(ref.width * s), int(ref.height * s)), Image.LANCZOS).filter(ImageFilter.UnsharpMask(radius=4, percent=90, threshold=2))
P = np.asarray(P).astype(float)
Hp, Wp = P.shape
# bordes de la manga en la referencia, fila a fila (columnas con tinta)
ink = np.asarray(Image.fromarray(P.astype("uint8")).filter(ImageFilter.GaussianBlur(10))) < 235
def edges(mask):
    L = np.zeros(mask.shape[0]); R = np.zeros(mask.shape[0])
    for y in range(mask.shape[0]):
        xs = np.flatnonzero(mask[y])
        L[y], R[y] = (xs[0], xs[-1]) if len(xs) > 20 else (np.nan, np.nan)
    return L, R
def fill(v):
    idx = np.arange(len(v)); ok = ~np.isnan(v)
    v = np.interp(idx, idx[ok], v[ok])
    k = np.ones(61) / 61
    return np.convolve(np.pad(v, 30, mode="edge"), k, mode="valid")
pl, pr = [fill(e) for e in edges(ink)]
# bordes del brazo en la foto
hsv = np.asarray(base.convert("HSV")).astype(int)
skin = (hsv[..., 0] >= 4) & (hsv[..., 0] <= 30) & (hsv[..., 1] > 70) & (hsv[..., 2] > 90)
skin = np.asarray(Image.fromarray(skin.astype("uint8") * 255).filter(ImageFilter.MinFilter(9)).filter(ImageFilter.MaxFilter(9))) > 128
YB = 1440                               # la muñeca: ahí termina la manga
al, ar = edges(skin[:YB])
al, ar = fill(al), fill(ar)
out = np.full((Hf, Wf), 255.0)
inset = 0.05
for y in range(YB):
    L, R = al[y] + (ar[y] - al[y]) * inset, ar[y] - (ar[y] - al[y]) * inset
    xs = np.arange(int(L), int(R) + 1)
    u = np.clip((xs - L) / max(R - L, 1), 0, 1)
    t = 0.5 + np.arcsin(2 * u - 1) / np.pi            # envuelve el cilindro del brazo
    r = (y + 20) / (YB + 20) * (Hp - 1)               # la referencia se estira de codo a muñeca
    c = pl[int(r)] + t * (pr[int(r)] - pl[int(r)])
    r0 = int(r); c0 = np.clip(c.astype(int), 0, Wp - 2); fx = c - c0
    row = P[r0, c0] * (1 - fx) + P[r0, c0 + 1] * fx
    edge = np.minimum(1, np.minimum(u, 1 - u) / 0.06)  # borde suave
    fade = np.clip((YB - y) / 70, 0, 1)
    out[y, xs] = 255 - (255 - row) * edge * fade
lum = Image.fromarray(out.astype("uint8")).filter(ImageFilter.GaussianBlur(0.9))
rgb = Image.merge("RGB", (lum.point(lambda v: 255 - (255 - v) * 0.88), lum.point(lambda v: 255 - (255 - v) * 0.92), lum.point(lambda v: 255 - (255 - v) * 0.97)))
ImageChops.multiply(base, rgb).save("marketing/assets/brazo-manga.jpg", quality=92)
Image.open("marketing/assets/brazo-manga.jpg").resize((270, 480)).save("/tmp/manga_s.png")
