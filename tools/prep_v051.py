#!/usr/bin/env python3
"""2026-10-11 不足素材 v051（MIKA_STAGE6_ENDING_MISSING_ASSETS_v051）をゲーム用に変換する。

使い方: python3 tools/prep_v051.py <MIKA_STAGE6_ENDING_MISSING_ASSETS_v051 フォルダ> <ゲームフォルダ>
出力:
  assets/bg_ending_terrace.webp  384×216 透過  エンディング冒頭の列車のテラス（後ろに夜空と街を描く）
  assets/bg_5A_H1.webp ほか8部屋     384×216      5A_H1・5A_H2・5A_H3・5B_H1・5B_H2・5F_H1・5H_H1・5I_H1
  data/assets_v051.js               長老の全ポーズ（待機・歩き6コマ・OK・屈む・慌てる・杖）を同じ倍率・同じ足支点で入れ直す
倍率: 長老の素材は 128×112・足支点(80,96)・立ち身長約51px（確認版の大きさ）。ゲームは確認版×48/42 なので全コマ共通で 48/42 倍
      （コマごとに頭〜足で合わせない＝v051の指示）
"""
import base64, io, json, os, sys
import numpy as np
from PIL import Image

PACK, GAME = sys.argv[1], sys.argv[2]
P = lambda *a: os.path.join(PACK, *a)
G = 48 / 42

def save_bg(src, out, alpha=False):
    im = Image.open(P(src)).convert('RGBA' if alpha else 'RGB')
    if im.size != (384, 216): im = im.resize((384, 216), Image.LANCZOS)
    im.save(os.path.join(GAME, 'assets', out), 'WEBP', lossless=True, quality=100, method=6, exact=True)
    print('bg', out, im.size)
save_bg('assets/ending/ending_terrace_384x216.png', 'bg_ending_terrace.webp', alpha=True)
ROOMS = ['5A_H1_v041', '5A_H2_v041', '5A_H3_v041', '5B_H1_v041', '5B_H2_v041', '5F_H1_v041', '5H_H1_v041', '5I_H1_v051']
for r in ROOMS: save_bg(f'assets/rooms/bg_{r}.png', 'bg_' + r.rsplit('_', 1)[0] + '.webp')

def hard_alpha(im, th=100):
    a = np.array(im); al = a[:, :, 3]
    a[:, :, 3] = np.where(al >= th, 255, 0); a[al < th, :3] = 0
    return Image.fromarray(a)
def opaque(im):
    a = np.array(im.convert('RGBA'))[:, :, 3]; ys, xs = np.nonzero(a > 20)
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1

META = json.load(open(P('ELDER_ANIMATIONS.json')))
PIV = META['footPivot']
items = []
def add(name, src):
    im = Image.open(P(src)).convert('RGBA')
    x0, y0, x1, y1 = opaque(im)
    im = im.crop((x0, y0, x1, y1)); px, py = PIV[0] - x0, PIV[1] - y0
    w, h = max(1, round(im.width * G)), max(1, round(im.height * G))
    items.append((name, hard_alpha(im.resize((w, h), Image.LANCZOS)), (round(px * G), round(py * G))))
for k in ('idle', 'ok', 'crouch', 'panic', 'staff_poke'): add('elder_' + k, f'assets/elder/elder_{k}.png')
WALK = [f['file'] for f in META['walk']['frames']]
for i, f in enumerate(WALK): add(f'elder_walk_{i:02d}', f)

PW = 1024; x = y = rowh = 0; pos = {}
for name, im, _ in items:
    if x + im.width > PW: x, y, rowh = 0, y + rowh + 1, 0
    pos[name] = (x, y); x += im.width + 1; rowh = max(rowh, im.height)
page = Image.new('RGBA', (PW, y + rowh))
for name, im, _ in items: page.alpha_composite(im, pos[name])
buf = io.BytesIO(); page.save(buf, 'WEBP', lossless=True, quality=100, method=6, exact=True)
uri = 'data:image/webp;base64,' + base64.b64encode(buf.getvalue()).decode('ascii')
frames = {n: [pos[n][0], pos[n][1], im.width, im.height, 0, 0, im.width, im.height] for n, im, _ in items}
O = {n: list(o) for n, im, o in items}
anims = {n: {'frames': [n], 'dur': [1000], 'origin': O[n], 'loop': True, 'left': True} for n in O if not n.startswith('elder_walk_')}
wn = [f'elder_walk_{i:02d}' for i in range(len(WALK))]
anims['elder_walk'] = {'frames': wn, 'dur': [f['durationMs'] for f in META['walk']['frames']], 'origins': [O[n] for n in wn], 'origin': O[wn[0]], 'loop': True, 'left': True}
out = os.path.join(GAME, 'data', 'assets_v051.js')
with open(out, 'w', encoding='utf-8') as f:
    f.write('// 自動生成: tools/prep_v051.py（長老の全ポーズを同じ倍率・足支点で入れ直し＋歩き6コマ・OK。エンディングのテラス・5面の部屋8つ）\n(function () {\nconst M = window.MIKA;\n')
    f.write('const P = M.ATLAS_PAGES.length;\n')
    f.write(f'M.ATLAS_PAGES[P] = "{uri}";\n')
    f.write('const F = ' + json.dumps(frames, separators=(',', ':')) + ';\n')
    f.write('for (const k in F) M.ATLAS.frames[k] = [P].concat(F[k]);\n')
    f.write('Object.assign(M.ANIMS, ' + json.dumps(anims, separators=(',', ':')) + ');\n')
    f.write('M.BG.ending_terrace = { file: "assets/bg_ending_terrace.webp", size: [384, 216] };\n')
    for r in ROOMS:
        k = r.rsplit('_', 1)[0]
        f.write(f'M.BG["room_{k}"] = {{ file: "assets/bg_{k}.webp", size: [384, 216] }};\n')
    f.write('})();\n')
for n, im, o in items: print(n, im.size, o)
print('wrote', out, page.size, len(uri) // 1024, 'KB')
