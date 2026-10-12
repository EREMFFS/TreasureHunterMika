#!/usr/bin/env python3
"""英数字のドット文字（Press Start 2P, SIL OFL 1.1）を 8×8 の1ビットに変換して data/pxfont.js に埋め込む。
使い方: python3 tools/build_pxfont.py <press-start-2p の .ttf または .woff> .
  ゲーム内の M.text はこの表を使う（無ければ従来の5×7文字）。ライセンス: docs/licenses/PressStart2P_OFL.txt
"""
import io, json, os, sys
from fontTools.ttLib import TTFont
from PIL import Image, ImageDraw, ImageFont
SRC, OUT = sys.argv[1], sys.argv[2]
f = TTFont(SRC); f.flavor = None; buf = io.BytesIO(); f.save(buf); buf.seek(0)
fn = ImageFont.truetype(buf, 8)
glyphs = {}
for code in range(33, 127):
    ch = chr(code)
    im = Image.new('1', (8, 8), 0); d = ImageDraw.Draw(im); d.fontmode = '1'; d.text((0, 0), ch, font=fn, fill=1)
    bits = ''.join('1' if im.getpixel((x, y)) else '0' for y in range(8) for x in range(8))
    glyphs[ch] = format(int(bits, 2), '016x')   # 64ビットを16桁の16進で
with open(os.path.join(OUT, 'data', 'pxfont.js'), 'w', encoding='utf-8') as o:
    o.write('// 自動生成: tools/build_pxfont.py  Press Start 2P (SIL OFL 1.1, Copyright 2012 The Press Start 2P Project Authors) を8×8の1ビットに変換\n')
    o.write('window.MIKA = window.MIKA || {};\nMIKA.PXFONT = ' + json.dumps({'w': 8, 'h': 8, 'adv': 8, 'glyphs': glyphs}, separators=(',', ':')) + ';\n')
print('glyphs', len(glyphs))
