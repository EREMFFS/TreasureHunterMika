#!/usr/bin/env python3
"""2026-10-11 エンディング（MIKA_AFTER_5A_HANDOFF_v034/escape_6b_f_ending_v032）の絵をゲーム用に変換する。
使い方: python3 tools/prep_v032_ending.py <escape_6b_f_ending_v032 フォルダ> <ゲームフォルダ>
  assets/end_<景色>.webp  420×216  スタッフロールの景色（雲・森・村・山・町・海・砂漠）と脱出の街（左170pxを切った範囲）
  assets/end_airtrain.webp          長い空中列車（左向き・車輪なし）。元の bounds [15,409,1657,542] を 490幅に縮小
  data/assets_ending.js            上の読み込み登録と、列車の車両1両ぶんの範囲（車両を後ろへつなげて長編成にする）
"""
import os, sys, json
from PIL import Image
SRC, GAME = sys.argv[1], sys.argv[2]
A = lambda n: os.path.join(SRC, 'assets', n)
out = {}
for n in ['clouds', 'forest', 'village', 'mountain', 'town', 'sea', 'desert', 'city']:
    im = Image.open(A(f'ending_{n}.png')).convert('RGB')
    if n == 'city': im = im.crop((170, 0, im.width, im.height))
    im = im.resize((420, 216), Image.LANCZOS)
    im.save(os.path.join(GAME, 'assets', f'end_{n}.webp'), 'WEBP', quality=92, method=6)
    out[f'end_{n}'] = {'file': f'assets/end_{n}.webp', 'size': [420, 216]}
B = [15, 409, 1657, 542]; CAR = [475, 409, 670, 542]; W = 490
k = W / (B[2] - B[0]); H = round((B[3] - B[1]) * k)
tr = Image.open(A('ending_airtrain.png')).convert('RGBA').crop(tuple(B)).resize((W, H), Image.LANCZOS)
tr.save(os.path.join(GAME, 'assets', 'end_airtrain.webp'), 'WEBP', lossless=True, method=6)
out['end_airtrain'] = {'file': 'assets/end_airtrain.webp', 'size': [W, H]}
car = [round((CAR[0] - B[0]) * k), 0, round((CAR[2] - CAR[0]) * k), H]
with open(os.path.join(GAME, 'data', 'assets_ending.js'), 'w', encoding='utf-8') as f:
    f.write('// 自動生成: tools/prep_v032_ending.py（エンディング v032 の景色と長い空中列車）\n(function () {\nconst M = window.MIKA;\n')
    f.write('Object.assign(M.BG, ' + json.dumps(out, separators=(',', ':')) + ');\n')
    f.write('M.END_TRAIN = ' + json.dumps({'w': W, 'h': H, 'car': car}) + ';   // car = 中の車両1両 [x, y, w, h]（機関車は使わない）\n})();\n')
print(out, car)
