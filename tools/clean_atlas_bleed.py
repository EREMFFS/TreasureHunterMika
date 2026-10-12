# 2026-10-11 アトラスのフレーム端に残った「隣のスプライトの切れ端」（ゴミ）を消す。
# フレーム矩形の中で、本体とつながっていない小さな塊のうち、矩形の端に触れているものを透明にする。
# 爆発の破片・刀の先など意図的に離れている絵は対象外にするため、対象フレームを名前で絞る。
# アトラス本体（6MB超）は書き換えず、消すピクセルの一覧 data/atlas_fix.js を出力し、読み込み時に core.js が消す
# （パッチを小さくするため）。アトラスを作り直したら、このスクリプトをもう一度走らせる。
#   python3 tools/clean_atlas_bleed.py <game_dir> [--dry]
import sys, re, io, json, base64
import numpy as np
from PIL import Image
from scipy import ndimage

G = sys.argv[1]; DRY = '--dry' in sys.argv
TARGET = re.compile(r'^(mega_goblin_(hit|idle|punch|rocket|smg|getup|walk|knockback)_\d+|goblin_helmet_base_\d+|tsugira_0[0-24-9])$')

s = open(f'{G}/data/assets.js', encoding='utf-8').read()
A = json.loads(re.search(r'MIKA\.ATLAS = (\{.*?\});\n', s, re.S).group(1))['frames']
pj = open(f'{G}/data/atlas_pages.js', encoding='utf-8').read()
uris = re.findall(r'data:image/webp;base64,([A-Za-z0-9+/=]+)', pj)
pages = [np.array(Image.open(io.BytesIO(base64.b64decode(u))).convert('RGBA')) for u in uris]
touched = set(); total = 0
for k, (pg, x, y, w, h, *_) in sorted(A.items()):
    if not TARGET.match(k): continue
    a = pages[pg][y:y + h, x:x + w, 3] > 0
    lab, n = ndimage.label(a, structure=np.ones((3, 3), int))
    if n < 2: continue
    sizes = ndimage.sum(a, lab, range(1, n + 1)); big = sizes.max()
    for i, (sz, o) in enumerate(zip(sizes, ndimage.find_objects(lab))):
        if sz >= big or sz >= 0.04 * a.sum(): continue
        if not (o[0].start == 0 or o[1].start == 0 or o[0].stop == h or o[1].stop == w): continue
        m = lab == i + 1
        pages[pg][y:y + h, x:x + w][m] = 0
        touched.add(pg); total += int(sz)
        print(k, int(sz), 'px', (o[1].start, o[0].start))
print('removed', total, 'px on pages', sorted(touched))
if DRY: sys.exit()
# 行ごとのラン [x, y, 長さ] にまとめる
orig = [np.array(Image.open(io.BytesIO(base64.b64decode(u))).convert('RGBA'))[:, :, 3] for u in uris]
out = {}
for pg in sorted(touched):
    d = (orig[pg] > 0) & (pages[pg][:, :, 3] == 0)
    runs = []
    for yy in np.unique(np.nonzero(d)[0]):
        xs = np.nonzero(d[yy])[0]; st = pv = xs[0]
        for xx in list(xs[1:]) + [None]:
            if xx is not None and xx == pv + 1: pv = xx; continue
            runs.append([int(st), int(yy), int(pv - st + 1)])
            if xx is not None: st = pv = xx
    out[pg] = runs
with open(f'{G}/data/atlas_fix.js', 'w', encoding='utf-8') as f:
    f.write('// 自動生成: tools/clean_atlas_bleed.py  アトラスのフレーム端に残った隣スプライトの切れ端を読み込み時に消す [x, y, 長さ]\n')
    f.write('MIKA.ATLAS_ERASE = ' + json.dumps({str(k): v for k, v in out.items()}, separators=(',', ':')) + ';\n')
print('wrote data/atlas_fix.js', sum(len(v) for v in out.values()), 'runs')
