#!/usr/bin/env python3
"""MIKA_ANIMATION_v116 の素材から、ゲーム用の圧縮アトラスとアニメ定義を作る。

使い方: python3 tools/build_assets.py <v116を展開したフォルダ> <gameフォルダ>

- 画像は再生成しない。各コマの透明余白だけを切り詰め、元キャンバス内の位置
  (オフセット) を記録するので、原寸・足元原点・コマごとの大きさはそのまま保たれる。
- 出力はロスレスWebP (ピクセルは1つも変わらない)。
- 原点・コマ数・時間は animation.json の値をそのまま写す。
"""
import json, os, re, sys, glob
from PIL import Image

ANIMS_ONLY = '--anims-only' in sys.argv
sys.argv = [a for a in sys.argv if a != '--anims-only']
SRC, OUT = sys.argv[1], sys.argv[2]
ASSET_DIR = os.path.join(OUT, 'assets')
DATA_DIR = os.path.join(OUT, 'data')
os.makedirs(ASSET_DIR, exist_ok=True)

EXCLUDE = re.compile(r'(_source|_preview|_sheet|size_comparison|combat_review_contact|treasure_group|title_|_v1\d\d)')

def webp(im, path):
    im.save(path, 'WEBP', lossless=True, quality=100, method=6, exact=True)

# ---------------------------------------------------------------- frames
frames = {}
for p in sorted(glob.glob(os.path.join(SRC, '*.png'))):
    name = os.path.basename(p)[:-4]
    if EXCLUDE.search(name):
        continue
    frames[name] = Image.open(p).convert('RGBA')
# v117: ヒット火花と敵の顔アイコン
for p in sorted(glob.glob(os.path.join(SRC, 'fx/hit_spark_0*.png'))) + sorted(glob.glob(os.path.join(SRC, 'fx/air_*_0*.png'))) + sorted(glob.glob(os.path.join(SRC, 'hud/enemy_face_*.png'))):
    name = os.path.basename(p)[:-4]
    if 'sheet' in name:
        continue
    frames[name] = Image.open(p).convert('RGBA')
# 2026-10-07: 1面演出UI（GO・STAGE CLEAR）、ボス名の文字、1面背景FX（煙・電気火花）
for p in sorted(glob.glob(os.path.join(SRC, 'ui/*.png'))) + sorted(glob.glob(os.path.join(SRC, 'bgfx/smoke_0*.png'))) + sorted(glob.glob(os.path.join(SRC, 'bgfx/electric_0*.png'))):
    frames[os.path.basename(p)[:-4]] = Image.open(p).convert('RGBA')
# 小物 (1面パック)
for p in sorted(glob.glob(os.path.join(SRC, 'stage1_v005/assets/prop_*.png'))):
    frames[os.path.basename(p)[:-4]] = Image.open(p).convert('RGBA')

# ---------------------------------------------------------------- 2026-10-07 1〜3面パック（MIKA_STAGE123_IMPLEMENTATION の modules/）
MOD = sys.argv[3] if len(sys.argv) > 3 else None
def modp(*a):
    return os.path.join(MOD, *a)
def addf(name, path):
    frames[name] = Image.open(path).convert('RGBA')
