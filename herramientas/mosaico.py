# Uso: python mosaico.py <salida.png> <columnas> <ancho_miniatura> img1 img2 ...
import sys
from PIL import Image, ImageDraw
out, cols, W = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]); fs = sys.argv[4:]
ims = [Image.open(f).convert("RGB") for f in fs]
H = round(W * ims[0].height / ims[0].width)
sh = Image.new("RGB", (cols * W + (cols + 1) * 8, ((len(ims) + cols - 1) // cols) * (H + 8) + 8), (40, 20, 36))
for k, im in enumerate(ims):
    sh.paste(im.resize((W, H), Image.LANCZOS), (8 + (k % cols) * (W + 8), 8 + (k // cols) * (H + 8)))
sh.save(out)
