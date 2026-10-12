#!/usr/bin/env python3
"""2026-10-10 5面（デスポリス・屋内ルート）の仮データを作る。
  data/stage_maps.json の 5A〜5H、data/map_names.json の5面、data/stage5_enemy_placement.json を書き直す（他の面には触らない）。
  素材: MIKA_DELTA_AFTER_STAGE4AB_20261009_v001（背景は tools/prep_stage5.py で変換済み）。数値・座標はすべて [仮]。
"""
import json, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = os.path.join(ROOT, 'data')
WALK = [154, 198]
VEND_Y = 150   # 2026-10-11 ユーザー指定: 自販機は壁際（歩ける範囲の奥の端）。床の真ん中に置かない
NOTE = '[仮] 2026-10-10 5面 v001 素材の初期配置'

def chest(i, x, y, item): return {'id': i, 'kind': 'chest', 'x': x, 'y': y, 'loot_item': item, 'note': '[仮] 固定の回復（PPT）'}
def vending(i, art, x, y):
    return {'id': i, 'kind': 'state_prop', 'art': art, 'x': x, 'y': y, 'origin': None, 'footprint': [44, 10], 'hp': 1, 'score': 100,
            'drop_chance': 0.2, 'loot_table': 1, 'behind': True, 'hitY': y + 5,   # 2026-10-11 壁際に置き、キャラより必ず奥に描く（攻撃は歩ける端から届く）
            'note': '[仮] 壊せる自販機（正常／破壊の別絵）'}
def main(key, name, width, bg, music, props=(), exit=None, specials=None, fx=None, front=None):
    m = {'stage': 5, 'key': key, 'kind': 'main', 'width': width, 'start': [42, 181], 'walk': WALK, 'name': name, 'music': music,
         'layers': [{'bg': bg, 'factor': 1}], 'props': list(props), 'portals': [], 'specials': specials or {}, 'exit': exit, 'note': NOTE}
    if fx: m['fx'] = fx
    if front: m['front_layers'] = front
    return m

O = json.load(open(os.path.join(D, 'stage_maps.json'), encoding='utf-8'))
ORG = {}
try:
    import re
    s = open(os.path.join(D, 'assets5.js'), encoding='utf-8').read()
    ORG = json.loads(re.search(r'STAGE5_PROP_ORIGINS = (\{.*?\});', s).group(1))
except Exception:
    pass
def fixorg(props):
    for p in props:
        if p.get('kind') == 'state_prop': p['origin'] = ORG.get(p['art'], [28, 80])
    return props

