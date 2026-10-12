#!/usr/bin/env python3
"""1〜3面の初期データを作る（2026-10-07 MIKA_STAGE123_IMPLEMENTATION の指針から一度だけ生成）。

  python3 tools/make_stage_data.py <modules フォルダ>

書き出すもの（以後はこれらのJSONが正本。直したらこのスクリプトは使わず tools/build_data.py だけを実行）:
  data/stage_maps.json                 全マップの背景・歩行範囲・出口・隠し部屋・小物・宝箱・ギミック
  data/stage1_enemy_placement.json     1面（既存の正本を指針に合わせて改訂。version+1）
  data/stage2_enemy_placement.json     2面（新規）
  data/stage3_enemy_placement.json     3面（新規）
既存の正本を上書きするので、作り直す時は注意。
"""
import json, os, sys, copy

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'data')
MOD = sys.argv[1]
def J(*p):
    return json.load(open(os.path.join(MOD, *p), encoding='utf-8'))
def save(name, obj):
    with open(os.path.join(DATA, name), 'w', encoding='utf-8') as f:
        json.dump(obj, f, ensure_ascii=False, indent=1)

s1map = json.load(open(os.path.join(DATA, 'stage1_map.json'), encoding='utf-8'))

# ================================================================ マップ
maps = {}
def main_map(stage, key, **kw):
    d = dict(stage=stage, key=key, kind='main', width=1920, start=[72, 182], props=[], portals=[], specials={})
    d.update(kw)
    maps[f'{stage}{key}'] = d

# ---- 1面（stage1_map.json の座標をそのまま使う）
names1 = {'A': 'ナンザスシティ', 'B': 'オラクル百貨店', 'C': 'ナンザスシティ'}
for k in 'ABC':
    m = s1map['maps'][k]
    props = [dict(o) for o in s1map['objects'] if o['map'] == k]
    portals = [dict(p) for p in s1map['portals'] if p['map'] == k]
    for p in portals:
        p['to'] = '1' + p['to']
    main_map(1, k, name=names1[k], walk=m['walkable_foot_y'], start=m['start'], music='stage1',
             layers=[{'bg': 'map_' + k, 'factor': 1}], fx='stage1',
             exit={'x': 1896, 'to': {'A': '1B', 'B': '1C', 'C': None}[k], 'mode': 'right_edge'},
             props=props, portals=portals)
for rid, r in s1map['rooms'].items():
    props = [dict(o) for o in s1map['objects'] if o['map'] == rid]
    portals = [dict(p) for p in s1map['portals'] if p['map'] == rid]
    for p in portals:
        p['to'] = '1' + p['to']
    maps['1' + rid] = dict(stage=1, key=rid, kind='room', name=None, width=384, walk=r['walkable_foot_y'],
                           start=[r['return_x'] + 24, 182], music=None, parent='1' + r['parent'],
                           layers=[{'bg': 'room_' + rid, 'factor': 1}],
                           open_bg=('room_' + rid + '_open') if r.get('opened_asset') else None,
                           props=props, portals=portals, specials={})
# 1面の隠し部屋: 宝箱・ネスト入口・戻り口の配置は stage1_map.json のまま

# ---- 2面A モアイ荒野
fx2 = J('MIKA_STAGE2_BACKGROUND_FX_v001', 'background_fx.json')
def s2props(mapid):
    out = []
    for i, p in enumerate(q for q in fx2['placement_proposals'] if q['map'] == mapid):
        out.append({'id': f'{mapid}_prop_{i+1:02d}', 'kind': 'state_prop', 'art': 's2_' + p['type'], 'x': p['foot'][0], 'y': p['foot'][1],
                    'origin': [48, 76], 'footprint': [44, 10], 'hp': 1, 'score': 100, 'drop_chance': 0.2, 'loot_table': 1})
    return out
bg2a = J('MIKA_STAGE2_AB_CORRECTION_v001', 'stage2a', 'background.json')
main_map(2, 'A', name='モアイ荒野', walk=[bg2a['walk_bounds_proposal']['foot_y_min'], bg2a['walk_bounds_proposal']['foot_y_max']],
         music='stage2_ab', fx='2A',
         layers=[{'bg': '2A_' + l['id'], 'factor': l['factor'], 'y': l['y'], 'opacity': l['opacity']} for l in bg2a['layers']],
         exit={'x': 1666, 'y': 162, 'w': 44, 'to': '2B', 'mode': 'up', 'note': '基地入口のシャッター前で↑（開閉素材は未着）'},
         props=s2props('2A'))

