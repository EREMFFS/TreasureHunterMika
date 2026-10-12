#!/usr/bin/env python3
"""2026-10-11 MIKA_5I_6B_SEAMLESS_v053: 5I展望台・6Bの背景を、つなぎ目のない1920幅の1枚に差し替える（6Bは左端のエレベーターだけ閉じている）。
使い方: python3 tools/prep_v053.py <MIKA_5I_6B_SEAMLESS_v053 フォルダ> <ゲームフォルダ>
  assets/bg_5I_main.webp / assets/bg_6B_main.webp  1920×216（等倍。画面2のx591に隠し部屋5I_H1の扉が描いてある）
"""
import os, sys
from PIL import Image
PACK, GAME = sys.argv[1], sys.argv[2]
for src, dst in [('bg_5I_main_v053.png', 'bg_5I_main.webp'), ('bg_6B_main_v053.png', 'bg_6B_main.webp')]:
    im = Image.open(os.path.join(PACK, 'assets', src)).convert('RGB')
    assert im.size == (1920, 216), im.size
    im.save(os.path.join(GAME, 'assets', dst), 'WEBP', lossless=True, method=6)
    print(dst, im.size)