glass = lambda k: [{'bg': k + '_glass', 'factor': 1, 'clipX': [45, 720], 'note': '手前のガラス（キャラの手前・HUDの奥）。入口と出口の扉は覆わない'}]
maps = {
  '5A': main('A', 'ヴァンパイアステートビル 1F', 1920, '5A_main', 'stage5_abchi',
             # 2026-10-11 PPT準拠: 宝箱は画面3（ポーション）・画面4（ハイポーション）。自販機は床の真ん中で不自然なので撤去（ユーザー了承）
             props=[chest('5A_potion_chest', 930, 181, 'potion'), chest('5A_high_potion_chest', 1405, 181, 'high_potion')],
             exit={'mode': 'right_door', 'x': 1880, 'to': '5B',
                   'note': '2026-10-11: 背景は継ぎ目のない元の5枚に戻した。2体撃破→GO→右奥のガラスの外壁エレベーターへ歩いて出る（1F→13F）'},
             specials={'source': 'MIKA_STAGE5A_COMPLETE_MAIN_ROUTE_v001', 'secret_rooms': '未収録（サービス扉は背景のまま。青い△なし）'}),
  # 2026-10-11 PPT準拠: 5Bは右のエレベーターで着いて左へ進み、左のエレベーターで37Fへ。宝箱は画面1（ポーション）・画面2（ハイポーション）
  '5B': main('B', 'VSビル13F', 1152, '5B_main', 'stage5_abchi',
             props=[chest('5B_chest_01', 177, 190, 'potion'), chest('5B_chest_02', 657, 190, 'high_potion')],
             exit={'mode': 'left_door', 'x': 30, 'to': '5C', 'note': 'PPT: 左端のエレベーターから外壁エレベーター（13F→37F）'},
             specials={'pending': '入れる会議室（中央の開いた扉）は部屋の背景が未着のため未設定'}),
  '5C': main('C', 'VSビル37F', 1152, '5C_main', 'stage5_abchi',
             props=fixorg([vending('5C_vending_01', 'st5c_vending', 200, VEND_Y), vending('5C_vending_02', 'st5c_vending', 520, VEND_Y),
                           chest('5C_chest_01', 610, 188, 'potion'), vending('5C_vending_03', 'st5c_vending', 883, VEND_Y)]),   # PPT: △各画面1つ・宝箱は画面2。自販機は奥の端（壁際）
             exit={'mode': 'right_edge', 'x': 1140, 'to': '5D', 'note': '右端の連絡通路へ'}),
  # 2026-10-11 v052（v041の背景）: 5Dは3画面1152幅。ダンダルモンの壁は画面1（壁の絵 x145〜267・ボス基準 x205）。旧768幅の手前ガラスは使わない
  '5D': main('D', '連絡通路', 1152, '5D_main', 'stage5_defg', props=[chest('5D_chest_01', 600, 188, 'potion')],
             exit={'mode': 'right_edge', 'x': 1142, 'to': '5E', 'note': 'ダンダルモン（画面1）撃破後、画面2・3を進んで右端から5Eへ'},
             fx='4C', specials={'boss_wall': 'ダンダルモン（4Cの絵と動きを流用）。画面1の壁', 'dand_left': 1003}),
  '5E': main('E', 'バブイルトレンドセンター37F', 1152, '5E_main', 'stage5_defg',
             props=fixorg([vending('5E_vending_01', 'st5e_vending', 200, VEND_Y), vending('5E_vending_02', 'st5e_vending', 520, VEND_Y),
                           chest('5E_chest_01', 610, 190, 'potion'), vending('5E_vending_03', 'st5e_vending', 883, VEND_Y)]),   # 自販機は奥の端（ロープの切れ目）   # PPT: △各画面1つ・宝箱は画面2
             exit={'mode': 'right_edge', 'x': 1140, 'to': '5F', 'note': '右端から外壁エレベーター（37F→99F）。5Fの右側に着く'}),
  # 2026-10-11 v039: 5F・5Gも右から入って左へ（5E右のエレベーターで5Fの右に着く→5F→5G→5Hは連続して左進行）。宝箱は旧配置の左右反転
  '5F': main('F', 'BTセンター99F', 1152, '5F_main', 'stage5_defg', props=[chest('5F_chest_01', 177, 190, 'potion')],
             exit={'mode': 'left_edge', 'x': 14, 'to': '5G', 'note': 'v039: 右のエレベーターから入り、左の連絡通路2へ（絵の左右の構図は画像側で修正）'},
             specials={'pending': 'カオーン・アシーンとも2026-10-11から本物'}),
  '5G': main('G', '連絡通路', 768, '5G_main', 'stage5_defg', props=[chest('5G_chest_01', 768 - 215, 190, 'high_potion')],
             exit={'mode': 'left_edge', 'x': 14, 'to': '5H', 'note': 'v039: 右のBT側から入り、左のVSビル99Fへ'}, front=glass('5G')),
  '5H': main('H', 'VSビル99F', 1152, '5H_main', 'stage5_abchi', props=[chest('5H_chest_01', 177, 190, 'potion')],
             exit={'mode': 'left_edge', 'x': 14, 'to': '5I',
                   'note': '左側の出口が展望台行きの高速エレベーター（34秒の場面・左右反転）。5Iが未制作の間は場面の後 TO BE CONTINUED'},
             specials={'pending': '5Hの背景は採用確認待ち。右端から入って左へ進む（5Gから）。右端の扉は飾り'}),
}
# 2026-10-11 v051: 5Iの障害物（PPTの足Xは1920幅のまま。yは歩ける帯の中で前後に散らす [仮]）
OBST_KINDS = ['barricade', 'rubble', 'fallen_sign']
def obst(i, x, y, kind):
    return {'id': f'5I_prop_{i:02d}', 'kind': kind, 'x': x, 'y': y, 'hp': 1, 'score': 100, 'loot_mode': 'chance_chest', 'loot_table': 1, 'drop_chance': 0.2,
            'solid_proposal': True, 'note': '[仮] v051 STAGE5I_ADDITIONS（種類は未指定のため1面の障害物を順に）'}