# ---- 2面B 地下エレベーター
ev = J('MIKA_ELEVATOR_STOP_FX_v001', 'stage2b', 'elevator.json')
maps['2B'] = dict(stage=2, key='B', kind='elevator', name='ヒミツ研究所入り口', width=384,
                  walk=[ev['walk_bounds_proposal']['foot_y_min'], ev['walk_bounds_proposal']['foot_y_max']],
                  start=[60, 182], music='stage2_ab', fx='2B', layers=[],
                  exit={'x': 360, 'to': '2C', 'mode': 'right_door'},
                  props=[dict(p, x=p['x'], fixed_to_carriage=True) for p in s2props('2B')], portals=[],
                  specials={'elevator': {
                      'floors': ev['floors'], 'doors': ev['doors_proposal'], 'sign_anchor': ev['floor_sign_anchor'],
                      'shaft_tile': ev['shaft_tile_height'], 'speed': 96, 'arrival_px': 216, 'anchor_y': 35,
                      'impact': ev['stop_impact_proposal'], 'door_ms': 380,
                      'door_spawn': [[28, 160], [356, 160]], 'drop_z': 150,
                      'fluorescent': fx2['effects']['2B']['fluorescent']['world_points']}})

# ---- 2面C ヒミツ研究所
c2 = J('MIKA_STAGE2C_LAB_v001', 'data', 'stage2c_layout.json')
props2c = s2props('2C')
props2c += [
    {'id': '2C_chest_01', 'kind': 'chest', 'x': 1356, 'y': 186, 'loot_item': 'high_potion', 'note': '[仮] ボス前の回復（既存資料のボス前ハイポーション/エリクサー案）'},
    {'id': '2C_chest_02', 'kind': 'chest', 'x': 1420, 'y': 194, 'loot_item': 'elixir', 'note': '[仮]'},
]
hatch = c2['hidden_hatches'][0]
main_map(2, 'C', name='ヒミツ研究所', walk=c2['walk_bounds_proposal'], music='stage2_c', fx='2C',
         layers=[{'bg': '2C_main', 'factor': 1}], exit=None, props=props2c,
         portals=[{'id': 'C_hidden_hatch_01', 'x': hatch['interaction_feet'][0], 'y': hatch['interaction_feet'][1], 'to': '2C_H1',
                   'trigger': 'up', 'requires_break': 'C_hatch', 'reuse': 'one_visit',
                   'return_xy': hatch['return_spawn'], 'room_xy': hatch['room_spawn']}],
         specials={'cylinders': [dict(o, enemy_id='mega_goblin', section_id=f"C{o['scene']}") for o in c2['fixed_objects']],
                   'hatch': {'id': 'C_hatch', 'x': hatch['world'][0], 'y': hatch['world'][1], 'origin': hatch['origin']},
                   'lab_fx': {'vats': [[322, 18, 121, 107], [515, 18, 122, 107], [1134, 41, 91, 76], [1310, 50, 69, 80], [1667, 52, 73, 82]],
                              'monitors': [[208, 106, 32, 20], [1227, 114, 29, 20]],
                              'lights': [[60, 19, 19, 3], [370, 21, 27, 4], [561, 21, 27, 4], [902, 30, 39, 3], [1438, 24, 37, 2], [1690, 36, 28, 2]],
                              'note': '槽・モニター・蛍光灯の矩形は背景画像から抽出した初期値'}})
room = c2['hidden_rooms'][0]
maps['2C_H1'] = dict(stage=2, key='C_H1', kind='room', name=None, width=384, walk=room['walk_bounds_proposal'],
                     start=list(hatch['room_spawn']), music=None, parent='2C', layers=[{'bg': '2C_H1', 'factor': 1}],
                     props=[{'id': 'C_H1_chest_01', 'kind': 'chest', 'x': 180, 'y': 180, 'loot_table': 2, 'note': '[仮] 中身未指定→テーブル2'},
                            {'id': 'C_H1_chest_02', 'kind': 'chest', 'x': 290, 'y': 180, 'loot_item': 'rocket_punch', 'chest_type': 'weapon',
                             'note': '[任意案] ロケットパンチ1源'}],
                     portals=[{'id': 'C_H1_return', 'x': room['exit_interaction_feet'][0], 'y': room['exit_interaction_feet'][1], 'to': '2C', 'trigger': 'up', 'reuse': 'return_to_parent'}],
                     specials={})

# ---- 3面A マヨイの森
a3 = J('MIKA_STAGE3A_FOREST_v001', 'data', 'stage3a_layout.json')
chest_tables = {}
def chests_for(mapid, tlist):
    out = []
    for t in tlist:
        if t['map'] != mapid:
            continue
        items = [('table', x) for x in t.get('tables', [])] + ([('item', t['fixed_item'])] if t.get('fixed_item') else [])
        for i, (kind, val) in enumerate(items):
            x, y = t['feet'][min(i, len(t['feet']) - 1)]
            c = {'id': f"3{mapid}_chest_s{t['scene']}_{i+1}", 'kind': 'chest', 'x': x, 'y': y}
            if kind == 'table':
                c['loot_table'] = val
            else:
                c['loot_item'] = val
            out.append(c)
    return out
