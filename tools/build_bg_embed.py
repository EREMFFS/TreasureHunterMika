#!/usr/bin/env python3
"""2026-10-12 v111: 背景画像（M.BG の file が assets/... のもの）を data URI にして data/bg_embed.js にまとめる。
index.html を直接開いた時（file://）だけ読み込む（js/core.js loadAssets）。
file:// でファイルから読んだ画像を描くとキャンバスが「汚染」され、ブラウン管表示（WebGL）が使えなくなるため。
画像を足したら: python3 tools/build_bg_embed.py .
"""
import base64, json, os, re, sys
G = sys.argv[1] if len(sys.argv) > 1 else '.'
# 2026-10-12 v118: assets/ の画像を全部入れる（4Aの飛来物のようにコードで名前を組み立てる画像を取りこぼさないため）
files = {'assets/' + f for f in os.listdir(os.path.join(G, 'assets')) if f.lower().rsplit('.', 1)[-1] in ('webp', 'png', 'jpg', 'jpeg')}
MIME = {'webp': 'image/webp', 'png': 'image/png', 'jpg': 'image/jpeg', 'jpeg': 'image/jpeg'}
out, total, miss = {}, 0, []
for f in sorted(files):
    p = os.path.join(G, f)
    if not os.path.exists(p): miss.append(f); continue
    b = open(p, 'rb').read(); total += len(b)
    out[f] = 'data:' + MIME[f.rsplit('.', 1)[1].lower()] + ';base64,' + base64.b64encode(b).decode('ascii')
with open(os.path.join(G, 'data', 'bg_embed.js'), 'w', encoding='utf-8') as fp:
    fp.write('// 自動生成: tools/build_bg_embed.py（file:// で開いた時だけ読む背景画像の埋め込み）\nwindow.MIKA = window.MIKA || {};\nMIKA.BG_EMBED = {\n')
    for k, v in out.items(): fp.write(json.dumps(k) + ': "' + v + '",\n')
    fp.write('};\n')
print(len(out), 'images', round(total / 1e6, 1), 'MB', 'missing:', miss)
