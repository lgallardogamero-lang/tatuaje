# Hoja de contacto de los instantes guardados: python3 marketing/build/contacto.py <escena> [columnas]
import sys, glob, re
from PIL import Image
name = sys.argv[1]; cols = int(sys.argv[2]) if len(sys.argv) > 2 else 3
files = sorted(glob.glob(f"screenshots/marketing/{name}-*s.png"), key=lambda f: float(re.search(r"-([\d_]+)s\.png", f).group(1).replace("_", ".")))
ims = [Image.open(f).convert("RGB") for f in files]
w, h = 300, 533
sheet = Image.new("RGB", (cols * w, ((len(ims) + cols - 1) // cols) * h), (30, 30, 36))
for i, im in enumerate(ims): sheet.paste(im.resize((w, h), Image.LANCZOS), ((i % cols) * w, (i // cols) * h))
sheet.save(f"screenshots/marketing/{name}-hoja.png"); print(len(ims), "fotogramas", sheet.size)