MOD_FRAMES = []   # (prefix, glob)
if MOD:
    for p in sorted(glob.glob(modp('MIKA_DARK_MIKA_FULL_v001/sprites/dark_mika_*_[0-9][0-9].png'))):
        addf(os.path.basename(p)[:-4], p)
    for fam in ('mega_goblin', 'megamega'):
        for p in sorted(glob.glob(modp('MIKA_MECHANICAL_ENEMIES_v001', fam, '*.png'))):
            addf(fam + '_' + os.path.basename(p)[:-4], p)
    for p in sorted(glob.glob(modp('MIKA_MECHANICAL_ENEMIES_v001/fx/*.png'))):
        addf(os.path.basename(p)[:-4], p)
    C3 = 'MIKA_STAGE3C_CASTLE_v001'
    for p in sorted(glob.glob(modp(C3, 'boss/*.png'))):
        n = os.path.basename(p)[:-4]
        addf(('queen_' + n) if n.startswith(('hit_', 'slump_')) else n, p)
    for p in sorted(glob.glob(modp(C3, 'fx/*.png'))):
        addf('qfx_' + os.path.basename(p)[:-4], p)
    for p in sorted(glob.glob(modp(C3, 'objects/*.png'))) + sorted(glob.glob(modp(C3, 'ui/queen_[en]*_0*.png'))):
        addf(os.path.basename(p)[:-4], p)
    addf('speech_bubble', modp(C3, 'story/speech_bubble.png'))
    for n in ('apology', 'doctor_shadow', 'stolen_treasure', 'take_train'):
        addf('story_' + n, modp(C3, 'story', n + '.png'))
    A3 = 'MIKA_STAGE3A_FOREST_v001'
    for p in sorted(glob.glob(modp(A3, 'objects/*.png'))):
        addf('forest_' + os.path.basename(p)[:-4], p)
    for p in sorted(glob.glob(modp(A3, 'fairies/*.png'))):
        addf('fairy_' + os.path.basename(p)[:-4], p)
    for p in sorted(glob.glob(modp('MIKA_STAGE3B_CLOUDS_v001/objects/*.png'))):
        addf(os.path.basename(p)[:-4], p)
    for p in sorted(glob.glob(modp('MIKA_STAGE2C_LAB_v001/objects/*_0[0-9].png'))):
        addf('lab_' + os.path.basename(p)[:-4], p)
    for p in sorted(glob.glob(modp('MIKA_STAGE2_BACKGROUND_FX_v001/assets/*.png'))):
        n = os.path.basename(p)[:-4]
        if 'sheet' not in n:
            addf('s2_' + n, p)
    for p in sorted(glob.glob(modp('MIKA_ELEVATOR_STOP_FX_v001/stage2b/layers/paint_*.png'))) + [modp('MIKA_ELEVATOR_STOP_FX_v001/stage2b/layers/door_panel.png')]:
        addf('elev_' + os.path.basename(p)[:-4], p)

# ---------------------------------------------------------------- 2026-10-08 素材（tools/prep_d1008.py で並べ直したもの）
# 5番目の引数: prep_d1008.py の出力フォルダ（frames/ と bg/）
D8S = sys.argv[4].split(',') if len(sys.argv) > 4 else []   # 2026-10-09: カンマ区切りで複数（d1008/out,d1009/out）
D8 = D8S[0] if D8S else None
for d in D8S:
    for p in sorted(glob.glob(os.path.join(d, 'frames', '*.png'))):
        addf(os.path.basename(p)[:-4], p)

def load_prev():
    txt = open(os.path.join(OUT, 'data', 'assets.js'), encoding='utf-8').read()
    def grab(key):
        line = next(l for l in txt.splitlines() if l.startswith('MIKA.' + key + ' = '))
        return json.loads(line[len('MIKA.' + key + ' = '):-1])
    return grab('ATLAS'), grab('BG')
items = []
for name, im in ([] if ANIMS_ONLY else frames.items()):
    bbox = im.getbbox() or (0, 0, 1, 1)
    crop = im.crop(bbox)
    items.append((name, crop, bbox, im.size))

# shelf packing, tallest first
items.sort(key=lambda t: (-t[1].size[1], -t[1].size[0]))
PAGE_W, PAGE_H, PAD = 1024, 1024, 1
pages, meta = [], {}
cur = None
def new_page():
    global cur
    cur = {'img': Image.new('RGBA', (PAGE_W, PAGE_H), (0, 0, 0, 0)), 'x': 0, 'y': 0, 'row': 0}
    pages.append(cur)
new_page()
for name, crop, bbox, size in items:
    w, h = crop.size
    if cur['x'] + w > PAGE_W:
        cur['x'] = 0; cur['y'] += cur['row'] + PAD; cur['row'] = 0
    if cur['y'] + h > PAGE_H:
        new_page()
    cur['img'].paste(crop, (cur['x'], cur['y']))
    meta[name] = [len(pages) - 1, cur['x'], cur['y'], w, h, bbox[0], bbox[1], size[0], size[1]]
    cur['x'] += w + PAD
    cur['row'] = max(cur['row'], h)

# アトラスは base64 の JS として書き出す（file:// でも色違いパレット変換＝getImageData が使えるように）
import base64, io
page_files = []
if ANIMS_ONLY:
    _atlas, _bg = load_prev()
    meta = _atlas['frames']; pages = []; page_files = [None] * _atlas['pages']
