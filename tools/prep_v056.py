#!/usr/bin/env python3
"""v056 ドクターS撃破後〜6Bの演出（MIKA_POST_DOCTOR_EVENT_v056）の素材を追加アトラス1枚にまとめる。

使い方: python3 tools/prep_v056.py <MIKA_POST_DOCTOR_EVENT_v056 フォルダ> <ゲームフォルダ> [<v058 の素材フォルダ>]
  v058 の素材フォルダ: MIKA_EVENT_PREVIEW_v058.html に埋め込まれた画像を取り出したもの（doctor_*・mika_shocked/recover・ufo_wreck）
  第4引数: MIKA_ENDING_BRUSHUP_v059/assets（ev_elder_relief_up / ev_elder_relief_nod）
  2026-10-12 v058: 宝箱の前面は原画の y420 から（長老の腕が縁の後ろに隠れる）。ドクターSの演出コマを追加
出力:   data/assets_v056.js

- 演技コマ（128×112・支点80,96）: 余白を切り詰めて、元のキャンバス位置（ox, oy）を記録。anim 名は ev_<名前>
  長老の演技コマは左向き（left: true）、ミカ・ミカ＋長老のコマは右向き
- 吹き出しの絵（64×64 → 見本どおり56×56で描くので、最近傍で56に）: ev_bubble_treasure / self / prayer
- 「脱出！」の文字画像 108×43: ev_title_escape
- 宝箱（1536×1024 の原画を見本と同じ 0.088 倍・最近傍）: ev_chest_closed / ev_chest_open / ev_chest_front（開いた箱の前面＝原画の y500〜949）
  足元原点は見本の描き方（x-768*0.088, y-914*0.088 / 949*0.088）に合わせる
"""
import base64, io, json, os, sys
from PIL import Image

PACK, GAME = sys.argv[1], sys.argv[2]
A = os.path.join(PACK, 'assets')
A58 = sys.argv[3] if len(sys.argv) > 3 else None
A59 = sys.argv[4] if len(sys.argv) > 4 else None   # 2026-10-12 MIKA_ENDING_BRUSHUP_v059/assets（エンディングの長老の安堵・頷き2コマ）
SC = 0.088

ELDER = ['elder_peek', 'elder_climb', 'elder_self', 'elder_look_left', 'elder_look_right', 'elder_startled', 'elder_challenge', 'elder_seated', 'elder_pray']
DOCTOR = ['doctor_eject', 'doctor_bow_up', 'doctor_bow_down', 'doctor_face_up', 'doctor_brow_up'] if A58 else []
MIKA58 = ['mika_shocked', 'mika_recover'] if A58 else []
RELIEF = ['elder_relief_up', 'elder_relief_nod'] if A59 else []
MIKA = ['mika_cold', 'mika_knuckle_a', 'mika_knuckle_b', 'mika_think', 'mika_refuse', 'mika_beckon', 'mika_elder_cling', 'mika_elder_accept']


def trim(im):
    bb = im.getbbox() or (0, 0, 1, 1)
    return im.crop(bb), bb[0], bb[1]


items = []   # (frame, image, ox, oy, cw, ch)
anims = {}
for n in ELDER + MIKA + DOCTOR + MIKA58 + RELIEF:
    im = Image.open(os.path.join(A59 if n in RELIEF else A58 if n in DOCTOR + MIKA58 else A, n + '.png')).convert('RGBA')
    t, ox, oy = trim(im)
    items.append(('ev_' + n, t, ox, oy, im.width, im.height))
    anims['ev_' + n] = {'frames': ['ev_' + n], 'dur': [1000], 'origin': [80, 96], 'loop': True}
    if n in ELDER or n in DOCTOR or n in RELIEF: anims['ev_' + n]['left'] = True   # 長老とドクターSの絵は左向き