OBST5I = [obst(i + 1, x, y, OBST_KINDS[i % 3]) for i, (x, y) in enumerate([(28, 186), (77, 168), (129, 190), (651, 172), (705, 190), (890, 170), (938, 192), (990, 176)])]
# 2026-10-11 v050: 5I 展望台（ダークミカ2体→宝箱2→ウルトラマシーンS）・5J 宝物庫（宝箱→長老ファイナルゴブリン戦）
maps['5I'] = main('I', '展望台', 1920, '5I_main', 'stage5_abchi',
                  # 2026-10-11 v051: PPTスライド26の赤三角8つ＝1面と同じ障害物（種類はPPTに無いので 柵・瓦礫・倒れた看板 を順に [仮]）。宝箱は障害物と重ならない位置へ
                  props=OBST5I + [chest('5I_chest_01', 1100, 188, 'high_potion'), chest('5I_chest_02', 1330, 190, 'high_potion')],
                  exit={'mode': 'right_door', 'x': 1880, 'to': '5J', 'note': 'ウルトラマシーンS撃破→GO→右の扉から宝物庫へ'},
                  specials={'pending': 'PPTの障害物（△）と画面3の入れる部屋は素材が無いので未設置'})
maps['5I']['fx'] = '5I'
maps['5I']['specials'] = {'note': 'v051: 障害物8つ（PPTの赤三角）と画面2の入れる部屋 5I_H1'}
maps['5J'] = main('J', 'デスポリス 宝物庫', 384, '5J_main', 'stage5_j', exit=None,
                  specials={'event': '宝箱で喜ぶ→カタッ→長老登場→ファイナルゴブリン戦→6Aへ（js/stage6.js）'})
maps['5J']['walk'] = [158, 198]; maps['5J']['start'] = [70, 186]; maps['5J']['fx'] = '5J'
# 2026-10-11 v051（v041の7部屋＋5I_H1）: 本線の画面の扉（ロープの切れ目）から入る。左の扉で親へ戻る。5A_H2・5B_H1は右の扉で奥の部屋へ
#   部屋の敵と宝箱はPPTに指定が無いので [仮]（隠し部屋の決まりどおり 敵2〜3体＋宝箱1つ。奥の部屋は良い宝箱）
ROOM_ENC = {'5A': ['mega_goblin', 'megamega'], '5B': ['kaon', 'mega_goblin'], '5F': ['death_goblin', 'tsugira', 'ashiin'], '5H': ['ashiin', 'megamega', 'kaon'], '5I': ['ashiin', 'tsugira']}
def room(rid, parent, deeper=None, table=2):
    k = rid.split('_')[0]
    m = {'stage': 5, 'key': rid[1:], 'kind': 'room', 'name': None, 'width': 384, 'walk': [154, 198], 'start': [48, 176], 'music': None, 'parent': parent,
         'layers': [{'bg': 'room_' + rid, 'factor': 0}],
         'props': [{'id': rid + '_chest', 'kind': 'chest', 'x': 300 if not deeper else 250, 'y': 190, 'hp': 1, 'loot_table': table, 'note': '[仮]'}],
         'portals': [{'id': rid + '_return', 'x': 30, 'y': 158, 'half': [16, 12], 'to': parent, 'trigger': 'up', 'reuse': 'return_to_parent'}],
         'specials': {'encounter': {'delay_ms': 700, 'group': ROOM_ENC.get(k, ['mega_goblin', 'megamega']), 'max_alive': 3, 'note': '[仮] PPTに部屋の敵の指定なし'}},
         'note': 'v051 部屋の背景（v041/v051）。扉の開閉コマはなし（暗転で出入り）'}
    if deeper:
        m['portals'].append({'id': rid + '_deeper', 'x': 360, 'y': 158, 'half': [16, 12], 'to': deeper, 'trigger': 'up', 'reuse': 'one_visit', 'return_xy': [352, 178], 'room_xy': [48, 176], 'note': '右の扉から奥の部屋へ'})
    return m