for m in a3['maps']:
    mid = m['id']
    ports = []
    for r in a3['routes']:
        if r['source_map'] == mid:
            to = '3' + r['destination_map']
            p = {'id': r['id'], 'x': r['source_foot'][0], 'y': r['source_foot'][1], 'to': to, 'trigger': 'up',
                 'arrive': r['destination_foot'], 'arrive_scene': r['destination_scene'], 'requires_scene': r['source_scene'],
                 'reuse': 'one_visit' if r['destination_is_side_room'] or r['id'].startswith('H') else 'route'}
            ports.append(p)
        if r.get('bidirectional') and r['destination_map'] == mid and not r['id'].startswith('H'):
            ports.append({'id': r['id'] + '_back', 'x': r['destination_foot'][0], 'y': 168, 'to': '3' + r['source_map'], 'trigger': 'up',
                          'arrive': [r['source_foot'][0], 182], 'arrive_scene': r['source_scene'], 'requires_scene': r['destination_scene'], 'reuse': 'route'})
    looks = [dict(pp) for pp in a3['path_ports'] if pp['map'] == mid]
    if m['world_width'] == 1920:
        main_map(3, mid, name='マヨイの森', walk=m['walk_bounds'], music='stage3_ab', fx='3A',
                 layers=[{'bg': '3A_far', 'factor': 0.12}, {'bg': '3A_' + mid, 'factor': 1}],
                 exit=None, props=chests_for(mid, a3['treasure']), portals=ports,
                 specials={'path_ports': looks, 'end_rule': m['end_rule']})
    else:
        src = next(r for r in a3['routes'] if r['destination_map'] == mid)
        maps['3' + mid] = dict(stage=3, key=mid, kind='room', name=None, width=384, walk=m['walk_bounds'], start=[48, 182],
                               music=None, parent='3' + src['source_map'], layers=[{'bg': '3A_' + mid, 'factor': 1}],
                               props=chests_for(mid, a3['treasure']),
                               portals=[{'id': mid + '_return', 'x': 48, 'y': 168, 'to': '3' + src['source_map'], 'trigger': 'up', 'reuse': 'return_to_parent'}],
                               specials={'path_ports': looks})
mb = a3['miniboss']
maps['3F3']['specials']['miniboss'] = {'section_id': 'F3_5', 'type': 'goblin_mech', 'count': 2, 'hp_multiplier': mb['hp_multiplier'],
                                       'feet': mb['spawn_feet_proposal'], 'adds': None}
maps['3F3']['exit'] = {'x': 1760, 'y': 168, 'w': 60, 'to': '3B', 'mode': 'light_stairs', 'stairs_foot': [1700, 168],
                       'note': 'メカ2体撃破→光の階段（3段階1800ms）→昇って3Bへ'}

# ---- 3面B 雲の上
b3 = J('MIKA_STAGE3B_CLOUDS_v001', 'data', 'stage3b_layout.json')
pb = []
for t in b3['treasure']:
    items = [('table', x) for x in t['tables']] + ([('item', t['fixed_item'])] if t.get('fixed_item') else [])
    for i, (kind, val) in enumerate(items):
        c = {'id': f"3B_chest_s{t['scene']}_{i+1}", 'kind': 'chest', 'x': t['foot_proposals'][i][0], 'y': t['foot_proposals'][i][1]}
        c['loot_table' if kind == 'table' else 'loot_item'] = val
        pb.append(c)
for p in b3['prop_proposals']:
    pb.append({'id': '3' + p['id'], 'kind': 'state_prop', 'art': p['type'], 'x': p['foot'][0], 'y': p['foot'][1], 'origin': [24, 62],
               'footprint': [30, 8], 'hp': 1, 'score': 100, 'drop_chance': 0.2, 'loot_table': 1})
g = b3['exit']
main_map(3, 'B', name='雲の上', walk=b3['walk_bounds'], music='stage3_ab', fx='3B', start=b3['entry']['spawn_foot_proposal'],
         layers=[{'bg': '3B_far', 'factor': 0.03}, {'bg': '3B_mid', 'factor': 0.24},
                 {'rect': g['gate_backdrop']['rect'], 'color': g['gate_backdrop']['color']},
                 {'bg': '3B_main', 'factor': 1}],
         front_layers=[{'bg': '3B_wisps', 'factor': 0.45, 'drift': 6, 'opacity': 0.16, 'clip': [203, 216], 'loop': True}],
         exit={'x': g['gate_foot_proposal'][0], 'y': g['gate_foot_proposal'][1], 'w': g['trigger_proposal']['distance_x'], 'to': '3C', 'mode': 'up'},
         props=pb)

# ---- 3面C 妖精の城
c3 = J('MIKA_STAGE3C_CASTLE_v001', 'data', 'stage3c_layout.json')
pc = []
for o in c3['objects']:
    if o['type'] == 'flower_urn':
        pc.append({'id': '3' + o['id'], 'kind': 'state_prop', 'art': 'flower_urn', 'x': o['foot'][0], 'y': o['foot'][1], 'origin': [24, 62],
                   'footprint': [30, 8], 'hp': 1, 'score': 100, 'drop_chance': 0.2, 'loot_table': 1})
    else:
        org = {'candelabrum': [32, 94], 'throne': [72, 138], 'sky_station_sign': [32, 94]}[o['type']]
        pc.append({'id': '3' + o['id'], 'kind': 'deco', 'art': o['type'], 'x': o['foot'][0], 'y': o['foot'][1], 'origin': org, 'never_mirror': True})
