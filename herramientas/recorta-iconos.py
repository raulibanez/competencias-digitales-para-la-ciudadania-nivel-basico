"""Separa una hoja de iconos generada (PNG con fondo transparente, iconos en una fila) en iconos sueltos WebP.

Uso:
    python -I herramientas/recorta-iconos.py hoja.png carpeta-destino nombre1,nombre2,...

Busca las columnas con contenido, une los tramos hasta quedarse con tantos iconos como nombres,
recorta cada icono a su caja con un pequeño margen, lo reduce a 360 px de alto como máximo
y lo guarda como carpeta-destino/nombre.webp (con transparencia).
"""
import sys
import pathlib
from PIL import Image


def recorta(hoja, destino, nombres, alto_max=360, umbral=24, margen=12):
    im = Image.open(hoja).convert("RGBA")
    alfa = im.split()[3]
    W, H = im.size
    px = alfa.load()
    cols = [any(px[x, y] > umbral for y in range(0, H, 2)) for x in range(W)]
    tramos, x = [], 0
    while x < W:
        if cols[x]:
            ini = x
            while x < W and cols[x]:
                x += 1
            tramos.append([ini, x])
        x += 1
    n = len(nombres)
    while len(tramos) > n:  # une los tramos más cercanos
        huecos = [(tramos[i + 1][0] - tramos[i][1], i) for i in range(len(tramos) - 1)]
        _, i = min(huecos)
        tramos[i] = [tramos[i][0], tramos[i + 1][1]]
        del tramos[i + 1]
    if len(tramos) < n:  # reserva: columnas iguales
        tramos = [[i * W // n, (i + 1) * W // n] for i in range(n)]
    destino = pathlib.Path(destino)
    destino.mkdir(parents=True, exist_ok=True)
    for (x0, x1), nombre in zip(tramos, nombres):
        caja = alfa.crop((x0, 0, x1, H)).point(lambda v: 255 if v > umbral else 0).getbbox()
        if not caja:
            print("vacío:", nombre)
            continue
        l, t, r, b = caja
        ic = im.crop((max(0, x0 + l - margen), max(0, t - margen), min(W, x0 + r + margen), min(H, b + margen)))
        if ic.height > alto_max:
            ic = ic.resize((round(ic.width * alto_max / ic.height), alto_max), Image.LANCZOS)
        ic.save(destino / f"{nombre}.webp", "WEBP", quality=88, method=6)
        print(nombre, ic.size)


if __name__ == "__main__":
    recorta(sys.argv[1], sys.argv[2], sys.argv[3].split(","))
