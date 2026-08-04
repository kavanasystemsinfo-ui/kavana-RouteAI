#!/usr/bin/env python3
"""Genera fotos placeholder realistas para incidencias de RouteAI.
Una imagen por tipo de incidencia, guardadas en server/incidents/.
Usa solo PIL (ImageDraw) con formas geometricas, sin fuentes externas.
"""
from PIL import Image, ImageDraw
import os

OUT = os.path.join(os.path.dirname(__file__), '..', 'incidents')
os.makedirs(OUT, exist_ok=True)

W, H = 480, 360

def base():
    img = Image.new('RGB', (W, H), '#3a3f46')
    d = ImageDraw.Draw(img)
    # suelo
    d.rectangle([0, H - 70, W, H], fill='#5b6068')
    return img, d

def noise(d):
    import random
    random.seed(7)
    for _ in range(600):
        x, y = random.randint(0, W - 1), random.randint(0, H - 1)
        c = random.choice(['#3a3f46', '#40464e', '#353a41', '#454b53'])
        d.point((x, y), fill=c)

# 1) Bulto danado: caja con abolladura y cinta
img, d = base()
d.rectangle([120, 90, 360, 260], fill='#a9743e', outline='#7a5226', width=4)
d.rectangle([140, 110, 340, 240], fill='#b9814a', outline='#8a6232', width=3)
d.rectangle([120, 90, 360, 120], fill='#8a6232')          # tapa
d.rectangle([230, 120, 250, 260], fill='#d9c8a8')         # cinta central
d.polygon([(300, 140), (350, 160), (330, 210), (290, 185)], fill='#5a4a2e')  # abolladura
d.line([(285, 130), (345, 155), (320, 215)], fill='#3d2f1c', width=5)
d.text((170, 300), 'BULTO DANADO', fill='#ffd9a0')
noise(d)
img.save(os.path.join(OUT, 'bulto_danado.jpg'), quality=85)

# 2) Cliente ausente: puerta cerrada con cartel
img, d = base()
d.rectangle([150, 60, 330, 300], fill='#6b4a2f', outline='#4a3220', width=5)  # puerta
d.rectangle([160, 70, 320, 290], fill='#7d5838')
d.rectangle([295, 160, 305, 230], fill='#c9a86a')         # pomo
d.rectangle([170, 240, 310, 255], fill='#d9c8a8')         # papel
d.text((185, 285), 'NO ESTA', fill='#f5e6c8')
noise(d)
img.save(os.path.join(OUT, 'cliente_ausente.jpg'), quality=85)

# 3) Direccion incorrecta: calle con senal de cruce
img, d = base()
d.rectangle([0, 200, W, 260], fill='#6e6a5e')             # calzada
d.line([(240, 130), (240, 360)], fill='#e8e4d8', width=14)  # poste senal
d.rectangle([180, 60, 300, 130], fill='#2b5da8', outline='#ffffff', width=3)  # placa
d.text((205, 85), 'CALLE', fill='white')
d.text((200, 105), 'ERRADA', fill='white')
d.rectangle([0, 300, W, 360], fill='#5b6068')
noise(d)
img.save(os.path.join(OUT, 'direccion_incorrecta.jpg'), quality=85)

# 4) Rechazado: caja con flecha de devolucion
img, d = base()
d.rectangle([130, 100, 350, 260], fill='#8f8f8f', outline='#5f5f5f', width=4)
d.rectangle([130, 100, 350, 130], fill='#6f6f6f')
d.text((190, 285), 'DEVOLUCION', fill='#ffc0c0')
# flecha curva
d.arc([180, 150, 300, 230], start=90, end=360, fill='#e03030', width=8)
d.polygon([(300, 150), (300, 175), (315, 160)], fill='#e03030')
noise(d)
img.save(os.path.join(OUT, 'rechazado.jpg'), quality=85)

# 5) No se pudo acceder: verja cerrada con candado
img, d = base()
d.rectangle([120, 50, 360, 320], fill='#2f3237', outline='#1c1e22', width=4)
for x in range(140, 360, 24):
    d.rectangle([x, 60, x + 10, 310], fill='#3c4046')
d.rectangle([140, 140, 340, 170], fill='#3c4046')
d.rectangle([255, 175, 265, 205], fill='#d9a13b')          # candado
d.arc([250, 165, 270, 185], start=0, end=180, fill='#b9812a', width=5)
d.text((165, 20), 'ACCESO DENEGADO', fill='#ff9d9d')
noise(d)
img.save(os.path.join(OUT, 'sin_acceso.jpg'), quality=85)

# 6) Horario cerrado: persiana bajada (tipico España)
img, d = base()
d.rectangle([140, 60, 340, 300], fill='#8a8f96', outline='#5f646b', width=4)
for y in range(80, 300, 22):
    d.rectangle([140, y, 340, y + 12], fill='#9aa0a8')
d.rectangle([200, 300, 280, 330], fill='#5f646b')          # escalon
d.text((170, 20), 'CERRADO', fill='#ffd0a0')
noise(d)
img.save(os.path.join(OUT, 'horario_cerrado.jpg'), quality=85)

print('Generadas en', OUT)
for f in sorted(os.listdir(OUT)):
    if f.endswith('.jpg'):
        p = os.path.join(OUT, f)
        print(' ', f, os.path.getsize(p), 'bytes')
