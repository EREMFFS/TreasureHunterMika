#!/usr/bin/env python3
"""2026-10-11 5I・5J・6面の素材（MIKA_STAGE6_RECOVERED_ASSETS_v050）をゲーム用に変換する。

使い方: python3 tools/prep_v050.py <MIKA_STAGE6_RECOVERED_ASSETS_v050 フォルダ> <ゲームフォルダ>
出力:
  assets/bg_5I_main.webp   1920×216  5I展望台（entry→middle×3→exit。v027確認版と同じ5画面）
  assets/bg_6B_main.webp   1920×216  6B（左端は閉じたエレベーター entry_closed_6B。右から左へ逆走。絵は反転しない）
  assets/bg_5J_main.webp   384×216   5J宝物庫・6A（原画 1672×941 を縮小）
  data/assets_v050.js      追加アトラス1枚（長老4ポーズ・しがみつき・ミカの床パンチ4コマ・宝箱2・ウルトラマシーンS）
倍率: ゲームのミカ（待機の不透明部分の高さ48px）＝ 確認版のミカ（42）なので、確認版の表示高さ×48/42 をゲームの高さにする
"""
import base64, io, json, os, sys
import numpy as np
from PIL import Image

PACK, GAME = sys.argv[1], sys.argv[2]
P = lambda *a: os.path.join(PACK, *a)
G = 48 / 42

def bg(paths, out):
    W = 384 * len(paths); im = Image.new('RGB', (W, 216))
    for i, p in enumerate(paths): im.paste(Image.open(P('assets', p)).convert('RGB').resize((384, 216), Image.LANCZOS), (i * 384, 0))
    im.save(os.path.join(GAME, 'assets', out), 'WEBP', lossless=True, quality=100, method=6)
    print('bg', out, im.size)
bg(['5I/entry.png', '5I/middle.png', '5I/middle.png', '5I/middle.png', '5I/exit.png'], 'bg_5I_main.webp')
bg(['5I/entry_closed_6B.png', '5I/middle.png', '5I/middle.png', '5I/middle.png', '5I/exit.png'], 'bg_6B_main.webp')
bg(['5J/background_original.png'], 'bg_5J_main.webp')

def hard_alpha(im, th=100):
    a = np.array(im); al = a[:, :, 3]
    a[:, :, 3] = np.where(al >= th, 255, 0); a[al < th, :3] = 0
    return Image.fromarray(a)
def opaque(im):
    a = np.array(im.convert('RGBA'))[:, :, 3]; ys, xs = np.nonzero(a > 20)
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1

items = []   # (name, trimmed image, origin in trimmed image)
def add(name, src, scale, pivot, box=None):
    im = Image.open(src).convert('RGBA')
    if box: im = im.crop(box); pivot = (pivot[0] - box[0], pivot[1] - box[1])
    x0, y0, x1, y1 = opaque(im)
    im = im.crop((x0, y0, x1, y1)); px, py = pivot[0] - x0, pivot[1] - y0
    w, h = max(1, round(im.width * scale)), max(1, round(im.height * scale))
    sm = hard_alpha(im.resize((w, h), Image.LANCZOS))
    items.append((name, sm, (round(px * scale), round(py * scale))))
B = json.load(open(P('metadata', 'bosses.json')))
for k, H in (('elder_idle', 51), ('elder_panic', 51), ('elder_staff_poke', 51), ('elder_crouch', 39)):
    m = B[k]; ob = m['opaqueBounds']; s = H * G / (ob[3] - ob[1])
    add(k, P('assets', 'elder', k + '.png'), s, m['sourceFootPivot'])