hr = c3['hidden_rooms'][0]
pc.append({'id': '3C_balcony_sign', 'kind': 'deco', 'art': 'balcony_arrow_up', 'x': hr['sign']['foot_proposal'][0], 'y': hr['sign']['foot_proposal'][1], 'origin': hr['sign']['origin'], 'behind': True})
main_map(3, 'C', name='妖精の城', walk=c3['walk_bounds'], music='stage3_c', fx='3C', start=c3['entry']['spawn_foot_proposal'],
         layers=[{'bg': '3C_window', 'factor': 0.06}, {'bg': '3C_main', 'factor': 1}, {'bg': '3C_rays', 'factor': 1, 'opacity': 0.1, 'clip': [32, 156], 'pulse': 0.02}],
         front_layers=[{'bg': '3C_fore', 'factor': 1, 'opacity': 0.5, 'edges': 16, 'clip': [0, 155]}],
         exit=None, props=pc,
         portals=[{'id': 'C_balcony', 'x': hr['entrance_foot_proposal'][0], 'y': hr['entrance_foot_proposal'][1], 'to': '3C_H1', 'trigger': 'up',
                   'reuse': 'one_visit', 'room_xy': hr['room_spawn_foot_proposal'], 'half': hr['activation_half_extents_proposal']}],
         specials={'queen': {'throne': c3['boss']['throne_anchor_proposal'], 'seated': c3['boss']['seated_sprite_anchor_proposal']}})
maps['3C_H1'] = dict(stage=3, key='C_H1', kind='room', name=None, width=384, walk=hr['room_walk_bounds_proposal'], start=hr['room_spawn_foot_proposal'],
                     music=None, parent='3C', layers=[{'bg': '3C_H1', 'factor': 1}],
                     props=[{'id': 'C_H1_chest_01', 'kind': 'chest', 'x': 200, 'y': 184, 'loot_item': 'wave_cannon', 'chest_type': 'weapon', 'note': '[任意] 波動砲1源'},
                            {'id': 'C_H1_chest_02', 'kind': 'chest', 'x': 290, 'y': 190, 'loot_table': 2, 'note': '[仮] 中身未指定→テーブル2'}],
                     portals=[{'id': 'C_H1_return', 'x': hr['return_foot_proposal'][0], 'y': hr['return_foot_proposal'][1], 'to': '3C', 'trigger': 'up', 'reuse': 'return_to_parent'}],
                     specials={})

stages = {
    1: {'name': 'ナンザスシティ', 'first': '1A', 'order': ['1A', '1B', '1C']},
    2: {'name': 'モアイ荒野', 'first': '2A', 'order': ['2A', '2B', '2C']},
    3: {'name': '妖精の国', 'first': '3F1', 'order': ['3F1', '3F2', '3F3', '3B', '3C']},
}
save('stage_maps.json', {'version': 1, 'source': 'MIKA_STAGE123_IMPLEMENTATION_20261007 modules + stage1_map.json', 'stages': stages, 'maps': maps})

# ================================================================ 敵配置
LANES = ['middle', 'upper', 'lower']
def W(sec, groups):
    """groups: [(spawn_when_alive_le, [(enemy, side, extra)...]), ...]"""
    rows, order = [], 1
    for gi, (le, ens) in enumerate(groups):
        for k, e in enumerate(ens):
            enemy, side = e[0], e[1]
            ex = e[2] if len(e) > 2 else {}
            r = {'section_id': sec, 'order': order, 'group': gi + 1, 'spawn_when_alive_le': le, 'enemy_id': enemy,
                 'weapon_id': ex.get('weapon', 'none'), 'drop_weapon': bool(ex.get('drop')), 'quantity': 1, 'spawn_side': side,
                 'lane': LANES[(order + gi) % 3], 'appearance': ex.get('appearance', 'standard'), 'source': '2026-10-07 指針から配置案', 'status': '[仮]'}
            if ex.get('source'):
                r['weapon_source'] = ex['source']
            rows.append(r)
            order += 1
    return rows
def sections_for(mapk, prefix, screens=5, travel_after=range(1, 5), first_kind=None):
    out = []
    for n in range(1, screens + 1):
        out.append({'section_id': f'{prefix}{n}', 'map': mapk, 'kind': 'combat', 'screen': n, 'wave_start': 'on_section_enter'})
        if n in travel_after:
            out.append({'section_id': f'{prefix}{n}_travel', 'map': mapk, 'kind': 'travel', 'screen': n, 'wave_start': 'on_travel_enter'})
    return out
DEF = {'wave_total': 5, 'wave_max_alive': 4, 'fixed_excluded_from_cap': True, 'soft_total_cap_with_fixed': 6, 'fixed_additional_to_wave': True}

# ---------------------------------------------------------------- 1面（既存正本を指針で改訂）
p1 = json.load(open(os.path.join(DATA, 'stage1_enemy_placement.json'), encoding='utf-8'))
old_sections = {s['section_id']: s for s in p1['sections']}
for s in p1['sections']:
    s['map'] = '1' + s['map'] if len(s['map']) == 1 else s['map']
    sid = s['section_id']
    s['screen'] = int(sid[1])
