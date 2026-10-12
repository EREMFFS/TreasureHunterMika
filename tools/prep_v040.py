#!/usr/bin/env python3
"""v040 画像配置修正の取り込み（2026-10-11）。
使い方: python3 tools/prep_v040.py <MIKA_IMAGE_LAYOUT_FIX_v040/assets> <ゲームフォルダ>
- 5F・5C・5G（背景と手前ガラス）: そのまま WebP へ（反転しない）
- 5A: 最後の1画面（x=1536〜1920）だけ bg_5A_final_v040 に差し替え
- 4B到着: 雲・街の焼き込みのない空 → assets/bg_4_sky_clean.webp、空を抜いた駅 → assets/bg_4B_station.webp
"""
import os, sys
from PIL import Image
S, G = sys.argv[1], sys.argv[2]
def save(im, name, alpha=False):
    im.convert('RGBA' if alpha else 'RGB').save(os.path.join(G, 'assets', name), 'WEBP', lossless=True, quality=100, method=6)
for src, dst in [('bg_5F_main_v040.png', 'bg_5F_main.webp'), ('bg_5C_main_v040.png', 'bg_5C_main.webp'), ('bg_5G_main_v040.png', 'bg_5G_main.webp')]:
    save(Image.open(os.path.join(S, src)), dst)
save(Image.open(os.path.join(S, 'bg_5G_glass_v040.png')), 'bg_5G_glass.webp', alpha=True)
a = Image.open(os.path.join(G, 'assets', 'bg_5A_main.webp')).convert('RGB')
fin = Image.open(os.path.join(S, 'bg_5A_final_v040.png')).convert('RGBA')
a.paste(fin.convert('RGB'), (1536, 0), fin)
save(a, 'bg_5A_main.webp')
save(Image.open(os.path.join(S, 'bg_4_sky_v040.png')), 'bg_4_sky_clean.webp', alpha=True)
save(Image.open(os.path.join(S, 'bg_4B_station_v040.png')), 'bg_4B_station.webp', alpha=True)
print('ok')