for i, pg in enumerate(pages):
    used_h = min(PAGE_H, pg['y'] + pg['row'])
    img = pg['img'].crop((0, 0, PAGE_W, used_h))
    buf = io.BytesIO()
    img.save(buf, 'WEBP', lossless=True, quality=100, method=6, exact=True)
    page_files.append('data:image/webp;base64,' + base64.b64encode(buf.getvalue()).decode('ascii'))
for old in glob.glob(os.path.join(ASSET_DIR, 'atlas*.webp')):
    os.remove(old)
# 2026-10-11 アトラスは1ページ1ファイルに分ける（1ファイル6MB超はダウンロードに失敗しやすいため）。
#   atlas_pages.js は空の入れ物だけ、atlas_page0.js〜 が各ページ。index.html / artifact.html で順に読む
if not ANIMS_ONLY:
    with open(os.path.join(DATA_DIR, 'atlas_pages.js'), 'w') as f:
        f.write('// 自動生成: tools/build_assets.py  アトラス画像の入れ物（中身は atlas_page0.js〜atlas_page%d.js）\nwindow.MIKA = window.MIKA || {};\nMIKA.ATLAS_PAGES = [];\nMIKA.ATLAS_PAGE_COUNT = %d;\n' % (len(page_files) - 1, len(page_files)))
    for i, uri in enumerate(page_files):
        with open(os.path.join(DATA_DIR, f'atlas_page{i}.js'), 'w') as f:
            f.write(f'// 自動生成: tools/build_assets.py  アトラス {i}ページ目（ロスレスWebPのbase64）\nMIKA.ATLAS_PAGES[{i}] = ' + json.dumps(uri) + ';\n')

# ---------------------------------------------------------------- backgrounds
BG = {
    'map_A': 'stage1_v005/assets/map_A_D.png',
    'map_B': 'stage1_v005/assets/map_B_D.png',
    'map_C': 'stage1_v005/assets/map_C_D.png',
    'far_day': 'stage1_v005/assets/far_day.png',
    'far_sunset': 'stage1_v005/assets/far_sunset.png',
    'room_A_H1': 'stage1_v005/assets/map_A_H1_D.png',
    'room_A_H1_open': 'stage1_v005/assets/map_A_H1_D_open.png',
    'room_A_H2': 'stage1_v005/assets/map_A_H2_D.png',
    'room_B_H1': 'stage1_v005/assets/map_B_H1_D.png',
    'room_B_H1_open': 'stage1_v005/assets/map_B_H1_D_open.png',
    'room_B_H2': 'stage1_v005/assets/map_B_H2_D.png',
    'room_B_H3': 'stage1_v005/assets/map_B_H3_D.png',
    'title_bg': 'title_background_384.png',          # v117: 正式タイトル TREASURE HUNTER MIKA の背景
    'world_map': 'world_map_v001/world_map_clean_384.png',  # v117: 文字・番号・地点アイコンなし
    'mid_day': 'bgfx/mid_day.png',          # 1面A 中遠景（×0.28）
    'mid_sunset': 'bgfx/mid_sunset.png',    # 1面C 中遠景
}
if MOD:
    BG.update({
        '2A_sky': 'MOD:MIKA_STAGE2_AB_CORRECTION_v001/stage2a/layers/sky.png',
        '2A_mountains': 'MOD:MIKA_STAGE2_AB_CORRECTION_v001/stage2a/layers/mountains.png',
        '2A_moai': 'MOD:MIKA_STAGE2_AB_CORRECTION_v001/stage2a/layers/moai.png',
        '2A_main': 'MOD:MIKA_STAGE2_AB_CORRECTION_v001/stage2a/layers/main.png',
        '2B_shaft': 'MOD:MIKA_ELEVATOR_STOP_FX_v001/stage2b/layers/shaft_loop.png',
        '2B_carriage': 'MOD:MIKA_ELEVATOR_STOP_FX_v001/stage2b/layers/carriage.png',
        '2C_main': 'MOD:MIKA_STAGE2C_LAB_v001/background/map_2C.png',
        '2C_H1': 'MOD:MIKA_STAGE2C_LAB_v001/background/hidden_C_H1.png',
        '3A_far': 'MOD:MIKA_STAGE3A_FOREST_v001/background/far.png',
        '3A_F1': 'MOD:MIKA_STAGE3A_FOREST_v001/background/forest_F1.png',
        '3A_F2': 'MOD:MIKA_STAGE3A_FOREST_v001/background/forest_F2.png',
        '3A_F3': 'MOD:MIKA_STAGE3A_FOREST_v001/background/forest_F3.png',
        '3A_H1': 'MOD:MIKA_STAGE3A_FOREST_v001/background/room_H1.png',
        '3A_H2': 'MOD:MIKA_STAGE3A_FOREST_v001/background/room_H2.png',
        '3B_far': 'MOD:MIKA_STAGE3B_CLOUDS_v001/background/far.png',
        '3B_mid': 'MOD:MIKA_STAGE3B_CLOUDS_v001/background/mid.png',
        '3B_main': 'MOD:MIKA_STAGE3B_CLOUDS_v001/background/main.png',
        '3B_wisps': 'MOD:MIKA_STAGE3B_CLOUDS_v001/background/wisps.png',
        '3C_window': 'MOD:MIKA_STAGE3C_CASTLE_v001/background/window_view.png',
        '3C_main': 'MOD:MIKA_STAGE3C_CASTLE_v001/background/main.png',
        '3C_rays': 'MOD:MIKA_STAGE3C_CASTLE_v001/background/rays.png',
        '3C_fore': 'MOD:MIKA_STAGE3C_CASTLE_v001/background/foreground.png',
        '3C_H1': 'MOD:MIKA_STAGE3C_CASTLE_v001/background/hidden_balcony.png',
    })