GR = json.load(open(P('metadata', 'grab_sprite.json')))
add('mika_elder_grab', P('assets', 'actors', 'mika_elder_grab.png'), 48 / (GR['bounds'][3] - GR['bounds'][1]), GR['mikaFootPivot'])
AC = json.load(open(P('metadata', 'actors.json')))
for k in ('mika_slam_prepare', 'mika_slam_rise', 'mika_slam_apex', 'mika_slam_down'):
    m = AC[k]; s = m['displayHeight'] * G / m['scaleHeightSource']
    b = m['bounds']; add(k, P('assets', 'actors', 'mika_ground_slam_sheet.png'), s, m['pivot'], box=(b[0] - 4, b[1] - 4, b[2] + 4, b[3] + 8))
for k in ('chest_closed', 'chest_open'):
    im = Image.open(P('assets', '5J', k + '.png')).convert('RGBA'); x0, y0, x1, y1 = opaque(im)
    s = 64 / (y1 - y0) if k == 'chest_closed' else None
    if k == 'chest_closed': CH = s
    add('j5_' + k, P('assets', '5J', k + '.png'), CH, ((x0 + x1) // 2, y1))
U = json.load(open(P('optional_5I_ultra', 'sprite.json')))
ob = U['opaqueBounds']; add('ultra_machine_s', P('optional_5I_ultra', 'assets', 'ultra_machine_s.png'), U['displayOpaqueHeight'] * G / (ob[3] - ob[1]), U['sourceFootPivot'])

PW = 1024; x = y = rowh = 0; pos = {}
for name, im, _ in items:
    if x + im.width > PW: x, y, rowh = 0, y + rowh + 1, 0
    pos[name] = (x, y); x += im.width + 1; rowh = max(rowh, im.height)
page = Image.new('RGBA', (PW, y + rowh))
for name, im, _ in items: page.alpha_composite(im, pos[name])
buf = io.BytesIO(); page.save(buf, 'WEBP', lossless=True, quality=100, method=6, exact=True)
uri = 'data:image/webp;base64,' + base64.b64encode(buf.getvalue()).decode('ascii')
frames = {n: [pos[n][0], pos[n][1], im.width, im.height, 0, 0, im.width, im.height] for n, im, _ in items}
LEFT = {'elder_idle', 'elder_panic', 'elder_staff_poke', 'elder_crouch'}   # 長老の絵は左向き
anims = {n: {'frames': [n], 'dur': [1000], 'origin': list(o), 'loop': True, **({'left': True} if n in LEFT else {})} for n, im, o in items}
anims['mika_slam'] = {'frames': ['mika_slam_prepare', 'mika_slam_rise', 'mika_slam_apex', 'mika_slam_down'], 'dur': [140, 160, 240, 260],
                      'origins': [anims[k]['origin'] for k in ('mika_slam_prepare', 'mika_slam_rise', 'mika_slam_apex', 'mika_slam_down')],
                      'origin': anims['mika_slam_prepare']['origin'], 'loop': False}
out = os.path.join(GAME, 'data', 'assets_v050.js')
with open(out, 'w', encoding='utf-8') as f:
    f.write('// 自動生成: tools/prep_v050.py（5I・5J・6面: 長老・しがみつき・床パンチ・宝箱・ウルトラマシーンS）\n(function () {\nconst M = window.MIKA;\n')
    f.write('const P = M.ATLAS_PAGES.length;\n')
    f.write(f'M.ATLAS_PAGES[P] = "{uri}";\n')
    f.write('const F = ' + json.dumps(frames, separators=(',', ':')) + ';\n')
    f.write('for (const k in F) M.ATLAS.frames[k] = [P].concat(F[k]);\n')
    f.write('Object.assign(M.ANIMS, ' + json.dumps(anims, separators=(',', ':')) + ');\n')
    f.write('M.BG["5I_main"] = { file: "assets/bg_5I_main.webp", size: [1920, 216] };\nM.BG["6B_main"] = { file: "assets/bg_6B_main.webp", size: [1920, 216] };\nM.BG["5J_main"] = { file: "assets/bg_5J_main.webp", size: [384, 216] };\n')
    f.write('})();\n')
for n, im, o in items: print(n, im.size, o)
print('wrote', out, page.size, len(uri) // 1024, 'KB')
