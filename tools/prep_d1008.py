#!/usr/bin/env python3
"""2026-10-08 素材（MIKA_MORNING_ASSETS / MIKA_DANDALMON_HANDOFF）を、build_assets.py が読める
「1コマ1枚のPNG」と背景PNGへ並べ直す。絵は描き直さない（切り出し・透明余白の位置合わせだけ）。

使い方: python3 tools/prep_d1008.py <内側ZIPをすべて展開したフォルダ> <出力フォルダ>
  出力: <出力>/frames/*.png（アトラスへ）, <出力>/bg/*.png（背景）
"""
import os, sys, glob
from PIL import Image

SRC, OUT = sys.argv[1], sys.argv[2]
FR = os.path.join(OUT, 'frames'); BG = os.path.join(OUT, 'bg')
os.makedirs(FR, exist_ok=True); os.makedirs(BG, exist_ok=True)

def one(pat):
    m = sorted(glob.glob(os.path.join(SRC, pat)))
    if not m: raise SystemExit('missing ' + pat)
    return m[0]
def rgba(p): return Image.open(p).convert('RGBA')
def save(im, name): im.save(os.path.join(FR, name + '.png'))
def split(path, fw, fh, prefix):
    im = rgba(path); n = im.width // fw
    for i in range(n):
        save(im.crop((i * fw, 0, i * fw + fw, fh)), f'{prefix}_{i:02d}')
    return n

# ---- ヒットエフェクト v002（3コマ）
H = 'MIKA_HIT_EFFECTS_v002/*/runtime/'
split(one(H + 'hit_small_sheet.png'), 40, 40, 'hitfx_small')
split(one(H + 'hit_heavy_sheet.png'), 72, 72, 'hitfx_heavy')
split(one(H + 'hit_bullet_sheet.png'), 32, 32, 'hitfx_bullet')
split(one(H + 'hit_slash_sheet.png'), 144, 88, 'hitfx_slash')

# ---- 武器の軌跡（実コマ同期 160×128・原点64,99）と接触火花・矢の光跡
C = 'MIKA_WEAPON_CONTACT_FX_v002/*/runtime/'
for k in ('katana_horizontal', 'war_axe', 'gungnir', 'yoichi_bow', 'battle_hammer'):
    split(one(C + k + '_frame_fx.png'), 160, 128, 'wfx_' + k)
save(rgba(one(C + 'contact_spark.png')), 'wfx_contact_spark')
save(rgba(one(C + 'bow_arrow_tail.png')), 'wfx_bow_tail')

# ---- 落ち武器の▽
save(rgba(one('MIKA_DROP_WEAPON_MARKER_v002/*/runtime/drop_weapon_arrow.png')), 'drop_weapon_arrow')

# ---- 4C 壊せる小物: 壊れる前後で足元が揃うよう、共通キャンバスへ置き直す（原点は props.json の pivot）
import json
PJ = json.load(open(one('MIKA_STAGE4C_DESPOLIS_STATION_v002/*/props/props.json')))
PD = os.path.dirname(one('MIKA_STAGE4C_DESPOLIS_STATION_v002/*/props/props.json'))
origins = {}
for kind, d in PJ['props'].items():
    a = rgba(os.path.join(PD, d['intact'])); b = rgba(os.path.join(PD, d['broken']))
    pa, pb = d['foot_pivot_intact'], d['foot_pivot_broken']
    ox, oy = max(pa[0], pb[0]), max(pa[1], pb[1])
    W = max(ox + (a.width - pa[0]), ox + (b.width - pb[0])); Hh = max(oy + (a.height - pa[1]), oy + (b.height - pb[1]))
    for st, im, p in (('intact', a, pa), ('damaged', b, pb), ('rubble', b, pb)):
        c = Image.new('RGBA', (W, Hh)); c.paste(im, (ox - p[0], oy - p[1]), im); save(c, f'st4_{kind}_{st}')
    origins[kind] = [ox, oy]
json.dump(origins, open(os.path.join(OUT, 'prop_origins.json'), 'w'))

# ---- ダンダルモン
D3 = 'MIKA_STAGE04C_DANDALMON_v003/*/runtime/'
save(rgba(one(D3 + 'dandalmon_idle_112x168.png')), 'dand_idle')
save(rgba(one(D3 + 'dandalmon_eyes_wide_112x168.png')), 'dand_eyes')
save(rgba(one(D3 + 'dandalmon_mouth_open_112x168.png')), 'dand_mouth')
lau = rgba(one('MIKA_DANDALMON_DEFEAT_v001/*/runtime/dandalmon_laugh_cracked_112x168.png'))
save(lau, 'dand_laugh')
save(rgba(one('MIKA_DANDALMON_SHUTTER_INTRO_v010/*/runtime/shutter_front_with_lifting_left_rail_200x264.png')), 'dand_shutter')
for p in sorted(glob.glob(os.path.join(SRC, 'MIKA_DANDALMON_SHUTTER_INTRO_v010/*/ui/*.png'))):
    save(rgba(p), 'dand_' + os.path.basename(p)[:-4])          # dand_epithet_00.. / dand_name_00..
for i in range(3):
    save(rgba(one(f'MIKA_DANDALMON_TURRETS_v002/*/sprites/turret_flash_0{i}.png')), f'dand_tflash_{i:02d}')
save(rgba(one('MIKA_DANDALMON_TURRETS_v002/*/sprites/turret_round_10x6.png')), 'dand_round')
for i in range(6):
    save(rgba(one(f'MIKA_DANDALMON_EYE_IMPACT_v001/*/sprites/eye_impact_0{i}.png')), f'dand_eyehit_{i:02d}')
# 撃破: 割れた笑い顔から破片（目・口・装甲）を切り出し、最後の瓦礫の山を作る（素材からの切り抜きのみ）
frags = [(30, 40, 58, 64), (58, 36, 88, 62), (34, 74, 82, 104), (60, 96, 96, 124), (18, 104, 46, 132), (70, 10, 100, 40), (8, 60, 34, 92), (40, 120, 76, 150)]
for i, box in enumerate(frags):
    save(lau.crop(box), f'dand_frag_{i:02d}')
rub = Image.new('RGBA', (128, 40))
base = lau.crop((0, 128, 112, 168)).resize((120, 22), Image.NEAREST)
rub.paste(base, (4, 18), base)
for i, (box, (x, y)) in enumerate(zip(frags[:6], [(6, 8), (34, 4), (62, 10), (88, 6), (20, 14), (74, 14)])):
    f = lau.crop(box).rotate([25, -40, 70, -15, 110, 35][i], expand=True, resample=Image.NEAREST)
    f.thumbnail((30, 24), Image.NEAREST)
    rub.paste(f, (x, y), f)
save(rub, 'dand_rubble')

# ---- 背景
Image.open(one('MIKA_STAGE4C_DESPOLIS_STATION_v002/*/layers/stage4c_main.png')).convert('RGB').save(os.path.join(BG, '4C_main.png'))
for r in ('4C_H1', '4C_H2'):
    Image.open(one(f'MIKA_STAGE4C_HIDDEN_ROOMS_v001/*/rooms/{r}.png')).convert('RGB').save(os.path.join(BG, r + '.png'))
print('frames', len(os.listdir(FR)), 'bg', len(os.listdir(BG)), 'prop origins', origins)