for d in D8S:
    for p in sorted(glob.glob(os.path.join(d, 'bg', '*.png'))):
        BG[os.path.basename(p)[:-4]] = p
bg_meta = {}
seen = {}   # 同じ絵の部屋背景は1ファイルにまとめる
if ANIMS_ONLY:
    bg_meta = _bg; BG = {}
for key, rel in BG.items():
    p = modp(rel[4:]) if rel.startswith('MOD:') else rel if os.path.isabs(rel) else os.path.join(SRC, rel)
    if not os.path.exists(p):
        print('missing background', rel); continue
    im = Image.open(p)
    im = im.convert('RGBA' if im.mode in ('RGBA', 'P', 'LA') else 'RGB')
    digest = hash(im.tobytes())
    if digest in seen:
        bg_meta[key] = dict(bg_meta[seen[digest]]); continue
    seen[digest] = key
    fn = f'bg_{key}.webp'
    webp(im, os.path.join(ASSET_DIR, fn))
    bg_meta[key] = {'file': 'assets/' + fn, 'size': list(im.size)}

# ---------------------------------------------------------------- animations
anim_json = json.load(open(os.path.join(SRC, 'animation.json')))
A = dict(anim_json['animations'])
for k, v in anim_json['enemy_prototype']['animations'].items():
    A['goblin_' + k] = v

def groups():
    g = {}
    for name in frames:
        m = re.match(r'^(.*)_(\d\d)$', name)
        if m:
            g.setdefault(m.group(1), []).append(name)
    for k in g:
        g[k].sort()
    return g
G = groups()

def durations(spec, n):
    for key in ('duration_ms', 'frame_durations_ms', 'preview_durations_ms', 'preview_frame_durations_ms'):
        if isinstance(spec.get(key), list) and len(spec[key]) == n:
            return spec[key]
    return [100] * n

anims = {}
def add(name, files, spec, origin=None, loop=None):
    n = len(files)
    o = origin or spec.get('origin') or [48, 77]
    entry = {'frames': files, 'dur': durations(spec, n), 'origin': o}
    if spec.get('frame_origins'):
        entry['origins'] = spec['frame_origins']
    lp = spec.get('loop') if loop is None else loop
    entry['loop'] = bool(lp) and not spec.get('preview_loops_only')
    for key in ('active_frame', 'active_frames', 'proposed_active_frame', 'proposed_active_frames',
                'muzzle_points', 'projectile_spawn', 'launch_point', 'socket_point', 'impact_point',
                'release_frame', 'pickup_event_frame', 'threat_event_frame', 'loop_frames'):
        if key in spec:
            entry[key] = spec[key]
    anims[name] = entry