waves1 = []
R, L = 'right', 'left'
spec1 = {
    'A1': [(4, [('goblin', R)] * 3), (1, [('goblin', L)] * 2)],
    'A1_travel': [(4, [('goblin', R)] * 2), (1, [('goblin', L)])],
    'A2': [(4, [('goblin', R)] * 3), (2, [('goblin', L), ('goblin', R)])],
    'A2_travel': [(4, [('goblin', R)] * 2), (1, [('deathhound', R)])],
    'A3': [(4, [('goblin', R, {'weapon': 'machinegun', 'drop': True}), ('goblin', R), ('goblin', R)]), (1, [('goblin', L)] * 2)],
    'A3_travel': [(4, [('goblin', R)] * 2 + [('goblin', L)])],
    'A4': [(4, [('goblin', R)] * 3), (2, [('deathhound', R)]), (1, [('goblin', L)])],
    'A4_travel': [(4, [('goblin', R)] * 2), (1, [('deathhound', L)])],
    'A5': [(4, [('goblin', R)] * 3), (1, [('goblin', L)] * 2)],
    'B1': [(4, [('goblin', R)] * 3), (1, [('goblin', L)] * 2)],
    'B1_travel': [(4, [('goblin', R)] * 2 + [('goblin', L)])],
    'B2': [(4, [('goblin', R, {'weapon': 'katana', 'drop': True, 'appearance': 'helmet'}), ('goblin', R), ('goblin', R)]), (1, [('goblin', L)] * 2)],
    'B2_travel': [(4, [('goblin', L)] * 2), (1, [('goblin', R)])],
    'B3': [(4, [('goblin', R)] * 3), (2, [('goblin', R)] * 2)],
    'B3_travel': [(4, [('goblin', R)] * 3)],
    'B4': [(4, [('hobgoblin', R)] + [('goblin', R)] * 3), (1, [('hobgoblin', L)])],
    'B4_travel': [(4, [('goblin', R)] * 2 + [('goblin', L)])],
    'B5': [(4, [('goblin', R)] * 3), (1, [('goblin', L)] * 2)],
    'C1': [(4, [('hobgoblin', R)] * 3), (1, [('ogre', R)])],
    'C1_travel': [(4, [('hobgoblin', R)] * 2), (1, [('deathhound', R)])],
    'C2': [(4, [('ogre', R), ('goblin', R), ('goblin', R)]), (1, [('hobgoblin', L)] * 2)],
    'C2_travel': [(4, [('goblin', R)] * 2), (1, [('deathhound', L)])],
    'C3': [(4, [('goblin', R, {'weapon': 'rocket_launcher', 'drop': True}), ('hobgoblin', R), ('hobgoblin', R)]), (1, [('ogre', R), ('hobgoblin', L)])],
    'C3_travel': [(4, [('hobgoblin', R)] * 2), (1, [('deathhound', R)])],
    'C4': [(4, [('hobgoblin', R)] * 3), (1, [('gigas', R), ('goblin', L)])],
    'C4_travel': [(4, [('goblin', R)] * 3)],
}
for sid, groups in spec1.items():
    waves1 += W(sid, groups)
for f in p1['fixed_enemies']:
    if f['fixed_id'] == 'A5_fixed_04':
        f['drop_weapon'] = True        # 刀は5画面目の指定ゴブリンから1源
    if f['fixed_id'] == 'B4_fixed_02':
        f['drop_weapon'] = True        # 弓は1体だけ・任意報酬
p1['waves'] = waves1
p1['version'] = int(p1['version']) + 1
p1['stage'] = 1
p1['defaults'] = dict(DEF)
p1['boss'] = {'section': 'C5', 'type': 'goblin_mech', 'enemy_id': 'goblin_robot', 'hp': 120, 'adds_enemy_id': 'goblin', 'adds_max_alive': 3,
              'adds_total': None, 'adds_replenish': True, 'adds_interval_ms': 2000, 'stop_replenish_on_boss_death': True}
p1['weapon_sources'] = [
    {'id': 'W1_smg', 'weapon': 'machinegun', 'how': 'A3 通常波のSMGゴブリン（PPT確定・既存源を数える）', 'main_route': True},
    {'id': 'W1_katana', 'weapon': 'katana', 'how': 'A5 固定の刀ゴブリン（宝箱囲み）', 'main_route': True},
    {'id': 'W1_katana_b2', 'weapon': 'katana', 'how': 'B2 兜の刀ゴブリン（PPT確定）', 'main_route': True},
    {'id': 'W1_bow', 'weapon': 'yoichi_bow', 'how': 'B4 弓隊の1体だけ（任意報酬）', 'main_route': False},
    {'id': 'W1_launcher', 'weapon': 'rocket_launcher', 'how': 'C3 ランチャーゴブリン（中盤）', 'main_route': True},
]
p1['change_log'] = ['2026-10-07: 1面のスケルトンを撤去（初登場は2面）。同種の群れ中心に組み直し、移動区間は3体の息抜き。',
                    '紫ゴブリンはB4から、オーガはC面の大半に1体、犬はオーガのいない波、ギガースはC4に1体。',
                    'A5刀ゴブリン・B4弓ゴブリン1体にdrop_weapon=true。']