def door(main_key, rid, x):
    maps[main_key]['portals'].append({'id': f'{main_key}_door_{rid}', 'x': x, 'y': 158, 'half': [16, 12], 'to': rid, 'trigger': 'up', 'reuse': 'one_visit',
                                      'return_xy': [x, 178], 'room_xy': [48, 176], 'note': 'v051 PPTの赤丸（入れる部屋）'})
ROOMS = {'5A_H1': room('5A_H1', '5A'), '5A_H2': room('5A_H2', '5A', deeper='5A_H3'), '5A_H3': room('5A_H3', '5A_H2', table=3),
         '5B_H1': room('5B_H1', '5B', deeper='5B_H2'), '5B_H2': room('5B_H2', '5B_H1', table=3), '5F_H1': room('5F_H1', '5F'), '5H_H1': room('5H_H1', '5H'),
         '5I_H1': room('5I_H1', '5I')}
door('5A', '5A_H1', 717); door('5A', '5A_H2', 1187); door('5B', '5B_H1', 578); door('5F', '5F_H1', 480); door('5H', '5H_H1', 480); door('5I', '5I_H1', 591); maps['5I']['portals'][-1]['half'] = [26, 10]; maps['5I']['marker_near'] = 90   # v053: 背景の扉（x565〜617）に合わせる。青い矢印は近づいた時だけ
maps['5A']['specials'].pop('secret_rooms', None); maps['5B']['specials'].pop('pending', None)
O['stages']['5'] = {'name': 'デスポリス', 'first': '5A', 'order': list(maps)}
for k, v in ROOMS.items(): O['maps'][k] = v
# 6面 脱出（ワールドマップには出さない）。6Aは5Jと同じ部屋。6Bで制限時間が始まり、やり直し地点も6B。6C以降は穴から降りてくる
def esc(key, name, width, bg, travel, props=(), walk=None, start=None, extra=None, src=None):
    m = main(key, name, width, bg, ESC_MUSIC, props=props)
    if src: m['_src'] = src   # 元の5面マップ（逆向きに走る）の床・ロープ・手前の層をそのまま使う（下でロープを置いた後に写す）
    m['stage'] = 6; m['fx'] = '6' + key if key in ('A', 'B', 'F') else '6CDE'
    if travel: m['travel'] = travel
    if walk: m['walk'] = walk
    if start: m['start'] = start
    m['tgroup'] = '6ESC' if key != 'A' else '6A'
    m['time_initial'] = ESC_TIME
    if extra: m.update(extra)
    return m
