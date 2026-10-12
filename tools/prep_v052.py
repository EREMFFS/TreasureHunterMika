#!/usr/bin/env python3
"""2026-10-11 MIKA_5D_RESEND_AND_WORLD_MAP_v052 をゲーム用に変換する。
使い方: python3 tools/prep_v052.py <MIKA_5D_RESEND_AND_WORLD_MAP_v052 フォルダ> <ゲームフォルダ>
  assets/bg_5D_main.webp    1152×216  5D 連絡通路（v041 の3画面。ダンダルモンの壁は画面1）
  assets/bg_world_map.webp  384×216   ワールドマップ（4=空中鉄道777・5=デスポリスの絵を追加。1〜3は元のまま）
  data/assets5.js の 5D_main の大きさを 1152×216 に書き換える
"""
import os, re, sys, shutil
from PIL import Image
PACK, GAME = sys.argv[1], sys.argv[2]
im = Image.open(os.path.join(PACK, 'assets', 'bg_5D_main_v041.png')).convert('RGB')
assert im.size == (1152, 216), im.size
im.save(os.path.join(GAME, 'assets', 'bg_5D_main.webp'), 'WEBP', lossless=True, quality=100, method=6)
wm = Image.open(os.path.join(PACK, 'assets', 'bg_world_map_v052.png')).convert('RGB')
assert wm.size == (384, 216), wm.size
wm.save(os.path.join(GAME, 'assets', 'bg_world_map.webp'), 'WEBP', lossless=True, quality=100, method=6)
p = os.path.join(GAME, 'data', 'assets5.js'); s = open(p, encoding='utf-8').read()
s2 = re.sub(r'("5D_main": \{"file": "assets/bg_5D_main.webp", "size": )\[768, 216\]', r'\1[1152, 216]', s)
open(p, 'w', encoding='utf-8').write(s2)
print('5D', im.size, 'world_map', wm.size, 'assets5.js', 'updated' if s2 != s else 'unchanged')