save('stage1_enemy_placement.json', p1)

# ---------------------------------------------------------------- 2面
secs2 = sections_for('2A', 'A')
for s in secs2:
    s['map'] = '2A'
el_secs = []
floors = ['1F', 'B1', 'B2', 'B3', 'B4']
for i, fl in enumerate(floors):
    el_secs.append({'section_id': f'E{fl}', 'map': '2B', 'kind': 'elevator_stop', 'floor': i, 'wave_start': 'on_section_enter'})
    if i < 4:
        el_secs.append({'section_id': f'E{fl}_down', 'map': '2B', 'kind': 'elevator_travel', 'floor': i, 'wave_start': 'on_travel_enter'})
secs2c = sections_for('2C', 'C')
for s in secs2c:
    s['map'] = '2C'
secs2c[-1].update({'kind': 'boss', 'wave_start': 'boss_special'})
waves2 = []
spec2 = {
    'A1': [(4, [('skeleton', R)] * 2), (1, [('hobgoblin', R)] * 2 + [('hobgoblin', L)])],
    'A1_travel': [(4, [('deathhound', R)] * 2), (0, [('hobgoblin', L)])],
    'A2': [(4, [('skeleton', R)] * 3), (1, [('hobgoblin', L)] * 2)],
    'A2_travel': [(4, [('hobgoblin', R)] * 3)],
    'A3': [(4, [('hobgoblin', R, {'weapon': 'war_axe', 'drop': True}), ('hobgoblin', R), ('hobgoblin', R)]), (1, [('skeleton', L)] * 2)],
    'A3_travel': [(4, [('deathhound', R)] * 2)],
    'A4': [(4, [('death_goblin', R)] * 3), (1, [('ograst', R), ('skeleton', L)])],
    'A4_travel': [(4, [('skeleton', R)] * 2), (1, [('hobgoblin', L)])],
    'A5': [(4, [('death_goblin', R)] * 2 + [('hobgoblin', R)]), (1, [('gigas', R), ('skeleton', L)])],
    # エレベーター: 停車中は左右のドア、降下中は上から
    'E1F': [(4, [('skeleton', L), ('skeleton', R)]), (1, [('hobgoblin', R), ('hobgoblin', L), ('hobgoblin', R)])],
    'E1F_down': [(4, [('hobgoblin', 'top')] * 2)],
    'EB1': [(4, [('mega_goblin', R)] * 2), (0, [('hobgoblin', L)])],
    'EB1_down': [(4, [('mega_goblin', 'top')] * 2)],
    'EB2': [(4, [('mega_goblin', R, {'weapon': 'flamethrower', 'drop': True}), ('mega_goblin', L), ('mega_goblin', L)])],
    'EB2_down': [(4, [('mega_goblin', 'top')] * 2)],
    'EB3': [(4, [('megamega', R)]), (1, [('mega_goblin', L)] * 2)],
    'EB3_down': [(4, [('mega_goblin', 'top')] * 2)],
    'EB4': [(4, [('mega_goblin', L)] * 3 + [('mega_goblin', R, {'weapon': 'machinegun', 'drop': True})]), (1, [('megamega', R)])],
    'C1': [(4, [('mega_goblin', R)] * 3), (1, [('mega_goblin', L)] * 2)],
    'C1_travel': [(4, [('mega_goblin', R)] * 2)],
    'C2': [(4, [('megamega', R)]), (1, [('mega_goblin', R)] * 2)],
    'C2_travel': [(4, [('mega_goblin', R), ('mega_goblin', L)])],
    'C3': [(4, [('mega_goblin', R, {'weapon': 'rocket_launcher', 'drop': True}), ('mega_goblin', R), ('mega_goblin', R)]), (1, [('mega_goblin', L)] * 2)],
    'C3_travel': [(4, [('megamega', R)]), (0, [('mega_goblin', R)])],
    'C4': [(4, [('mega_goblin', R)] * 3), (1, [('megamega', R)])],
    'C4_travel': [(4, [('mega_goblin', R)] * 2)],
}
for sid, groups in spec2.items():
    waves2 += W(sid, groups)
fixed2 = [{'fixed_id': f"C{o['scene']}_cylinder", 'section_id': f"C{o['scene']}", 'enemy_id': 'mega_goblin', 'weapon_id': 'none',
           'anchor_id': o['id'], 'formation': 'cylinder', 'slot': 1, 'x': o['world'][0], 'y': o['world'][1], 'spawn_trigger': 'cylinder_break',
           'drop_weapon': False, 'counts_toward_wave_total': False, 'counts_toward_wave_cap': False, 'source': '2C 脱出槽（固定1体）'}
          for o in c2['fixed_objects']]
