#!/usr/bin/env python3
"""配置データの変換ツール。

正本（機械用）は data/stageN_enemy_placement.json（N=1〜3）と data/stage_maps.json。

  python3 tools/build_data.py
      正本JSONから、ゲームが読む data/placements.js・data/reference.js と
      交換用CSV（data/csv/stageN_*.csv）を書き出す。
  python3 tools/build_data.py from-csv [N]
      data/csv/stageN_*.csv（省略時は1面）を直したあと、その内容を正本JSONへ取り込み、
      version を1つ上げてから .js と CSV を作り直す。

どちらのモードでも最後に正本JSONから .js と CSV を作り直すので、
CSV と JSON が別々の正本になることはない。
空欄は「未定」として null のまま保持し、0 へ変換しない。
CSV の True/False は真偽値へ、None/空欄は null へ変換する。
"""
import csv, json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'data')
CSV_DIR = os.path.join(DATA, 'csv')
JSON_PATH = os.path.join(DATA, 'stage1_enemy_placement.json')

TABLES = [  # (CSVファイル名, JSONのキー, 列)
    ('stage1_sections.csv', 'sections', ['section_id', 'map', 'kind', 'screen', 'floor', 'wave_total', 'wave_max_alive',
     'fixed_excluded_from_cap', 'wave_start', 'clear_condition', 'status']),
    ('stage1_waves.csv', 'waves', ['section_id', 'order', 'group', 'spawn_when_alive_le', 'enemy_id', 'weapon_id', 'quantity', 'spawn_side',
     'lane', 'drop_weapon', 'weapon_source', 'appearance', 'source', 'status']),
    ('stage1_fixed_enemies.csv', 'fixed_enemies', ['fixed_id', 'section_id', 'enemy_id', 'weapon_id',
     'anchor_id', 'formation', 'slot', 'x', 'y', 'spawn_trigger', 'activation', 'drop_weapon',
     'counts_toward_wave_total', 'counts_toward_wave_cap', 'source', 'position_status']),
]


def conv(s):
    if s is None:
        return None
    s = str(s).strip()
    if s in ('', 'None', 'null'):
        return None
    if s in ('True', 'TRUE', 'true'):
        return True
    if s in ('False', 'FALSE', 'false'):
        return False
    try:
        return int(s)
    except ValueError:
        try:
            return float(s)
        except ValueError:
            return s


def read_csv(path):
    with open(path, encoding='utf-8-sig') as f:
        rows = list(csv.reader(f))
    head = rows[0]
    return [{h: conv(r[i] if i < len(r) else None) for i, h in enumerate(head)}
            for r in rows[1:] if any(c.strip() for c in r)]


def load():
    with open(JSON_PATH, encoding='utf-8') as f:
        return json.load(f)


