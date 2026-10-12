#!/usr/bin/env python3
"""5面 外壁エレベーター v004 の素材をゲーム用に変換（2026-10-11）。
使い方: python3 tools/prep_elevator.py <MIKA_AFTER_5A_HANDOFF_v034 フォルダ> <ゲームフォルダ>
出力: assets/elev_*.webp（描く大きさに縮小）、audio/elev_*.wav、data/assets_elev.js（背景の登録と元の大きさ）
"""
import json, os, shutil, sys
from PIL import Image
PACK, G = sys.argv[1], sys.argv[2]
E = os.path.join(PACK, 'elevator_v004')
# 描く大きさ（elevator_renderer.js v004 の drawRect と同じ）。city は左167pxを切って384幅になる倍率で全体を縮小
SIZES = {'city': None, 'city_mid': (768, 256), 'city_near': (768, 432), 'wall_side_closed': (130, 216), 'cabin_closed': (176, 211)}
reg, src = {}, {}
for k, size in SIZES.items():
    im = Image.open(os.path.join(E, 'assets', k + '.png'))
    src[k] = im.size
    if size is None:
        s = 384 / (im.width - 167); size = (round(im.width * s), round(im.height * s))
    im = im.convert('RGBA' if im.mode == 'RGBA' else 'RGB').resize(size, Image.LANCZOS)
    fn = 'elev_' + k + '.webp'
    im.save(os.path.join(G, 'assets', fn), 'WEBP', quality=90, method=6)
    reg['elev_' + k] = {'file': 'assets/' + fn, 'size': list(size)}
for f, out in [('VOICE_TENBOUDAI.wav', 'elev_tenboudai.wav'), ('VOICE_TOPSPEED.wav', 'elev_topspeed.wav'), ('SE_ELEVATOR_SHUIIN_PROVISIONAL.wav', 'elev_shuiin.wav')]:
    shutil.copy(os.path.join(E, 'audio', f), os.path.join(G, 'audio', out))
spec = json.load(open(os.path.join(E, 'elevator_spec.json'), encoding='utf-8'))
with open(os.path.join(G, 'data', 'assets_elev.js'), 'w', encoding='utf-8') as f:
    f.write('// 自動生成: tools/prep_elevator.py（5面 外壁エレベーター v004）\n(function () {\nconst M = window.MIKA;\n')
    f.write('Object.assign(M.BG, ' + json.dumps(reg) + ');\n')
    f.write('M.ELEV_SRC = ' + json.dumps(src) + ';   // 元画像の大きさ（扉の多角形など元画像の座標を描く大きさへ直す）\n')
    f.write('M.ELEV_SPEC = ' + json.dumps({k: spec[k] for k in ('routes', 'connection', 'parallax', 'express')}, ensure_ascii=False) + ';\n')
    f.write('})();\n')
print(reg)
