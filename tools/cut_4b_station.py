#!/usr/bin/env python3
"""4B到着演出用: 駅の一枚絵（bg_4B_station.webp・空と雲を含む不透明）から、上端につながる空と雲を透明にした版を作る（2026-10-11 v039 D1 の仮対応）。
画像側で空・雲・街・ホームが分離された素材が届いたら、そちらに置き換える。
出力: assets/bg_4B_station_cut.webp（左端120pxは透明→不透明のぼかし）
"""
import os, sys
import numpy as np
from PIL import Image
from scipy import ndimage
G = sys.argv[1] if len(sys.argv) > 1 else '.'
im = np.array(Image.open(os.path.join(G, 'assets', 'bg_4B_station.webp')).convert('RGB')).astype(int)
r, g, b = im[..., 0], im[..., 1], im[..., 2]
sky = (b > 140) & (b > r + 30) & (b >= g)                          # 青い空
cloud = ((r > 185) & (g > 195) & (b > 205) & (b >= r - 4)) | ((r > 150) & (g > 165) & (b > 190) & (b >= r + 8))   # 白い雲＋影の薄い青
cand = sky | cloud
lab, n = ndimage.label(cand, structure=np.ones((3, 3), int))
top = set(np.unique(lab[0][lab[0] > 0]))                             # 上端につながる空・雲だけ（アーチの中の空は残す）
mask = np.isin(lab, list(top))
mask = ndimage.binary_dilation(mask, iterations=1) & cand | mask
alpha = np.where(mask, 0, 255).astype(float)
alpha = ndimage.uniform_filter(alpha, 3)                            # 境目を1pxだけ柔らかく
ramp = np.clip(np.arange(im.shape[1]) / 120, 0, 1)                  # 左端のぼかし
alpha = alpha * ramp[None, :]
out = np.dstack([im, alpha]).astype(np.uint8)
Image.fromarray(out, 'RGBA').save(os.path.join(G, 'assets', 'bg_4B_station_cut.webp'), 'WEBP', quality=90, method=6)
print('removed', int(mask.sum()), 'px of sky/clouds')