def write_all(data, save_json=False):
    if save_json:
        with open(JSON_PATH, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    os.makedirs(CSV_DIR, exist_ok=True)
    for fn, key, cols in TABLES:
        with open(os.path.join(CSV_DIR, fn), 'w', encoding='utf-8-sig', newline='') as f:
            w = csv.writer(f)
            w.writerow(cols)
            for r in data[key]:
                w.writerow(['' if r.get(c) is None else r.get(c) for c in cols])

    # 採用済み設定（v116 からのコピー）とモンスター／武器一覧をまとめる
    ref = {}
    for key, fn in (('map', 'stage1_map.json'), ('time', 'time_rules.json'), ('chests', 'chests.json'),
                    ('treasure', 'treasure_items.json'), ('weapons', 'weapon_balance.json'),
                    ('boss', 'goblin_robot_boss.json'), ('flow', 'game_flow.json'),
                    ('title', 'title_screen.json'), ('regions', 'world_map_regions.json'),
                    ('loot', 'loot_asset_lookup.json'), ('faces', 'enemy_faces.json'), ('sparks', 'hit_sparks.json'),
                    ('pickupIcons', 'weapon_pickup_icons.json'), ('palettes', 'enemy_palettes.json'), ('helmet', 'goblin_helmet.json'),
                    ('mapNames', 'map_names.json'), ('throwWeights', 'throw_weights.json'), ('uiManifest', 'ui_manifest.json'),
                    ('bgfx1', 'stage1_background_fx.json'), ('bossIntro', 'boss_intro.json'),
                    ('stageMaps', 'stage_maps.json'), ('queenRules', 'goblin_queen_rules.json'), ('queenEnding', 'queen_ending.json'),
                    ('queenIntro', 'queen_boss_intro.json'), ('balance', 'balance_proposal.json'), ('darkMika', 'dark_mika_spec.json'),
                    ('mechRules', 'mech_enemy_rules.json'), ('bgfx2', 'stage2_background_fx.json')):
        with open(os.path.join(DATA, fn), encoding='utf-8') as f:
            ref[key] = json.load(f)
    ref['monsters'] = {m['enemy_id']: m for m in read_csv(os.path.join(DATA, 'monster_catalog.csv'))}
    # 3面ボスの登場（queen_boss_intro.json）を共通のボス登場表へ加える
    if not any(b['id'] == 'goblin_queen' for b in ref['bossIntro']['bosses']):
        ref['bossIntro']['bosses'].append(ref['queenIntro'])
    # 4面ボス ダンダルモンの登場（dandalmon_intro.json）
    with open(os.path.join(DATA, 'dandalmon_intro.json'), encoding='utf-8') as f:
        ref['dandIntro'] = json.load(f)
    if not any(b['id'] == 'dandalmon' for b in ref['bossIntro']['bosses']):
        ref['bossIntro']['bosses'].append(ref['dandIntro'])
    # 全ステージの敵配置（stageN_enemy_placement.json）
    ref_pl = {}
    for n in (1, 2, 3, 4, 5, 6):
        fp = os.path.join(DATA, f'stage{n}_enemy_placement.json')
        if os.path.exists(fp):
            with open(fp, encoding='utf-8') as f:
                ref_pl[n] = json.load(f)
    with open(os.path.join(DATA, 'placements.js'), 'w', encoding='utf-8') as f:
        f.write('// 自動生成: tools/build_data.py  正本は data/stageN_enemy_placement.json（手で編集しない）\n')
        f.write('window.MIKA = window.MIKA || {};\nMIKA.PLACEMENTS = ')
        json.dump(ref_pl, f, ensure_ascii=False, separators=(',', ':'))
        f.write(';\n')
    for n, pl in ref_pl.items():
        if n == 1:
            continue
        for fn, key, cols in TABLES:
            cols2 = cols
            with open(os.path.join(CSV_DIR, fn.replace('stage1', f'stage{n}')), 'w', encoding='utf-8-sig', newline='') as f:
                w = csv.writer(f)
                w.writerow(cols2)
                for r in pl.get(key, []):
                    w.writerow(['' if r.get(c) is None else r.get(c) for c in cols2])
    ref['weaponCatalog'] = {w['weapon_id']: w for w in read_csv(os.path.join(DATA, 'weapon_catalog.csv'))}
    with open(os.path.join(DATA, 'reference.js'), 'w', encoding='utf-8') as f:
        f.write('// 自動生成: tools/build_data.py  元は data/*.json と data/*_catalog.csv\n')
        f.write('window.MIKA = window.MIKA || {};\nMIKA.REF = ')
        json.dump(ref, f, ensure_ascii=False, separators=(',', ':'))
        f.write(';\n')
    print(f"placement v{data['version']}: sections={len(data['sections'])} waves={len(data['waves'])} "
          f"fixed={len(data['fixed_enemies'])}  monsters={len(ref['monsters'])}")


if __name__ == '__main__':
    data = load()
    if len(sys.argv) > 1 and sys.argv[1] == 'from-csv':
        n = int(sys.argv[2]) if len(sys.argv) > 2 else 1
        jp = os.path.join(DATA, f'stage{n}_enemy_placement.json')
        with open(jp, encoding='utf-8') as f:
            d = json.load(f)
        for fn, key, _ in TABLES:
            d[key] = read_csv(os.path.join(CSV_DIR, fn.replace('stage1', f'stage{n}')))
        d['version'] = int(d.get('version', 0)) + 1
        with open(jp, 'w', encoding='utf-8') as f:
            json.dump(d, f, ensure_ascii=False, indent=1)
        write_all(load())
    else:
        write_all(data)