p2 = {'version': 1, 'stage': 2, 'purpose': '2面の配置（2026-10-07 指針から初期案）', 'defaults': dict(DEF),
      'sections': secs2 + el_secs + secs2c, 'waves': waves2, 'fixed_enemies': fixed2,
      'elevator': {'stop_slots': 3, 'travel_slots': 2, 'b4_stop_slots': 5, 'speed_px_s': 96, 'arrival_px': 216,
                   'leftover_on_arrival': '降下中の敵が残っていたら到着を待たせる（全滅で到着要求）'},
      'boss': {'section': 'C5', 'type': 'dark_mika', 'hp': 140, 'phase2_ratio': 0.5, 'adds_enemy_id': 'mega_goblin', 'adds_max_alive': 2,
               'adds_total': 6, 'adds_replenish': True, 'adds_interval_ms': 3000, 'katana_drop_once': True},
      'weapon_sources': [
          {'id': 'W2_axe', 'weapon': 'war_axe', 'how': '2A3 斧のホブゴブリン（盾のスケルトンを経験した後）', 'main_route': True},
          {'id': 'W2_flame', 'weapon': 'flamethrower', 'how': '2B B2 火炎放射のメガゴブリン', 'main_route': True},
          {'id': 'W2_smg', 'weapon': 'machinegun', 'how': '2B B4 SMGメガゴブリン（射撃1体）', 'main_route': True},
          {'id': 'W2_launcher', 'weapon': 'rocket_launcher', 'how': '2C3 ランチャーのメガゴブリン', 'main_route': True},
          {'id': 'W2_boss_katana', 'weapon': 'katana', 'how': 'ダークミカを吹っ飛ばすと一度だけ刀を落とす', 'main_route': True},
          {'id': 'W2_rocket_punch', 'weapon': 'rocket_punch', 'how': '2C隠し部屋の武器宝箱（任意）', 'main_route': False},
      ]}
save('stage2_enemy_placement.json', p2)

# ---------------------------------------------------------------- 3面
secs3 = []
for f in ('F1', 'F2', 'F3'):
    ss = sections_for('3' + f, f + '_')
    if f == 'F3':
        ss[-1].update({'kind': 'boss', 'wave_start': 'boss_special'})
    secs3 += ss
sb = sections_for('3B', 'B')
sc = sections_for('3C', 'C')
sc[-1].update({'kind': 'boss', 'wave_start': 'boss_special'})
secs3 += sb + sc
spec3 = {
    'F1_1': [(4, [('hobgoblin', R)] * 3), (1, [('hobgoblin', L)] * 2)],
    'F1_1_travel': [(4, [('hobgoblin', R)] * 2), (1, [('skeleton', R)])],
    'F1_2': [(4, [('hobgoblin', R, {'weapon': 'yoichi_bow', 'drop': True, 'source': 'W3_bow'}), ('hobgoblin', R), ('hobgoblin', R)]), (1, [('deathhound', L)] * 2)],
    'F1_2_travel': [(4, [('hobgoblin', R)] * 3)],
    'F1_3': [(4, [('hobgoblin', R)] * 3), (1, [('skeleton', L)] * 2)],
    'F1_3_travel': [(4, [('hobgoblin', R)] * 2), (1, [('deathhound', R)])],
    'F1_4': [(4, [('hobgoblin', R)] * 3), (1, [('hill_gigas', R), ('hobgoblin', L)])],
    'F1_4_travel': [(4, [('hobgoblin', R)] * 3)],
    'F1_5': [(4, [('hobgoblin', R)] * 3), (1, [('ograst', R)])],
    'F2_1': [(4, [('death_goblin', R)] * 3), (1, [('death_goblin', L)] * 2)],
    'F2_1_travel': [(4, [('death_goblin', R)] * 2), (1, [('deathhound', R)])],
    'F2_2': [(4, [('death_goblin', R)] * 3), (1, [('skeleton', L)] * 2)],
    'F2_2_travel': [(4, [('death_goblin', R)] * 3)],
    'F2_3': [(4, [('death_goblin', R)] * 3), (1, [('hobgoblin', L)] * 2)],
    'F2_3_travel': [(4, [('death_goblin', R)] * 2), (1, [('deathhound', L)])],
    'F2_4': [(4, [('death_goblin', R, {'weapon': 'battle_hammer', 'drop': True, 'source': 'W3_hammer'}), ('death_goblin', R), ('death_goblin', R)]), (1, [('ograst', R), ('death_goblin', L)])],
    'F2_4_travel': [(4, [('death_goblin', R)] * 3)],
    'F2_5': [(4, [('death_goblin', R)] * 3), (1, [('big_ogre', R)])],
    'F3_1': [(4, [('death_goblin', R)] * 3), (1, [('death_goblin', L)] * 2)],
    'F3_1_travel': [(4, [('death_goblin', R)] * 2), (1, [('skeleton', R)])],
    'F3_2': [(4, [('death_goblin', R)] * 3), (1, [('big_ogre', R), ('death_goblin', L)])],
    'F3_2_travel': [(4, [('death_goblin', R)] * 3)],
    'F3_3': [(4, [('death_goblin', R)] * 3), (1, [('ograst', R), ('skeleton', L)])],
    'F3_3_travel': [(4, [('death_goblin', R)] * 2)],
    'F3_4': [(4, [('death_goblin', R)] * 3), (1, [('yor_gigas', R)])],
    'F3_4_travel': [(4, [('death_goblin', R)] * 3)],
    'B1': [(4, [('death_goblin', R)] * 3), (1, [('death_goblin', L)] * 2)],
    'B1_travel': [(4, [('death_goblin', R)] * 2), (1, [('hobgoblin', L)])],
    'B2': [(4, [('death_goblin', R, {'weapon': 'gungnir', 'drop': True}), ('death_goblin', R, {'weapon': 'gungnir'}), ('death_goblin', R, {'weapon': 'gungnir'})]), (1, [('hobgoblin', L)] * 2)],
    'B2_travel': [(4, [('death_goblin', R)] * 3)],
    'B3': [(4, [('death_goblin', R)] * 3), (1, [('skeleton', L)] * 2)],
    'B3_travel': [(4, [('death_goblin', R)] * 2)],
    'B4': [(4, [('death_goblin', R, {'weapon': 'flamethrower', 'drop': True}), ('death_goblin', R), ('death_goblin', R)]), (1, [('hobgoblin', L)] * 2)],
    'B4_travel': [(4, [('death_goblin', R)] * 3)],
    'B5': [(4, [('death_goblin', R)] * 3), (1, [('hill_gigas', R)])],
    'C1': [(4, [('hobgoblin', R)] * 3), (1, [('goblin', L)] * 2)],
    'C1_travel': [(4, [('hobgoblin', R)] * 2), (1, [('goblin', L)])],
    'C2': [(4, [('death_goblin', R, {'weapon': 'katana', 'drop': True}), ('death_goblin', R), ('death_goblin', R)]), (1, [('skeleton', L)] * 2)],
    'C2_travel': [(4, [('hobgoblin', R)] * 3)],
    'C3': [(4, [('hobgoblin', R)] * 3), (1, [('ograst', R), ('goblin', L)])],
    'C3_travel': [(4, [('death_goblin', R)] * 2), (1, [('skeleton', R)])],
    'C4': [(4, [('hobgoblin', R, {'weapon': 'rocket_launcher', 'drop': True}), ('hobgoblin', R), ('hobgoblin', R)]), (1, [('big_ogre', R), ('death_goblin', L)])],
    'C4_travel': [(4, [('death_goblin', R)] * 3)],
}
waves3 = []
for sid, groups in spec3.items():
    for r in W(sid, groups):
        waves3.append(r)
