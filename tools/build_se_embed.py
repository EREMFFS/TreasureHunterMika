#!/usr/bin/env python3
"""短い効果音を data/se_embed.js に埋め込む（2026-10-11）。

ファイルを直接開いた時（file://）は、効果音を <audio> 要素で鳴らすしかなく、Windows の Chrome/Edge では
鳴り始めまで約0.1秒かかるため、マシンガン（0.08秒）のような短い音は鳴る前に終わって無音になる。
短い音だけを base64 で JS に入れておけば、file:// でも Web Audio（遅れなし）で鳴らせる。
使い方: python3 tools/build_se_embed.py .   （data/audio.js の se を見て、MAX_SEC 未満の wav を入れる。音を差し替えたら再実行）
"""
import base64, json, os, re, subprocess, sys, wave
G = sys.argv[1] if len(sys.argv) > 1 else '.'
MAX_SEC = 1.2
ALWAYS = {'elev_move', 'siren', 'eye_laser', 'tsugira_spin', 'ufo_warp'}   # 2026-10-11 ループ音: <audio> のループは継ぎ目で途切れるので、長さに関係なく入れて Web Audio で隙間なくループさせる
js = subprocess.run(['node', '-e', "global.window=global;eval(require('fs').readFileSync(process.argv[1],'utf8'));console.log(JSON.stringify(MIKA.AUDIO.se))", os.path.join(G, 'data', 'audio.js')], capture_output=True, text=True, check=True).stdout
se = json.loads(js)
out, total = {}, 0
for k, f in se.items():
    p = os.path.join(G, f) if f else None
    if not p or not p.endswith('.wav') or not os.path.exists(p): continue
    w = wave.open(p); d = w.getnframes() / w.getframerate(); w.close()
    if d >= MAX_SEC and k not in ALWAYS: continue
    b = open(p, 'rb').read(); total += len(b)
    out[k] = {'file': f, 'b64': base64.b64encode(b).decode('ascii')}
with open(os.path.join(G, 'data', 'se_embed.js'), 'w', encoding='utf-8') as fo:
    fo.write('// 自動生成: tools/build_se_embed.py  短い効果音（file:// でも遅れなく鳴らすため）。元の音を差し替えたら作り直す\n')
    fo.write('MIKA.SE_EMBED = ' + json.dumps(out, separators=(',', ':')) + ';\n')
print(len(out), 'sounds', total // 1024, 'KB ->', sorted(out))
