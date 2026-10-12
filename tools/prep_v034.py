#!/usr/bin/env python3
"""v034 追加素材（二段ジャンプ・SMASH!画像・タイトルのサブタイトル）を追加アトラス1枚にまとめる。

使い方: python3 tools/prep_v034.py <MIKA_AFTER_5A_HANDOFF_v034 を展開したフォルダ> <ゲームフォルダ>
出力:   data/assets_v034.js（追加アトラス1枚＋コマ＋アニメの登録。build_assets.py の作り直しは不要）

- 二段ジャンプ: double_jump_v034/frames の 512px 6コマを 0.12 倍（既存ジャンプの頭の大きさに合わせた）で 96×96 に。
  回転の中心（512の中心）を、既存ジャンプの体の中心＝足原点[48,77]の33px上 (48,44) に置く。全コマ共通倍率。
- SMASH!: combat_title_v033 の smash_a/b/c を、外接枠で切り抜いて幅128pxに（最大1.15倍表示の元）。
- サブタイトル: subtitle_logo.png を幅 SUB_W に（既存タイトルの上に重ねるだけ）。
"""
import base64, io, json, os, sys
import numpy as np
from PIL import Image

PACK, GAME = sys.argv[1], sys.argv[2]
DJ_SCALE, DJ_CENTER = 0.12, (48, 44)
SMASH_W, SUB_W = 128, 104


def hard_alpha(im, th=110):
    a = np.array(im.convert('RGBA'))
    al = a[:, :, 3]
    a[:, :, 3] = np.where(al >= th, 255, 0)
    a[al < th, :3] = 0
    return Image.fromarray(a)


def trim(im):
    a = np.array(im)[:, :, 3]
    ys, xs = np.nonzero(a)
    if not len(xs): return im.crop((0, 0, 1, 1)), 0, 0
    x0, y0, x1, y1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
    return im.crop((x0, y0, x1, y1)), int(x0), int(y0)


items = []   # (name, image, ox, oy, cw, ch)
# 二段ジャンプ
for i in range(6):
    src = Image.open(os.path.join(PACK, 'double_jump_v034', 'frames', f'double_jump_{i:02d}.png')).convert('RGBA')
    w = round(src.width * DJ_SCALE)
    sm = hard_alpha(src.resize((w, w), Image.LANCZOS))
    canvas = Image.new('RGBA', (96, 96))
    canvas.alpha_composite(sm, (DJ_CENTER[0] - w // 2, DJ_CENTER[1] - w // 2))
    t, ox, oy = trim(canvas)
    items.append((f'mika_double_jump_{i:02d}', t, ox, oy, 96, 96))
# SMASH!
meta = json.load(open(os.path.join(PACK, 'combat_title_v033', 'smash_meta.json')))
for v in meta['variants']:
    im = Image.open(os.path.join(PACK, 'combat_title_v033', 'assets', v['imageKey'] + '.png')).convert('RGBA').crop(v['bounds'])
    h = round(SMASH_W * im.height / im.width)
    im = im.resize((SMASH_W, h), Image.LANCZOS)
    items.append((v['imageKey'], im, 0, 0, SMASH_W, h))
# サブタイトル
im = Image.open(os.path.join(PACK, 'combat_title_v033', 'assets', 'subtitle_logo.png')).convert('RGBA').crop(meta['subtitle']['bounds'])
h = round(SUB_W * im.height / im.width)
im = im.resize((SUB_W, h), Image.LANCZOS)
items.append(('title_subtitle', im, 0, 0, SUB_W, h))

# 棚詰め
PW = 512
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
seq = [5, 0, 1, 2, 3, 4, 5]
anims = {'double_jump': {'frames': [f'mika_double_jump_{i:02d}' for i in seq], 'dur': [120, 80, 80, 95, 85, 90, 180], 'origin': [48, 77], 'loop': False}}
out = os.path.join(GAME, 'data', 'assets_v034.js')
with open(out, 'w', encoding='utf-8') as f:
    f.write('// 自動生成: tools/prep_v034.py（v034: 二段ジャンプ・SMASH!画像・サブタイトルの追加アトラス1枚）\n(function () {\nconst M = window.MIKA;\n')
    f.write('const P = M.ATLAS_PAGES.length;\n')
    f.write(f'M.ATLAS_PAGES[P] = "{uri}";\n')
    f.write('const F = ' + json.dumps(frames, separators=(',', ':')) + ';\n')
    f.write('for (const k in F) M.ATLAS.frames[k] = [P].concat(F[k]);\n')
    f.write('Object.assign(M.ANIMS, ' + json.dumps(anims, separators=(',', ':')) + ');\n')
    f.write('})();\n')
print('wrote', out, page.size, len(uri) // 1024, 'KB')