for r in waves3:
    sid = r['section_id']
    r['map'] = '3' + sid.split('_')[0] if sid.startswith('F') else ('3' + sid[0])
p3 = {'version': 1, 'stage': 3, 'purpose': '3面の配置（2026-10-07 指針から初期案）', 'defaults': dict(DEF),
      'sections': secs3, 'waves': waves3, 'fixed_enemies': [],
      'miniboss': {'section': 'F3_5', 'type': 'goblin_mech', 'count': 2, 'hp_ratio_of_stage1_boss': 0.5, 'adds': None},
      'boss': {'section': 'C5', 'type': 'goblin_queen', 'hp': 180, 'phase2_ratio': 0.5,
               'adds': ['hobgoblin', 'hobgoblin', 'death_goblin', 'hobgoblin', 'hobgoblin', 'death_goblin'],
               'adds_max_alive': 2, 'adds_total': 6, 'adds_replenish': True, 'adds_interval_ms': 3000,
               'adds_hold_during_lightning': True},
      'weapon_sources': [
          {'id': 'W3_bow', 'weapon': 'yoichi_bow', 'how': '森の前半（最初に入ったF1_2/F1_3/F2_1/F2_2/F3_1のどれか）の弓の紫ゴブリン', 'main_route': True,
           'fallback_sections': ['F1_2', 'F1_3', 'F2_1', 'F2_2', 'F3_1']},
          {'id': 'W3_hammer', 'weapon': 'battle_hammer', 'how': '森の中盤〜後半（F2_4/F3_2/F3_3/F2_5のどれか）', 'main_route': True,
           'fallback_sections': ['F2_4', 'F3_2', 'F3_3', 'F2_5', 'F3_4']},
          {'id': 'W3_chest5', 'weapon': 'random', 'how': 'F2の3画面目 宝箱テーブル5（既存の武器テーブル。武器源に数える）', 'main_route': False},
          {'id': 'W3_gungnir', 'weapon': 'gungnir', 'how': '3B2 槍の赤ゴブリン3体の1体（トランプ兵の代役）', 'main_route': True},
          {'id': 'W3_flame', 'weapon': 'flamethrower', 'how': '3B4 火炎放射の赤ゴブリン', 'main_route': True},
          {'id': 'W3_katana', 'weapon': 'katana', 'how': '3C2 刀の赤ゴブリン', 'main_route': True},
          {'id': 'W3_launcher', 'weapon': 'rocket_launcher', 'how': '3C4 ランチャーの紫ゴブリン', 'main_route': True},
          {'id': 'W3_wave', 'weapon': 'wave_cannon', 'how': '3C隠しバルコニーの武器宝箱（任意・1発）', 'main_route': False},
      ]}
save('stage3_enemy_placement.json', p3)
print('maps', len(maps), 'waves', len(waves1), len(waves2), len(waves3))
