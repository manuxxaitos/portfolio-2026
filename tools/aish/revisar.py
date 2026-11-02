"""Cruza los triángulos de la cara del logo con la máscara: cuenta los que caen fuera del dibujo (astillas)."""
import json, os
import numpy as np
from PIL import Image
here = os.path.dirname(os.path.abspath(__file__))
m = np.array(Image.open(os.path.join(here, 'src', 'logo-mascara.png')).convert('L')) < 128  # logo = negro
tris = json.load(open(os.path.join(here, 'src', 'triangulos.json')))
bad = []
for t in tris:
    a = np.array(t)
    c = a.mean(axis=0)
    x, y = int(round(c[0])), int(round(c[1]))
    area = abs(np.cross(a[1] - a[0], a[2] - a[0])) / 2
    longest = max(np.linalg.norm(a[i] - a[(i + 1) % 3]) for i in range(3))
    inside = 0 <= x < m.shape[1] and 0 <= y < m.shape[0] and m[y, x]
    if not inside and area > 0.5:
        bad.append((round(area, 1), round(longest, 1), x, y))
print(f'{len(tris)} triángulos; {len(bad)} con el centro fuera del dibujo')
for b in sorted(bad, reverse=True)[:15]:
    print('  área %7.1f  lado más largo %6.1f  en (%d, %d)' % b)