ESC_MUSIC = 'stage6'   # 2026-10-11 BGM_STAGE06
ESC_TIME = 500        # 2026-10-12 ユーザー指定: 元の600から100秒減らす。6B〜6Fの合計の制限時間（秒）。6Bから数え始め、6Fまで引き継ぐ
smaps = {
  '6A': esc('A', 'デスポリス 宝物庫', 384, '5J_main', None, walk=[158, 198], start=[150, 186]),
  '6B': esc('B', '脱出！ 展望台', 1920, '6B_main', 'right_to_left', start=[300, 181],
            props=json.loads(json.dumps(OBST5I)) + [chest('5I_chest_01', 1100, 188, 'high_potion'), chest('5I_chest_02', 1330, 190, 'high_potion')],
            extra={'escort': {'zako': 2, 'stuck': True}, 'state_key': '5I',
                   'note6': 'v051: 6Bは5Iの逆走。5Iで壊した物・開けた宝箱はそのまま（同じID・state_key=5I）'}),
  '6C': esc('C', '脱出！ VSビル99F', 1152, '5H_main', None, props=[chest('6C_chest_01', 420, 190, 'potion')], start=[80, 181], src='5H',
            extra={'escort': {'zako': 2, 'boss': 'dandalmon', 'boss_hp': 42}}),
  '6D': esc('D', '脱出！ VSビル37F', 1152, '5C_main', 'right_to_left', props=[chest('6D_chest_01', 700, 188, 'high_potion')], start=[1072, 181], src='5C',
            extra={'escort': {'zako': 2, 'boss': 'dandalmon', 'boss_hp': 42}}),
  '6E': esc('E', '脱出！ VSビル13F', 1152, '5B_main', None, props=[chest('6E_chest_01', 450, 190, 'potion'), chest('6E_chest_02', 720, 190, 'high_potion')], start=[80, 181], src='5B',
            extra={'escort': {'zako': 2, 'boss': 'dandalmon', 'boss_hp': 42}}),
  '6F': esc('F', '脱出！ ヴァンパイアステートビル 1F', 1920, '5A_main', 'right_to_left', start=[1840, 181], src='5A',
            props=[chest('6F_chest_01', 500, 181, 'potion'), chest('6F_chest_02', 1000, 181, 'high_potion')],
            extra={'escort': {'zako': 2, 'boss': 'dark_mika', 'boss_count': 4, 'hp_ratio': 1 / 3}}),
}
smaps['6A']['music'] = None   # 6Aは無音で始まり、警報（合成音）だけ
ZAKO6 = ['mega_goblin', 'megamega', 'kaon', 'ashiin', 'death_goblin', 'tsugira']
for v in smaps.values():
    if 'escort' in v: v['escort']['zako_ids'] = ZAKO6
O['stages']['6'] = {'name': '脱出', 'first': '6A', 'order': list(smaps), 'hidden_on_world_map': True}
for k, v in smaps.items(): O['maps'][k] = v
# 2026-10-11 外壁エレベーター（js/elevator.js）。着いた階の停止音は場面の中で鳴らす（arrival_se は使わない）
maps['5A']['elevator'] = {'route': 0, 'note': '1F→13F 外壁エレベーター'}
maps['5B']['elevator'] = {'route': 1, 'mirrored': True, 'note': '13F→37F（左の出口から乗るので左右反転）'}
maps['5E']['elevator'] = {'route': 2, 'note': '37F→99F'}
maps['5H']['elevator'] = {'route': 3, 'mirrored': True, 'note': '99F→展望台 長距離急加速（左の出口から乗るので左右反転）'}
for k in ('5B', '5F', '5G', '5H'): maps[k]['travel'] = 'right_to_left'; maps[k]['start'] = [342, 181]   # 右から入って左へ（start は開始画面の中の座標）
# 2026-10-11 進入禁止のポール＋ロープ（v042）。奥の床が歩けるように見える所だけ。扉・出入口・乗り場の前は開ける。ポール底 y=150（歩行上限154の4px奥）
BAR = {
  '5A': [[80, 690], [745, 1160], [1215, 1535], [1590, 1835]],   # 左の入口・扉（x≈715/1190/1560）・右のガラスエレベーターの前を開ける
  '5E': [[60, 176], [224, 496], [544, 859], [907, 1080]],      # 左の扉・右のエレベーター。自販機（x=200/520/883）の所はロープを切る
  '5F': [[70, 440], [520, 1080]],                              # 左の連絡通路・右のエレベーター。画面2（x≈480）は入れる部屋の入口（PPT）用に開ける
  '5H': [[70, 440], [520, 1080]],                              # 左の出口・右の扉。画面2の部屋の入口（PPT）を開ける
}
for k, spans in BAR.items(): maps[k]['barriers'] = {'y': 150, 'spans': spans, 'note': 'MIKA_NO_ENTRY_PARTS_v042（見た目だけ・判定なし）'}
for k, v in maps.items(): O['maps'][k] = v
for v in smaps.values():
    src = v.pop('_src', None)
    if src:
        for k2 in ('walk', 'barriers', 'front_layers'):
            if maps[src].get(k2): v[k2] = json.loads(json.dumps(maps[src][k2]))
json.dump(O, open(os.path.join(D, 'stage_maps.json'), 'w', encoding='utf-8'), ensure_ascii=False)