for key, spec in A.items():
    files = None
    if spec.get('files'):
        files = [f[:-4] for f in spec['files']]
    elif spec.get('file'):
        files = [spec['file'][:-4]]
    else:
        for cand in ('mika_' + key, key):
            if cand in G:
                files = G[cand]; break
    if key.startswith('goblin_') and key[7:] in ('walk', 'punch', 'machinegun') and 'goblin_' + key[7:] in G:
        files = G['goblin_' + key[7:]]
    if not files:
        continue
    want = spec.get('frames')
    if isinstance(want, int) and len(files) != want:
        files = files[:want]
    add(key, files, spec)

# 個別の補足（animation.json にアニメとして登録されていない採用素材）
add('goblin_idle', ['goblin_idle_00', 'goblin_idle_01'], {'frame_durations_ms': [300, 300]}, [48, 77], True)
for single in ('goblin_grabbed', 'goblin_knee_hit', 'goblin_knee_hit_normal', 'goblin_airborne', 'goblin_downed'):
    add(single, [single], {}, [48, 77])
for k in ('machinegun_ready', 'katana_idle'):
    pass
fx = anim_json
add('muzzle_flash', ['muzzle_flash_00', 'muzzle_flash_01'], {'duration_ms': [40, 40]}, fx['weapon_fx']['right_origin'], True)
add('mg_bullet', ['machinegun_bullet_00', 'machinegun_bullet_01'], {'duration_ms': [60, 60]}, fx['weapon_fx']['bullet_origin'], True)
add('rocket_explosion', G['rocket_explosion'], {'duration_ms': [60, 70, 80, 90, 100]}, [32, 40])
add('robot_fault_fx', G['robot_fault_fx'], {'frame_durations_ms': [160] * 4}, [32, 44], True)
# v118: ゴブリン追加モーション（起き上がり・刀・ロケラン）と B2 兜セット。frame_origins を使う
ga = json.load(open(os.path.join(SRC, 'goblin_additional_animations.json')))['animations']
for k, spec in ga.items():
    add('goblin_' + k, G['goblin_' + k][:spec['frames']], spec, spec['origin'], False)
gh = json.load(open(os.path.join(SRC, 'goblin_helmet.json')))['animations']
hb = gh['base']
for idx, role in enumerate(hb['phases']):
    nm = {'idle_00': None, 'idle_01': None}.get(role, role)
    if nm:
        add('goblin_helmet_' + nm, [G['goblin_helmet_base'][idx]], {}, hb['frame_origins'][idx], False)
add('goblin_helmet_idle', G['goblin_helmet_base'][:2], {'duration_ms': hb['duration_ms'][:2]}, hb['origin'], True)
for k in ('walk', 'getup', 'katana'):
    add('goblin_helmet_' + k, G['goblin_helmet_' + k][:gh[k]['frames']], gh[k], gh[k]['origin'], k == 'walk')
# 斬風エフェクト v001（ミカの攻撃に重ねる絵だけ。判定は持たない）
afx = json.load(open(os.path.join(SRC, 'fx/attack_fx.json')))['effects']
for k, e in afx.items():
    add('fx_' + k, [os.path.basename(f)[:-4] for f in e['files']], {'duration_ms': e['duration_ms']}, e['origin'], False)
add('bgfx_smoke', G['smoke'], {'duration_ms': [220, 220, 220, 220]}, [16, 60], True)
add('bgfx_electric', G['electric'], {'duration_ms': [40, 50, 50, 60]}, [12, 12], False)
hs = json.load(open(os.path.join(SRC, 'fx/hit_sparks.json')))
add('hit_spark', [os.path.basename(f)[:-4] for f in hs['frames']], {'duration_ms': hs['duration_ms']}, hs['origin'], False)
add('healing_sparkles', G['healing_sparkles'], {'duration_ms': [90] * 4}, [32, 48])
for c in ('weak', 'good', 'high', 'rare', 'weapon'):
    add('chest_' + c, G['chest_' + c], {'duration_ms': [100, 100, 100]}, [24, 47])

