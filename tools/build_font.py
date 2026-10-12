#!/usr/bin/env python3
"""地名表示用の日本語ドット文字を作る。

使い方: python3 tools/build_font.py <@fontsource/dotgothic16 を展開した package フォルダ> .

DotGothic16（SIL Open Font License 1.1）から、map_names.json などで使う文字だけを
16pxで1ビット化（にじみなし）して data/jpfont.js に埋め込む。
文字を増やしたいときは EXTRA に足して再実行する。
"""
import base64, glob, io, json, os, sys
from fontTools.ttLib import TTFont
from PIL import Image, ImageDraw, ImageFont

PKG, OUT = sys.argv[1], sys.argv[2]
SIZE = 16
EXTRA = 'トレジャーハンターミカゴブリン族の秘宝ゴブリンメカダークミカゴブリンクイーン乗降機械改造人間大魔女王巨大人面要塞ダンダルモンデスポリス駅0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ・ー！？　'
EXTRA += '↑↓←→で移動ボタン攻撃ジャンプ押しっぱなし発射'   # 2026-10-11 簡易チュートリアル（js/tutorial.js）
EXTRA += 'ジャンプ中にボタンで二段'   # 2026-10-12 v104 二段ジャンプの説明（ドクターSの追尾弾）

names = json.load(open(os.path.join(OUT, 'data', 'map_names.json'), encoding='utf-8'))
chars = set(EXTRA)
for st in names['stages']:
    chars |= set(st['world_name']) | set(st.get('number_reading', ''))
    for v in st['maps'].values():
        chars |= set(v)
# 2026-10-11 5I・5J・6面・エンディングのセリフ（data/story6.js）の字も入れる
sp = os.path.join(OUT, 'data', 'story6.js')
if os.path.exists(sp):
    txt = open(sp, encoding='utf-8').read()
    txt = '\n'.join(l.split('//')[0] for l in txt.splitlines())   # 注釈の行は除く
    chars |= {c for c in txt if ord(c) > 0x7f}
chars = sorted(chars)

fonts = sorted(glob.glob(os.path.join(PKG, 'files', '*-400-normal.woff')))
cmaps = [(f, TTFont(f).getBestCmap()) for f in fonts]
glyphs, strip, x = {}, [], 0
for ch in chars:
    if ch == '　':
        glyphs[ch] = [x, 0, SIZE // 2]
        continue
    src = next((f for f, cm in cmaps if ord(ch) in cm), None)
    if not src:
        print('missing glyph', ch)
        continue
    fnt = ImageFont.truetype(src, SIZE)
    im = Image.new('L', (SIZE * 2, SIZE + 4), 0)
    ImageDraw.Draw(im).text((0, 0), ch, font=fnt, fill=255)
    im = im.point(lambda v: 255 if v >= 128 else 0)       # 1ビット化
    adv = round(fnt.getlength(ch))
    cell = im.crop((0, 0, max(adv, 1), SIZE + 4))
    strip.append((cell, x))
    glyphs[ch] = [x, cell.width, adv]
    x += cell.width + 1
sheet = Image.new('LA', (max(1, x), SIZE + 4), (255, 0))
for cell, cx in strip:
    sheet.paste(Image.merge('LA', (Image.new('L', cell.size, 255), cell)), (cx, 0))
buf = io.BytesIO()
sheet.save(buf, 'PNG', optimize=True)
with open(os.path.join(OUT, 'data', 'jpfont.js'), 'w', encoding='utf-8') as f:
    f.write('// 自動生成: tools/build_font.py  DotGothic16 (SIL OFL 1.1) から使用文字だけを16pxで1ビット化\n')
    f.write('window.MIKA = window.MIKA || {};\nMIKA.JPFONT = ')
    json.dump({'size': SIZE, 'height': SIZE + 4, 'image': 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode(),
               'glyphs': glyphs}, f, ensure_ascii=False, separators=(',', ':'))
    f.write(';\n')
print('glyphs', len(glyphs), 'sheet', sheet.size, 'bytes', len(buf.getvalue()))