for n in ['treasure', 'self', 'prayer']:
    im = Image.open(os.path.join(A, f'bubble_{n}.png')).convert('RGBA').resize((56, 56), Image.NEAREST)
    t, ox, oy = trim(im)
    items.append((f'ev_bubble_{n}', t, ox, oy, 56, 56))
im = Image.open(os.path.join(A, 'title_escape.png')).convert('RGBA')
items.append(('ev_title_escape', im, 0, 0, im.width, im.height))


def chest(src, name, top=0, bottom=None):
    im = Image.open(os.path.join(A, src)).convert('RGBA')
    if bottom is None: bottom = im.height
    im = im.crop((0, top, im.width, bottom))
    w, h = round(im.width * SC), round(im.height * SC)
    im = im.resize((w, h), Image.NEAREST)
    t, ox, oy = trim(im)
    items.append((name, t, ox, oy, w, h))
    return w, h


chest('chest_closed.png', 'ev_chest_closed')
chest('chest_open.png', 'ev_chest_open')
chest('chest_open.png', 'ev_chest_front', 420, 949)
# 足元原点（見本: 閉 x-768*sc, y-914*sc / 開 y-949*sc / 前面 y-(949-500)*sc）
anims['ev_chest_closed'] = {'frames': ['ev_chest_closed'], 'dur': [1000], 'origin': [round(768 * SC), round(914 * SC)], 'loop': True}
anims['ev_chest_open'] = {'frames': ['ev_chest_open'], 'dur': [1000], 'origin': [round(768 * SC), round(949 * SC)], 'loop': True}
anims['ev_chest_front'] = {'frames': ['ev_chest_front'], 'dur': [1000], 'origin': [round(768 * SC), round(529 * SC)], 'loop': True}
# v058: 壊れた円盤（見本は 1536×1024 を 142×83 に描く。足元＝下端中央を原点に）
if A58:
    im = Image.open(os.path.join(A58, 'ufo_wreck.png')).convert('RGBA').resize((142, 83), Image.NEAREST)
    t, ox, oy = trim(im)
    items.append(('ev_ufo_wreck', t, ox, oy, 142, 83))
    anims['ev_ufo_wreck'] = {'frames': ['ev_ufo_wreck'], 'dur': [1000], 'origin': [71, 83], 'loop': True}

# 棚詰め
PW = 1024
items.sort(key=lambda it: -it[1].height)
x = y = rowh = 0
pos = {}
for name, im, *_ in items:
    if x + im.width > PW: x, y, rowh = 0, y + rowh + 1, 0
    pos[name] = (x, y); x += im.width + 1; rowh = max(rowh, im.height)
page = Image.new('RGBA', (PW, y + rowh))
for name, im, *_ in items: page.alpha_composite(im, pos[name])
buf = io.BytesIO(); page.save(buf, 'WEBP', lossless=True, quality=100, method=6, exact=True)
uri = 'data:image/webp;base64,' + base64.b64encode(buf.getvalue()).decode('ascii')
frames = {name: [pos[name][0], pos[name][1], im.width, im.height, ox, oy, cw, ch] for name, im, ox, oy, cw, ch in items}
out = os.path.join(GAME, 'data', 'assets_v056.js')
with open(out, 'w', encoding='utf-8') as f:
    f.write('// 自動生成: tools/prep_v056.py（v056 ドクターS撃破後〜6Bの演出の演技コマ・吹き出し・脱出！・宝箱）\n(function () {\nconst M = window.MIKA;\n')
    f.write('const P = M.ATLAS_PAGES.length;\n')
    f.write(f'M.ATLAS_PAGES[P] = "{uri}";\n')
    f.write('const F = ' + json.dumps(frames, separators=(',', ':')) + ';\n')
    f.write('for (const k in F) M.ATLAS.frames[k] = [P].concat(F[k]);\n')
    f.write('Object.assign(M.ANIMS, ' + json.dumps(anims, separators=(',', ':')) + ');\n')
    f.write('})();\n')
print('wrote', out, page.size, len(uri) // 1024, 'KB')