# 武器の飛び道具・演出（v116 の animation.json の原点）
add('wave_cannon_fx', G['wave_cannon_fx'], {'duration_ms': [80, 90, 260, 200]}, [0, 32])
add('axe_groundwave', G['axe_groundwave'], {'duration_ms': [60, 80, 80, 120]}, [32, 32])
add('hammer_impact', G['hammer_impact'], {'duration_ms': [60, 80, 90, 120]}, [32, 32])
add('flamethrower_flame', G['flamethrower_flame'], {'duration_ms': [70, 70, 70, 70]}, [0, 16], True)
add('rocket_projectile', ['rocket_projectile'], {}, [16, 8])
add('yoichi_arrow', ['yoichi_arrow'], {}, [16, 4])
add('rocket_punch_projectile', ['rocket_punch_projectile'], {}, [16, 8])

# ---------------------------------------------------------------- 1〜3面パックのアニメ
def seq(prefix):
    return sorted(n for n in meta if re.match(re.escape(prefix) + r'_\d\d$', n))
if MOD:
    dm = json.load(open(modp('MIKA_DARK_MIKA_FULL_v001/animation.json')))['animations']
    for k, spec in dm.items():
        add('dark_mika_' + k, seq('dark_mika_' + k)[:spec['frames']], spec, [48, 77], spec.get('loop', False))
    er = json.load(open(modp('MIKA_MECHANICAL_ENEMIES_v001/enemy_rules.json')))
    ORG = {96: [48, 77], 128: [64, 109], 160: [96, 141]}
    for k, spec in er.items():
        if not isinstance(spec, dict) or 'files' not in spec:
            continue
        fam, act = ('megamega', k[9:]) if k.startswith('megamega_') else ('mega_goblin', k)
        files = [fam + '_' + os.path.basename(f)[:-4] for f in spec['files']]
        n = len(files)
        d = spec.get('frame_ms_proposal', spec.get('frame_ms', 120))
        d = d if isinstance(d, list) else [d if isinstance(d, int) else 120] * n
        cw = frames[files[0]].size[0]
        e = {'frame_durations_ms': d}
        for key in ('active_frame_proposal', 'fire_frame_proposal', 'fire_frame'):
            if key in spec:
                e['active_frame'] = spec[key]
        add(fam + '_' + act, files, e, ORG.get(cw, [48, 77]), bool(spec.get('loop')))
    add('mega_explosion', seq('mega_explosion'), {'duration_ms': [90, 110, 130, 150]}, [64, 64])
    add('megamega_explosion', seq('megamega_explosion'), {'duration_ms': [90, 110, 130, 150]}, [64, 64])
    for k in ('idle', 'fire', 'lightning', 'laugh', 'rise'):
        add('queen_' + k, seq('queen_' + k), {'duration_ms': [300 if k == 'rise' else 200] * 4}, [48, 86], k == 'idle')
    add('queen_hit', seq('queen_hit'), {'duration_ms': [80, 100, 120, 120]}, [48, 86])
    add('queen_slump', seq('queen_slump'), {'duration_ms': [200] * 4}, [48, 86])
    add('queen_seated', ['goblin_queen_seated'], {}, [48, 86])
    add('goblin_plead', seq('goblin_plead'), {'duration_ms': [220] * 4}, [48, 77], True)
    add('goblin_point', seq('goblin_point'), {'duration_ms': [100] * 4}, [48, 77])
    add('goblin_event_hop', ['goblin_event_hop'], {}, [48, 77])
    add('qfx_fire', seq('qfx_fire'), {'duration_ms': [70] * 4}, [24, 16], True)
    add('qfx_lightning', seq('qfx_lightning'), {'duration_ms': [60, 70, 80, 120]}, [32, 140])
    add('qfx_burst', seq('qfx_queen_burst'), {'duration_ms': [120, 140, 160, 200]}, [64, 64])
    add('qfx_warp', seq('qfx_warp'), {'duration_ms': [60] * 4}, [48, 86])
    for c in ('pink', 'blue', 'yellow'):
        add('fairy_' + c, seq('fairy_' + c), {'duration_ms': [125] * 4}, [12, 12], True)
    add('forest_light_stairs', seq('forest_light_stairs'), {'duration_ms': [600] * 3}, [24, 112])
    add('lab_cylinder', seq('lab_cylinder'), {'duration_ms': [100] * 4}, [32, 106])
    add('lab_hatch', seq('lab_hatch'), {'duration_ms': [100] * 2}, [24, 84])
    add('s2_bubbles', seq('s2_bubbles'), {'duration_ms': [125] * 8}, [0, 0], True)
    add('s2_monitor', seq('s2_monitor'), {'duration_ms': [125] * 8}, [0, 0], True)
    add('s2_fluorescent', seq('s2_fluorescent'), {'duration_ms': [70] * 4}, [32, 0])