N = json.load(open(os.path.join(D, 'map_names.json'), encoding='utf-8'))
N['stages'] = [s for s in N['stages'] if s['stage_id'] != 5] + [{'stage_id': 5, 'world_name': 'デスポリス',
    'maps': {v['key']: v['name'] for v in maps.values()}, 'map_names_status': '[仮] 5面v001素材のmap.json・PPTから'}]
N['stages'] = [s for s in N['stages'] if s['stage_id'] != 6] + [{'stage_id': 6, 'world_name': '脱出',
    'maps': {v['key']: v['name'] for v in smaps.values()}, 'map_names_status': '[仮] PPTから'}]
N.pop('stage5', None)
json.dump(N, open(os.path.join(D, 'map_names.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

# ---------------------------------------------------------------- 敵配置
# PPTの「左から 1.1.2.3」などを強さの段（1=メガゴブリン 2=メガメガ 3=デスゴブリン 4=ツギラ）として読んだ仮配置
TIER = {1: 'mega_goblin', 2: 'megamega', 3: 'death_goblin', 4: 'tsugira'}
sections, waves = [], []
def sec(sid, mp, kind, screen, start='on_section_enter'):
    sections.append({'section_id': sid, 'map': mp, 'kind': kind, 'screen': screen, 'wave_start': start})
def wave(sid, tiers, weapons=None, groups=None, sub=None):
    for i, t in enumerate(tiers):
        eid = (sub or {}).get(t, TIER[t]) if isinstance(t, int) else t
        waves.append({'section_id': sid, 'order': i + 1, 'group': (groups or [1 + i // 2 for _ in tiers])[i] if groups else 1 + i // 2,
                      'spawn_when_alive_le': 1, 'enemy_id': eid, 'weapon_id': (weapons or {}).get(i, 'none'),
                      'drop_weapon': i in (weapons or {}), 'quantity': 1, 'spawn_side': 'right' if i % 3 else 'left' if 'travel' in sid else 'right',
                      'lane': ['upper', 'lower', 'middle'][i % 3], 'appearance': 'standard', 'source': '2026-10-10 5面 仮配置（PPTの段数）', 'status': '[仮]'})
def three_rtl(L, mp, plan):   # 右から入って左へ進む（画面3→2→1）
    for n in (1, 2, 3):
        sec(f'{L}{n}', mp, 'combat', 4 - n)
        wave(f'{L}{n}', *plan[f'{L}{n}'])
        if n < 3:
            sec(f'{L}{n}_travel', mp, 'travel', 4 - n, 'on_travel_enter')
            wave(f'{L}{n}_travel', *plan[f'{L}{n}_travel'])
def three(L, mp, plan):
    for n in (1, 2, 3):
        sec(f'{L}{n}', mp, 'combat', n)
        wave(f'{L}{n}', *plan[f'{L}{n}'])
        if n < 3:
            sec(f'{L}{n}_travel', mp, 'travel', n, 'on_travel_enter')
            wave(f'{L}{n}_travel', *plan[f'{L}{n}_travel'])

# 5A 本線: MIKA_STAGE5A_COMPLETE_MAIN_ROUTE_v001 の encounters.json を写す（初期3体、残りは同時3体未満で追加。指定武器は撃破時に一度だけ落とす）
A5ENC = os.environ.get('A5_ENC', '/home/claude/src/d1010/a5/MIKA_STAGE5A_COMPLETE_MAIN_ROUTE_v001/data/encounters.json')
NAME = {'メガゴブリン': 'mega_goblin', 'メカゴブリン': 'mega_goblin', 'メガメガ': 'megamega', 'ゴブリンメカ': 'goblin_mech'}
WPN = {'刀': 'katana', 'サブマシンガン': 'machinegun', 'ロケットランチャー': 'rocket_launcher'}
ENC = json.load(open(A5ENC, encoding='utf-8'))
for n, sc in enumerate(ENC['normalScenes'], 1):
    sid = f'A{n}'
    sec(sid, '5A', 'combat', n)
    sections[-1]['wave_max_alive'] = ENC.get('normalConcurrentCap', 4)
    for e in sc['entries']:
        later = e['trigger']['type'] == 'active_normal_count_below'
        w = WPN.get(e['weapon']) if e['weapon'] else 'none'
        row = {'section_id': sid, 'order': e['order'], 'group': 2 if later else 1,
               'spawn_when_alive_le': (e['trigger']['value'] - 1) if later else 9, 'enemy_id': NAME[e['enemy']], 'weapon_id': w,
               'drop_weapon': bool(e['dropWeapon']), 'quantity': 1, 'spawn_side': e['entrySide'], 'feet_y': e['feetY'], 'settle_x': e['settleWorldX'],
               'appearance': 'standard', 'source': '5A v001 ' + e['id'], 'status': '[仮] 提案配置'}
        if e['dropWeapon']: row['weapon_source'] = e['id']   # 確率で落とす処理の対象外（必ず一度だけ落とす）
        waves.append(row)
    sec(f'A{n}_travel', '5A', 'travel', n, 'on_travel_enter')
# 2026-10-11 ユーザー指定: アシーンは5面専用で1Fから。5Aの各場面で、武器を持たない後半の1体をアシーンに
for n in range(1, len(ENC['normalScenes']) + 1):
    rows = [w for w in waves if w['section_id'] == f'A{n}' and w['weapon_id'] == 'none' and not w['drop_weapon']]
    if rows: rows[-1]['enemy_id'] = 'ashiin'; rows[-1]['source'] += ' / 2026-10-11 アシーンに差し替え'
sec('A5', '5A', 'boss', 5, 'boss_special')
MB = ENC['minibossEncounter']['bosses']
# 2026-10-11 ユーザー指定: カオーンは5面の13F（5B）から出す。各マップの戦う場面に1〜2体（武器持ちの枠は使わない）
three_rtl('B', '5B', {'B1': ([1, 1, 2, 'kaon'], {1: 'machinegun'}), 'B1_travel': ([1, 'ashiin'],), 'B2': ([2, 'ashiin', 3], {0: 'katana'}),
                  'B2_travel': ([1, 1],), 'B3': ([2, 'kaon', 3, 4], {2: 'rocket_launcher'})})
three('C', '5C', {'C1': ([1, 'ashiin', 2], {0: 'machinegun'}), 'C1_travel': (['ashiin', 3],), 'C2': ([1, 2, 'kaon', 3],),
                  'C2_travel': ([1, 2], {0: 'katana'}), 'C3': ([2, 'kaon', 4],)})
# 2026-10-11 v052: 画面1でダンダルモン（区間IDはD2のまま）→ 画面2の戦闘（D1のまま）→ 画面3を通って右端から出る
# 2026-10-12 ユーザー指定: ダンダルモンは右端（画面3）。画面1の戦闘 → 画面2・3 → ダンダルモン → 右端から出る
sec('D1', '5D', 'combat', 1); wave('D1', [1, 'kaon', 3], {2: 'machinegun'})
sec('D1_travel', '5D', 'travel', 1, 'on_travel_enter')
sec('D3', '5D', 'travel', 2, 'on_travel_enter')
sec('D2_travel', '5D', 'travel', 2, 'on_travel_enter')
sec('D2', '5D', 'boss', 3, 'boss_special')
three('E', '5E', {'E1': ([1, 1, 'ashiin', 3], {1: 'flamethrower'}), 'E1_travel': ([1, 2],), 'E2': ([2, 'kaon', 3], {0: 'battle_hammer'}),
                  'E2_travel': (['ashiin', 3],), 'E3': ([1, 2, 'kaon', 4],)})
sub5f = {1: 'kaon', 4: 'ashiin'}   # 2026-10-11 5Fはカオーン（段1）とアシーン（段4）の本来の持ち場
three_rtl('F', '5F', {'F1': ([1, 1, 2, 4], {2: 'machinegun'}, None, sub5f), 'F1_travel': ([1, 3], None, None, sub5f),
                  'F2': ([4, 1, 3, 2], {1: 'rocket_launcher'}, None, sub5f), 'F2_travel': ([1, 1], None, None, sub5f),
                  'F3': ([4, 4, 2, 3], {3: 'katana'}, None, sub5f)})
sec('G1', '5G', 'combat', 2); wave('G1', [2, 'kaon', 3], {0: 'battle_hammer'})     # v039: 右から（画面2→1）
sec('G1_travel', '5G', 'travel', 2, 'on_travel_enter'); wave('G1_travel', [1, 'ashiin'])
sec('G2', '5G', 'combat', 1); wave('G2', [1, 'kaon', 3, 4])
three_rtl('H', '5H', {'H1': (['kaon', 1, 2, 4], {1: 'machinegun'}), 'H1_travel': (['ashiin', 3],), 'H2': ([2, 'ashiin', 3, 4], {0: 'war_axe'}),
                  'H2_travel': ([1, 2],), 'H3': ([2, 'kaon', 4, 4], {2: 'rocket_launcher'})})

# 5I: 雑魚は出ない。画面2でダークミカ2体（HP半分・攻撃頻度半分・取り巻きなし）→画面5でウルトラマシーンS
sec('I1', '5I', 'travel', 1, 'on_travel_enter')
sec('I2', '5I', 'boss', 2, 'boss_special')
sec('I2_travel', '5I', 'travel', 2, 'on_travel_enter')
sec('I3', '5I', 'travel', 3, 'on_travel_enter')
sec('I4', '5I', 'travel', 4, 'on_travel_enter')
sec('I5', '5I', 'boss', 5, 'boss_special')
sec('J1', '5J', 'boss', 1, 'boss_special')
P = {'version': 1, 'stage': 5, 'purpose': '2026-10-10 5面 デスポリス（屋内ルート）仮配置。5A本体・5I・5Jは未着',
     'defaults': {'wave_total': 5, 'wave_max_alive': 4, 'fixed_excluded_from_cap': True, 'soft_total_cap_with_fixed': 6, 'fixed_additional_to_wave': True},
     'sections': sections, 'waves': waves, 'fixed_enemies': [], 'weapon_sources': [],
     'boss': None,
     'minibosses': [
       {'section': 'A5', 'type': 'goblin_mech', 'count': 2, 'hp_ratio_of_stage1_boss': MB[0]['hpFactorRelativeToCurrentStage1Boss'],
        'cool_mul': MB[0]['attackIntervalFactor'], 'feet': [[b['worldX'], b['feetY']] for b in MB], 'adds': None,
        'note': '1面ボス2体（HP半分・攻撃間隔2倍・取り巻きなし）。2体撃破でGO→右端のエレベーター'},
       {'section': 'D2', 'type': 'dandalmon', 'mid': True, 'hp': 42, 'adds_enemy_id': None, 'adds_max_alive': 0, 'adds_total': 0,
        'note': '4面ボスの元のHP85の1/3（28）を1.5倍＝42・攻撃力は元のまま・攻撃頻度半分（2026-10-11 ユーザー指定）。壁に張り付く', 'freq_mul': 0.5},
       {'section': 'I2', 'type': 'dark_mika', 'mid': True, 'count': 2, 'hp_ratio': 0.5, 'cool_mul': 2,
        'note': 'PPT: ダークミカ2体。HP半分・攻撃頻度半分・取り巻きなし'},
       {'section': 'I5', 'type': 'ultra_machine_s', 'hp': 297,   # 2026-10-12 v107 10%減（330→297）
       'no_clear': True, 'music': 'boss_doctor_s',
        'note': '2026-10-11 HP330（110の3倍・ユーザー指定）。最終兵器ウルトラマシーンS（ドクターS）。予兆を見てレーザーを避ける。撃破でGO→右の扉から5J'},
       {'section': 'J1', 'type': 'final_goblin', 'hp': 125, 'staff_dmg': 1, 'no_clear': True, 'music': 'boss',
        'note': 'PPT: 長老ファイナルゴブリン。HP125（50の2.5倍・2026-10-11 ユーザー指定）・HP1/2で動き2倍・1/4でさらに2倍・杖1・超高速で逃げ回る・ひるむ・吹っ飛ぶとワープ。倒すと6A（同じ部屋）'},
     ]}
json.dump(P, open(os.path.join(D, 'stage5_enemy_placement.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('maps', list(maps), 'sections', len(sections), 'waves', len(waves))
