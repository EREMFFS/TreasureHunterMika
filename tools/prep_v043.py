#!/usr/bin/env python3
"""2026-10-11 ツギラの追加モーション（MIKA_ENEMY_MOTIONS_v043）を追加アトラス1枚にまとめる。

使い方: python3 tools/prep_v043.py <MIKA_ENEMY_MOTIONS_v043 フォルダ> <ゲームフォルダ>
出力:   data/assets_v043.js（追加アトラス1枚＋コマ＋アニメ。既存のビームのコマ tsugira_laser は上書きしない）
- 全コマ 128×96・足元 [64,94]・左向き。拡大縮小はしない（素材の倍率のまま）。透明部分は切り詰めて、元のキャンバス位置を残す
- アニメ定義は spec/animation_definitions.json をそのまま使う（ANIMS には Object.assign で足す）
"""
import base64, io, json, os, sys
import numpy as np
from PIL import Image

PACK, GAME = sys.argv[1], sys.argv[2]
A = os.path.join(PACK, 'assets')
anims = json.load(open(os.path.join(PACK, 'spec', 'animation_definitions.json'), encoding='utf-8'))
if 'animations' in anims: anims = anims['animations']
names = sorted({f for a in anims.values() for f in a['frames']})

def trim(im):
    a = np.array(im)[:, :, 3]
    ys, xs = np.nonzero(a)
    x0, y0, x1, y1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
    return im.crop((x0, y0, x1, y1)), int(x0), int(y0)

items = []
for n in names:
    im = Image.open(os.path.join(A, n + '.png')).convert('RGBA')
    assert im.size == (128, 96), (n, im.size)
    t, ox, oy = trim(im)
    items.append((n, t, ox, oy, 128, 96))

PW = 1024
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
out = os.path.join(GAME, 'data', 'assets_v043.js')
with open(out, 'w', encoding='utf-8') as f:
    f.write('// 自動生成: tools/prep_v043.py（ツギラの追加モーション v043: 走り・平手打ち・口レーザー本体・被弾〜復帰・破壊）\n(function () {\nconst M = window.MIKA;\n')
    f.write('const P = M.ATLAS_PAGES.length;\n')
    f.write(f'M.ATLAS_PAGES[P] = "{uri}";\n')
    f.write('const F = ' + json.dumps(frames, separators=(',', ':')) + ';\n')
    f.write('for (const k in F) M.ATLAS.frames[k] = [P].concat(F[k]);\n')
    f.write('Object.assign(M.ANIMS, ' + json.dumps(anims, separators=(',', ':'), ensure_ascii=False) + ');\n')
    f.write('})();\n')
print('wrote', out, page.size, len(uri) // 1024, 'KB', len(frames), 'frames', list(anims))