# 素材の向き（元絵が左向きのアニメ）。描画側は left=true を見て反転を決める
LEFT_RE = re.compile(r'^(goblin|skeleton|ogre|gigas|deathhound|mega_goblin|megamega|queen|fairy)')
for k, a in anims.items():
    if LEFT_RE.match(k) and k not in ('goblin_point',):
        a['left'] = True

# 2026-10-08 アニメ（ヒット星形・武器の軌跡・ダンダルモン）
if D8:
    T60 = 1000 / 60
    for k, ticks, org in (('small', [1, 2, 1], [20, 20]), ('heavy', [1, 2, 2], [36, 36]), ('bullet', [1, 1, 1], [16, 16]), ('slash', [1, 2, 2], [72, 44])):
        add('hitfx_' + k, [f'hitfx_{k}_{i:02d}' for i in range(3)], {'duration_ms': [round(t * T60) for t in ticks]}, org, False)
    for k, n in (('katana_horizontal', 3), ('war_axe', 5), ('gungnir', 4), ('yoichi_bow', 5), ('battle_hammer', 4)):
        add('wfx_' + k, [f'wfx_{k}_{i:02d}' for i in range(n)], {'duration_ms': [100] * n}, [64, 99], False)
    add('dand_eyehit', [f'dand_eyehit_{i:02d}' for i in range(6)], {'duration_ms': [75] * 6}, [12, 12], True)
    add('entry_up_blue', [f'entry_up_blue_{i:02d}' for i in range(6)], {'duration_ms': [130] * 6}, [16, 28], True)   # BLUE_ENTRY_MARKER v002
    # 2026-10-09 ツギラ（左向きの絵）
    for k, fr, durs in (('tsugira_idle', [0], [300]), ('tsugira_run', [1, 2], [90, 90]), ('tsugira_slap', [3, 4, 4], [260, 120, 220]), ('tsugira_laser', [5], [200]), ('tsugira_hurt', [0], [200]), ('tsugira_getup', [0, 0], [200, 200])):
        add(k, [f'tsugira_{i:02d}' for i in fr], {'duration_ms': durs}, [48, 70], k in ('tsugira_idle', 'tsugira_run'))
        anims[k]['left'] = True
    add('mika_cool_idle', ['mika_cool_idle'], {}, [48, 77], False)
    add('dand_tflash', [f'dand_tflash_{i:02d}' for i in range(3)], {'duration_ms': [45, 45, 60]}, [2, 9], False)

missing = [(k, f) for k, a in anims.items() for f in a['frames'] if f not in meta]
if missing:
    print('MISSING FRAMES', missing[:20])

props = json.load(open(os.path.join(SRC, 'stage1_v005/props.json')))

with open(os.path.join(DATA_DIR, 'assets.js'), 'w', encoding='utf-8') as f:
    f.write('// 自動生成: tools/build_assets.py  (手で編集しない)\n')
    f.write('window.MIKA = window.MIKA || {};\n')
    f.write('MIKA.ATLAS = ' + json.dumps({'pages': len(page_files), 'frames': meta}, separators=(',', ':')) + ';\n')
    f.write('MIKA.BG = ' + json.dumps(bg_meta, ensure_ascii=False, separators=(',', ':')) + ';\n')
    f.write('MIKA.ANIMS = ' + json.dumps(anims, ensure_ascii=False, separators=(',', ':')) + ';\n')
    f.write('MIKA.PROPS = ' + json.dumps(props, ensure_ascii=False, separators=(',', ':')) + ';\n')

total = sum(os.path.getsize(os.path.join(ASSET_DIR, x)) for x in os.listdir(ASSET_DIR))
print(f'frames={len(meta)} pages={len(pages)} anims={len(anims)} assets={total/1024:.0f}KB')
