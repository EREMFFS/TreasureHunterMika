// core.js — 画面・入力・スプライト・文字・音の土台
'use strict';
(function () {
const M = window.MIKA;
const W = 384, H = 216;
M.W = W; M.H = H;

// ------------------------------------------------------------------ canvas
const canvas = document.getElementById('screen');
const ctx = canvas.getContext('2d');
canvas.width = W; canvas.height = H;
ctx.imageSmoothingEnabled = false;
M.canvas = canvas; M.ctx = ctx;

function resize() {
  const fit = Math.min(window.innerWidth / W, window.innerHeight / H);
  const s = fit >= 1 ? Math.floor(fit) : fit;   // 整数倍拡大（画面が狭いときだけ縮小）
  canvas.style.width = W * s + 'px';
  canvas.style.height = H * s + 'px';
}
window.addEventListener('resize', resize);
resize();

// ------------------------------------------------------------------ utils
M.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
M.rand = (a, b) => a + Math.random() * (b - a);
M.sign = (v) => (v < 0 ? -1 : v > 0 ? 1 : 0);
M.approach = (v, t, d) => (v < t ? Math.min(t, v + d) : Math.max(t, v - d));

// ------------------------------------------------------------------ input
const T = M.TUNING;
const keyMap = {};
for (const act in T.keys) for (const code of T.keys[act]) keyMap[code] = act;
const down = {}, pressed = {}, released = {};
const physicalKeys = new Set();
const Input = {
  down, pressed, released,
  lastTap: { left: -1e9, right: -1e9 },
  dashTap: null,               // 'left' | 'right' when double-tapped this frame
  anyPressed: false,
  held: { attack: 0 },
};
M.Input = Input;
// v068: 設定変更後、その場で物理キーと操作の対応を再構築する。
Input.setKeyBindings = function (bindings) {
  for (const act in bindings) if (act !== 'start') T.keys[act] = bindings[act].slice();
  for (const code in keyMap) delete keyMap[code];
  for (const act in T.keys) for (const code of T.keys[act]) keyMap[code] = act;
  Input.clearHeld();
};
Input.clearHeld = function () {
  physicalKeys.clear();
  for (const group of [down, pressed, released]) for (const k in group) group[k] = false;
  Input.lastTap.left = Input.lastTap.right = -1e9; Input.dashTap = null;
  Input.held.attack = 0; Input.anyPressed = false;
};
// 2026-10-11 音の準備は最初の操作（画面クリック・どのキーでも）で始める。タイトルのボタン音が遅れて鳴らないように
window.addEventListener('pointerdown', () => { M.Audio && M.Audio.unlock(); });
window.addEventListener('keydown', () => { M.Audio && M.Audio.unlock(); }, true);
window.addEventListener('keydown', (e) => {
  if (e.code === 'F2') { T.prototype.showHitboxes = !T.prototype.showHitboxes; e.preventDefault(); return; }
  const a = keyMap[e.code];
  if (!a) return;
  e.preventDefault();
  if (!down[a]) pressed[a] = true;
  physicalKeys.add(e.code);
  down[a] = true;
  M.Audio && M.Audio.unlock();
});
window.addEventListener('keyup', (e) => {
  const a = keyMap[e.code];
  if (!a) return;
  e.preventDefault();
  physicalKeys.delete(e.code);
  down[a] = T.keys[a].some((code) => physicalKeys.has(code));
  if (!down[a]) released[a] = true;
});
window.addEventListener('blur', () => { Input.clearHeld(); });

let padPrev = {};
function pollPad() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  const p = pads && Array.from(pads).find((x) => x);
  if (!p) return;
  const ax = p.axes[0] || 0, ay = p.axes[1] || 0, b = (i) => p.buttons[i] && p.buttons[i].pressed;
  const st = {
    left: ax < -0.5 || b(14), right: ax > 0.5 || b(15), up: ay < -0.5 || b(12), down: ay > 0.5 || b(13),
    attack: b(2) || b(3), jump: b(0) || b(1), start: b(9), pause: b(8),
  };
  for (const k in st) {
    if (st[k] && !padPrev[k]) { pressed[k] = true; M.Audio && M.Audio.unlock(); }
    if (!st[k] && padPrev[k]) released[k] = true;
    if (st[k] !== padPrev[k]) down[k] = st[k];
  }
  padPrev = st;
}
Input.update = function (now) {
  pollPad();
  Input.dashTap = null;
  for (const d of ['left', 'right']) {
    if (pressed[d]) {
      if (now - Input.lastTap[d] < T.input.dashDoubleTapMs) Input.dashTap = d;
      Input.lastTap[d] = now;
    }
  }
  if (pressed.left && pressed.right) Input.lastTap.left = Input.lastTap.right = -1e9;
};
Input.endFrame = function () {
  for (const k in pressed) pressed[k] = false;
  for (const k in released) released[k] = false;
};
Input.dirX = () => (down.right ? 1 : 0) - (down.left ? 1 : 0);
Input.dirY = () => (down.down ? 1 : 0) - (down.up ? 1 : 0);

// ------------------------------------------------------------------ images
const pages = [], bgs = {};
M.atlasPage = (i) => pages[i];
M.loadAssets = function () {
  const jobs = [];
  const load = (src) => new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => rej(new Error('画像を読めません: ' + (src.length > 80 ? 'atlas' : src)));
    im.src = src;
  });
  // アトラスは data: URI（file:// でも色違い変換の getImageData が使える）
  // 2026-10-11 フレーム端に残った隣スプライトの切れ端を消す（data/atlas_fix.js。tools/clean_atlas_bleed.py で生成）
  const erase = (im, i) => {
    const runs = M.ATLAS_ERASE && M.ATLAS_ERASE[i]; if (!runs) return im;
    const cv = document.createElement('canvas'); cv.width = im.width; cv.height = im.height;
    const g = cv.getContext('2d'); g.drawImage(im, 0, 0);
    for (const [x, y, n] of runs) g.clearRect(x, y, n, 1);
    return cv;
  };
  // 2026-10-11 アトラスのページが足りない時は、黙って変な絵を出さずに止めて知らせる
  for (let i = 0; i < (M.ATLAS_PAGE_COUNT || 0); i++) if (!M.ATLAS_PAGES[i]) return Promise.reject(new Error('data/atlas_page' + i + '.js がありません（パッチの入れ忘れ）'));
  M.ATLAS_PAGES.forEach((src, i) => jobs.push(load(src).then((im) => (pages[i] = erase(im, i)))));
  // 背景は fetch → blob で読む（公開ページでは画像が別オリジン扱いになり、そのまま描くと canvas が「汚染」されて
  // ブラウン管表示（WebGL）に渡せなくなるため）。fetch が使えない環境（file:// など）は従来どおり直接読む
  // 2026-10-12 v111: file:// で直接開いた時は data/bg_embed.js（画像を data URI にしたもの）を読んでから、それで描く。
  //   ファイルから読んだ画像を描くとキャンバスが汚染され、タイトル以降ブラウン管表示が切れていた（オープニングは埋め込み画像なので効いていた）
  const embed = () => (location.protocol !== 'file:' || M.BG_EMBED ? Promise.resolve() : new Promise((res) => {
    const s = document.createElement('script'); s.src = 'data/bg_embed.js'; s.onload = res; s.onerror = res; document.head.appendChild(s);
  }));
  const loadBg = (src) => (/^data:/.test(src) ? load(src)
    : location.protocol === 'file:' ? load((M.BG_EMBED && M.BG_EMBED[src]) || src)
    : fetch(src).then((r) => { if (!r.ok) throw new Error(r.status); return r.blob(); }).then((b) => load(URL.createObjectURL(b))).catch(() => load(src)));
  jobs.push(embed().then(() => Promise.all(Object.keys(M.BG).map((k) => loadBg(M.BG[k].file).then((im) => (bgs[k] = im))))));
  if (M.JPFONT) jobs.push(load(M.JPFONT.image).then((im) => (jpImg = im)));
  return Promise.all(jobs);
};
M.bg = (k) => bgs[k];

const FR = M.ATLAS.frames, AN = M.ANIMS;

// ------------------------------------------------------------------ 色違い（v118 enemy_palette.js と同じ変換）
// 元画像を一度だけ変換してキャッシュし、以後は普通に描画する（毎フレーム再変換しない）
function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = 60 * ((g - b) / d % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
  }
  if (h < 0) h += 360;
  return [h, max ? d / max : 0, max];
}
function hsvToRgb(h, s, v) {
  const c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c;
  const sector = Math.floor(h / 60) % 6;
  const t = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][sector];
  return t.map((n) => Math.round((n + m) * 255));
}
const paletteCache = {};     // key: enemy_id + ':' + page
let paletteFrames = null;    // family -> Set(frame name)
function variantPage(variant, pg) {
  const key = variant + ':' + pg;
  if (paletteCache[key]) return paletteCache[key];
  const P = M.REF.palettes, cfg = P.variants[variant];
  if (!paletteFrames) {
    paletteFrames = {};
    for (const fam in P.family_assets) paletteFrames[fam] = new Set(P.family_assets[fam].map((f) => f.replace(/\.png$/, '')));
  }
  const img = pages[pg];
  const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
  const g = cv.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0);
  try {
    const set = paletteFrames[cfg.family] || new Set();
    for (const name of set) {
      const f = FR[name];
      if (!f || f[0] !== pg) continue;
      const [, sx, sy, tw, th] = f;
      const px = g.getImageData(sx, sy, tw, th), d = px.data;
      for (let i = 0; i < d.length; i += 4) {
        if (!d[i + 3]) continue;
        const [h, s2, v] = rgbToHsv(d[i], d[i + 1], d[i + 2]);
        if (s2 < cfg.source.min_s || v < cfg.source.min_v) continue;
        if (!cfg.source.hue_ranges.some(([a, b]) => h >= a && h <= b)) continue;
        const rgb = hsvToRgb(cfg.target.hue, Math.min(1, s2 * cfg.target.saturation_scale), Math.min(1, v * cfg.target.value_scale));
        d[i] = rgb[0]; d[i + 1] = rgb[1]; d[i + 2] = rgb[2];
      }
      g.putImageData(px, sx, sy);
    }
  } catch (e) { console.warn('色違い変換ができません:', e.message); }
  return (paletteCache[key] = cv);
}
M.hasVariant = (id) => !!(M.REF.palettes && M.REF.palettes.variants[id]);

// フレームを足元原点で描く。flip=true で左右反転（原点は w-1-ox に反転）。variant で色違い
M.drawFrame = function (name, footX, footY, origin, flip, alpha, variant) {
  const f = FR[name];
  if (!f) return;
  const [pg, sx, sy, tw, th, ox, oy, cw] = f;
  const src = variant ? variantPage(variant, pg) : pages[pg];
  const top = Math.round(footY - origin[1] + oy);
  if (alpha !== undefined && alpha < 1) ctx.globalAlpha = alpha;
  if (!flip) {
    ctx.drawImage(src, sx, sy, tw, th, Math.round(footX - origin[0] + ox), top, tw, th);
  } else {
    const m = cw - 1 - origin[0];
    const x = Math.round(footX - m + (cw - ox - tw));
    ctx.save();
    ctx.translate(x + tw, top);
    ctx.scale(-1, 1);
    ctx.drawImage(src, sx, sy, tw, th, 0, 0, tw, th);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
};
// フレームを元のキャンバス位置で別の描画先へ（文字の形に光をマスクする時など）
M.drawFrameTo = function (g, name, x, y) {
  const f = FR[name]; if (!f) return;
  const [pg, sx, sy, tw, th, ox, oy] = f;
  g.drawImage(pages[pg], sx, sy, tw, th, x + ox, y + oy, tw, th);
};
// アニメ名とコマ番号で描く（素材が「右向き」か「左向き」かを吸収する）
M.drawAnim = function (anim, idx, footX, footY, faceRight, alpha, variant) {
  const a = AN[anim];
  if (!a) return;
  const i = Math.min(idx, a.frames.length - 1);
  const origin = (a.origins && a.origins[i]) || a.origin;
  const authoredRight = !M.LEFT_FACING[anim];
  M.drawFrame(a.frames[i], footX, footY, origin, faceRight !== authoredRight, alpha, variant);
};
// 素材の向き（左向きで描かれているもの）
M.LEFT_FACING = {};
for (const k in AN) {
  if (AN[k].left) M.LEFT_FACING[k] = true;   // tools/build_assets.py が元絵の向きを記録
}

// アニメ再生器（durationは animation.json の値。ゲーム側で倍率をかけられる）
class Anim {
  constructor(name, opts) { this.set(name, opts); }
  set(name, opts = {}) {
    this.name = name; this.i = 0; this.t = 0; this.done = false;
    this.speed = opts.speed || 1;
    this.loop = opts.loop !== undefined ? opts.loop : !!(AN[name] && AN[name].loop);
    this.durs = opts.durs || (AN[name] ? AN[name].dur : [100]);
    this.hold = opts.hold; // 最終コマで止める
    return this;
  }
  get count() { return AN[this.name] ? AN[this.name].frames.length : 1; }
  update(dt) {
    if (this.done) return;
    this.t += dt * this.speed;
    while (this.t >= (this.durs[this.i] || 100)) {
      this.t -= this.durs[this.i] || 100;
      if (this.i < this.count - 1) this.i++;
      else if (this.loop) this.i = 0;
      else { this.done = true; this.t = 0; break; }
    }
  }
  // 総時間
  get total() { return this.durs.reduce((a, b) => a + b, 0); }
}
M.Anim = Anim;

// ------------------------------------------------------------------ bitmap font (5x7)
const GL = {
  A: '01110100011000111111100011000110001', B: '11110100011000111110100011000111110', C: '01110100011000010000100001000101110',
  D: '11110100011000110001100011000111110', E: '11111100001000011110100001000011111', F: '11111100001000011110100001000010000',
  G: '01110100011000010111100011000101111', H: '10001100011000111111100011000110001', I: '01110001000010000100001000010001110',
  J: '00111000100001000010000101001001100', K: '10001100101010011000101001001010001', L: '10000100001000010000100001000011111',
  M: '10001110111010110101100011000110001', N: '10001110011010110011100011000110001', O: '01110100011000110001100011000101110',
  P: '11110100011000111110100001000010000', Q: '01110100011000110001101011001001101', R: '11110100011000111110101001001010001',
  S: '01111100001000001110000010000111110', T: '11111001000010000100001000010000100', U: '10001100011000110001100011000101110',
  V: '10001100011000110001100010101000100', W: '10001100011000110101101011010101010', X: '10001100010101000100010101000110001',
  Y: '10001100010101000100001000010000100', Z: '11111000010001000100010001000011111',
  0: '01110100011001110101110011000101110', 1: '00100011000010000100001000010001110', 2: '01110100010000100010001000100011111',
  3: '11111000100010000010000011000101110', 4: '00010001100101010010111110001000010', 5: '11111100001111000001000011000101110',
  6: '00110010001000011110100011000101110', 7: '11111000010001000100010000100001000', 8: '01110100011000101110100011000101110',
  9: '01110100011000101111000010001001100',
  '!': '00100001000010000100001000000000100', '?': '01110100010000100010001000000000100', ':': '00000011000110000000011000110000000',
  '.': '00000000000000000000000000110001100', '-': '00000000000000011111000000000000000', '/': '00001000010001000100010001000010000',
  '+': '00000001000010011111001000010000000', 'x': '00000000001000101010001000101010001', "'": '00100001000100000000000000000000000',
  '%': '11001110010001000100010001001110011', '>': '01000001000001000001000100010001000', '<': '00010001000100010000010000010000010',
  '=': '00000000001111100000111110000000000', ',': '00000000000000000000011000010001000', '(': '00010001000100001000010000010000010',
  ')': '01000001000001000010000100010001000', '*': '00000101010111011111011101010100000',
};
const glyphCache = {};
// 2026-10-10 ユーザー指定: 英数字は Press Start 2P（data/pxfont.js の8×8。無い時・T.ui.font==='classic' の時は従来の5×7）
const PX = M.PXFONT && !(M.TUNING.ui && M.TUNING.ui.font === 'classic') ? M.PXFONT : null;
const CW = PX ? PX.w : 5, CH = PX ? PX.h : 7, ADV = PX ? PX.adv : 6;
function glyphCanvas(ch, color) {
  const key = ch + color;
  if (glyphCache[key]) return glyphCache[key];
  const c = document.createElement('canvas'); c.width = CW; c.height = CH;
  const g = c.getContext('2d'); g.fillStyle = color;
  if (PX) {
    const hex = PX.glyphs[ch];
    if (hex) for (let i = 0; i < 64; i++) if ((parseInt(hex[i >> 2], 16) >> (3 - (i & 3))) & 1) g.fillRect(i % 8, i >> 3, 1, 1);
  } else {
    const bits = GL[ch];
    if (bits) for (let i = 0; i < 35; i++) if (bits[i] === '1') g.fillRect(i % 5, (i / 5) | 0, 1, 1);
  }
  glyphCache[key] = c;
  return c;
}
M.textAdvance = ADV;   // 1文字の送り（拡大前）
// 影＋縁取り付きの文字（HUDは黒帯なしで背景に直接重ねる）
M.text = function (str, x, y, opts = {}) {
  const color = opts.color || '#fff', scale = opts.scale || 1, edge = opts.edge || '#1a1020';
  str = String(str).toUpperCase();
  const adv = ADV * scale;
  let w = str.length * adv - scale;
  if (opts.align === 'center') x -= w / 2; else if (opts.align === 'right') x -= w;
  x = Math.round(x); y = Math.round(y);
  const draw = (dx, dy, col) => {
    for (let i = 0; i < str.length; i++) {
      const ch = str[i];
      if (ch === ' ') continue;
      ctx.drawImage(glyphCanvas(ch, col), x + i * adv + dx, y + dy, CW * scale, CH * scale);
    }
  };
  if (!opts.noShadow) {
    draw(scale + 1, scale + 1, 'rgba(0,0,0,0.55)');
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]]) draw(dx, dy, edge);
  }
  draw(0, 0, color);
  return w;
};

// ------------------------------------------------------------------ 日本語ドット文字（DotGothic16 を16pxで1ビット化）
let jpImg = null;
const jpCache = {};
function jpTinted(color) {
  if (jpCache[color]) return jpCache[color];
  const c = document.createElement('canvas'); c.width = jpImg.width; c.height = jpImg.height;
  const g = c.getContext('2d'); g.drawImage(jpImg, 0, 0); g.globalCompositeOperation = 'source-in';
  g.fillStyle = color; g.fillRect(0, 0, c.width, c.height);
  return (jpCache[color] = c);
}
M.jpWidth = function (str) { let w = 0; for (const ch of str) { const gl = M.JPFONT.glyphs[ch]; w += gl ? gl[2] : 8; } return w; };
// x は左端、y はベースライン。縁取り＋影つき（黒い帯は敷かない）
M.jpText = function (str, x, y, opts = {}) {
  if (!jpImg) return;
  const F = M.JPFONT, top = Math.round(y - F.size);
  if (opts.align === 'center') x -= M.jpWidth(str) / 2;
  x = Math.round(x);
  const pass = (img, dx, dy) => {
    let cx = x;
    for (const ch of str) {
      const gl = F.glyphs[ch];
      if (!gl) { cx += 8; continue; }
      if (gl[1]) ctx.drawImage(img, gl[0], 0, gl[1], F.height, cx + dx, top + dy, gl[1], F.height);
      cx += gl[2];
    }
  };
  const edge = jpTinted(opts.edge || '#101729');
  pass(jpTinted('rgba(0,0,0,0.6)'), 2, 2);
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]]) pass(edge, dx, dy);
  pass(jpTinted(opts.color || '#fff'), 0, 0);
};

// ------------------------------------------------------------------ audio
// BGMとジングルは AudioBuffer で再生（つなぎ目のないループ）。file:// で読めない時は <audio> で代用。
// 音量は BGM と効果音で別々（data/audio.js）。フェードはゲームの時計で進み、ポーズ中は止まる。
const A = M.AUDIO;
const SYN = {
  swing: ['noise', 0.05, 2400, 0.08], hit: ['noise', 0.08, 900, 0.35], hit_heavy: ['noise', 0.16, 500, 0.5],
  smash: ['noise', 0.25, 300, 0.6], jump: ['tone', 0.10, 520, 0.12, 880], land: ['noise', 0.05, 300, 0.2],
  hurt: ['tone', 0.15, 300, 0.25, 140], grab: ['noise', 0.05, 700, 0.2], throw: ['noise', 0.12, 1200, 0.25],
  enemy_down: ['noise', 0.12, 220, 0.4], gun: ['noise', 0.03, 3000, 0.12], missile: ['noise', 0.3, 1500, 0.15],
  explosion: ['noise', 0.5, 160, 0.6], go: ['tone', 0.18, 660, 0.18, 990], pickup: ['tone', 0.08, 990, 0.15, 1480],
  coin: ['tone', 0.06, 1320, 0.12, 1760], break: ['noise', 0.15, 600, 0.35],   // time_tick（TIME BONUS集計）は仮音を鳴らさない（クリア曲と重なるため）
  fire: ['noise', 0.35, 900, 0.18], lightning: ['noise', 0.45, 2600, 0.4], laugh: ['tone', 0.3, 880, 0.08, 660],
  elevator_stop: ['noise', 0.22, 120, 0.55], glass: ['noise', 0.14, 3800, 0.25], warp: ['tone', 0.18, 300, 0.1, 1200],
};
const Audio_ = {
  ctx: null, buf: {}, el: {}, loading: {}, cur: null, pending: null, paused: false,
  bgmVolume: A.bgmVolume, seVolume: A.seVolume, voiceVolume: A.voiceVolume != null ? A.voiceVolume : 0.5,
  unlock() {
    if (!this.ctx) this.preload();
    if (this.ctx && this.ctx.state === 'suspended' && !this.paused) this.ctx.resume();
    this.warmUp();
    const c = this.cur;   // v121 断られていた曲を鳴らし直す
    if (c && c.el && c.blocked && !this.paused) { c.blocked = false; c.el.play().catch(() => { c.blocked = true; }); }
  },
  // 2026-10-12 v108 最初に音が出ないことがある対策: 最初の操作（オープニングのスキップ・ロード中のキーなど）の時に、
  //   無音を1回鳴らして音の仕組みを起こしておく（Web Audio と <audio> の両方）。タイトルに着く頃には鳴らせる状態になる
  // 2026-10-12 v121 起動の合図「ピッピッ」（最初のキーを押した時。音が出せる状態になったことの確認も兼ねる）
  pipPip() {
    if (!this.ctx) return;
    const go = () => {
      const t = this.ctx.currentTime + 0.02;
      for (const [dt, f] of [[0, 1320], [0.13, 1760]]) {
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = 'square'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t + dt); g.gain.linearRampToValueAtTime(0.09 * this.seVolume * 2, t + dt + 0.005); g.gain.setValueAtTime(0.09 * this.seVolume * 2, t + dt + 0.06); g.gain.linearRampToValueAtTime(0.0001, t + dt + 0.08);
        o.connect(g); g.connect(this.ctx.destination); o.start(t + dt); o.stop(t + dt + 0.1);
      }
    };
    if (this.ctx.state === 'running') go(); else this.ctx.resume().then(go).catch(() => {});
  },
  warmUp() {
    if (this.warm || !this.ctx) return;
    this.warm = true;
    try {
      const b = this.ctx.createBuffer(1, Math.max(1, Math.round(this.ctx.sampleRate * 0.05)), this.ctx.sampleRate);
      const s = this.ctx.createBufferSource(); s.buffer = b; s.connect(this.ctx.destination); s.start();
    } catch (e) { this.warm = false; }
    try {   // file:// で <audio> で鳴らす音（長い効果音・声・曲）用。無音のWAV（0.05秒）を音量0で一度再生
      const n = 400, hd = new Uint8Array(44 + n * 2), dv = new DataView(hd.buffer), str = (o, t) => { for (let i = 0; i < t.length; i++) hd[o + i] = t.charCodeAt(i); };
      str(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); str(8, 'WAVEfmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
      dv.setUint32(24, 8000, true); dv.setUint32(28, 16000, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true); str(36, 'data'); dv.setUint32(40, n * 2, true);
      let bin = ''; for (const c of hd) bin += String.fromCharCode(c);
      const el = new window.Audio('data:audio/wav;base64,' + btoa(bin)); el.volume = 0; el.play().catch(() => {});
    } catch (e) { /* 無くても先へ */ }
  },
  // 2026-10-11 ページを開いた時点で音を読み始める（ブラウザの決まりで鳴らせるのは最初の操作の後。読み込みと展開は先にできる）
  preload() {
    if (this.ctx) return;
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    this.bgmGain = this.ctx.createGain(); this.bgmGain.gain.value = this.bgmVolume; this.bgmGain.connect(this.ctx.destination);
    this.seGain = this.ctx.createGain(); this.seGain.gain.value = this.seVolume; this.seGain.connect(this.ctx.destination);
    this.voiceGain = this.ctx.createGain(); this.voiceGain.gain.value = this.voiceVolume; this.voiceGain.connect(this.ctx.destination);
    // 読み込みの順番: タイトルのボタン音 → 効果音 → 声 → 曲（曲は鳴らす時にも読みに行くので最後でよい）
    const first = A.se.title_start ? this.load('se:title_start', A.se.title_start) : Promise.resolve();
    first.then(() => {
      const se = [];
      for (const k in A.se) if (A.se[k]) se.push(this.load('se:' + k, A.se[k]));
      return Promise.all(se);
    }).then(() => {
      for (const k in A.voice || {}) A.voice[k].files.forEach((f, i) => this.load('vo:' + k + ':' + i, f));
      for (const k in A.music) if (A.music[k]) this.load(k, A.music[k]);
    });
  },
  // 2026-10-12 v132: BGMの音量の倍率（1＝元の音量）。Web Audio でも <audio>（file:// の曲）でも効く
  bgmLevel(v) {
    this.bgmLv = v;
    if (this.bgmGain) this.bgmGain.gain.value = this.bgmVolume * v;
    if (this.cur && this.cur.el) this.cur.el.volume = Math.max(0, Math.min(1, this.bgmVolume * (this.cur.fade == null ? 1 : this.cur.fade) * v));
  },
  // 2026-10-12 大事な効果音を聞かせるため、BGMを一時的に下げる（k=倍率。ms後に元へ）
  duckBgm(k, ms) {
    const set = (v) => { if (this.bgmGain) this.bgmGain.gain.value = this.bgmVolume * v; if (this.cur && this.cur.el) this.cur.el.volume = this.bgmVolume * this.cur.fade * v; };
    set(k); clearTimeout(this.duckTimer); this.duckTimer = setTimeout(() => set(1), ms);
  },
  setVolumes(bgm, se, voice) {
    if (bgm != null) { this.bgmVolume = bgm; if (this.bgmGain) this.bgmGain.gain.value = bgm; }
    if (se != null) { this.seVolume = se; if (this.seGain) this.seGain.gain.value = se; }
    if (voice != null) { this.voiceVolume = voice; if (this.voiceGain) this.voiceGain.gain.value = voice; }
    if (this.cur && this.cur.el) this.cur.el.volume = this.bgmVolume * this.cur.fade;
  },
  // 2026-10-11 WAV のループ点（smpl チャンク＝サスティーンループ）があれば読む。ループ再生はその区間だけを繰り返す
  loopPts: {},
  readLoop(k, ab) {
    try {
      const d = new DataView(ab); if (d.getUint32(0) !== 0x52494646) return;   // 'RIFF'
      let rate = 44100;
      for (let i = 12; i + 8 <= d.byteLength;) {
        const id = d.getUint32(i), n = d.getUint32(i + 4, true);
        if (id === 0x666d7420) rate = d.getUint32(i + 12, true);   // 'fmt '
        if (id === 0x736d706c && d.getUint32(i + 36, true) > 0) {   // 'smpl' と最初のループ
          const a = d.getUint32(i + 52, true), b = d.getUint32(i + 56, true);
          if (b > a) this.loopPts[k] = [a / rate, (b + 1) / rate];
        }
        i += 8 + n + (n & 1);
      }
    } catch (e) { /* 読めなければ全体をループ */ }
  },
  load(k, src) {
    if (this.loading[k]) return this.loading[k];
    const viaElement = () => {
      const el = new window.Audio(src); el.preload = 'auto'; this.el[k] = el;
      return new Promise((res) => { el.addEventListener('loadedmetadata', res, { once: true }); el.addEventListener('error', res, { once: true }); });
    };
    // 2026-10-11 file:// で短い効果音は data/se_embed.js の埋め込みから Web Audio で（<audio>だと鳴り始めが遅く、0.08秒の銃声などが無音になる）
    const E = k.startsWith('se:') && M.SE_EMBED && M.SE_EMBED[k.slice(3)];
    const viaEmbed = () => {
      const bin = atob(E.b64), u = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      this.readLoop(k, u.buffer);
      return this.ctx.decodeAudioData(u.buffer).then((b) => { this.buf[k] = b; });
    };
    this.loading[k] = (location.protocol === 'file:' ? (E && E.file === src && this.ctx ? viaEmbed().catch(viaElement) : viaElement()) :
      fetch(src).then((r) => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
        .then((ab) => { this.readLoop(k, ab); return this.ctx.decodeAudioData(ab); }).then((b) => { this.buf[k] = b; }).catch(viaElement))
      .then(() => { if (this.pending && this.pending.key === k) { const p = this.pending; this.pending = null; this.playMusic(p.key, p.opts); } });
    return this.loading[k];
  },
  ready(k) { return !!(this.buf[k] || this.el[k]); },
  // 効果音が読み込まれるまで待つ（最大 ms。読めなくても先へ進む）
  whenReady(se, ms = 1500) {
    const k = 'se:' + se;
    const resume = this.ctx && this.ctx.state === 'suspended' ? this.ctx.resume().catch(() => {}) : null;   // 最初の操作の直後は鳴らせる状態になるのを待つ
    const load = this.ready(k) || !this.loading[k] ? null : this.loading[k];
    return Promise.race([Promise.all([resume, load]), new Promise((r) => setTimeout(r, ms))]);
  },
  duration(k) {
    if (this.buf[k]) return this.buf[k].duration * 1000;
    const el = this.el[k]; return el && isFinite(el.duration) ? el.duration * 1000 : 0;
  },
  // 効果音。opts.robot=true でロボ用（少し高く・小さく）。
  // 同じ音は gapMs より短い間隔では重ねず、同時数 voices を超えたら一番古い音を短くフェードして止める。
  voices: {}, lastAt: {}, loops: [], pool: {},
  // 鳴り続ける音（火炎放射など）: 持ち主が毎フレーム touch する。触られなくなったら（画面が変わった等）自動で止める
  touchLoop(v) { if (v) { v.touch = performance.now(); v.miss = 0; } },   // 2026-10-11 時間ではなく「触られなかったフレーム数」で止める（重いフレームでループが勝手に切れて頭から鳴り直していた）
  stopLoop(v) { if (v) this.fadeVoice(v); },
  // 2026-10-12 起動直後に音が鳴らないことがある対策:
  //   ① 最初の操作で音が使えるようになる（resume）のは少し後なので、その間に鳴らした音は捨てずに待って鳴らす
  //   ② まだ読み込み中の音は、読み込みが終わったら鳴らす（遅れすぎた音は場面とずれるので鳴らさない）
  late: { seMs: 600, voiceMs: 1500 },
  waitUnlock(fn) {
    const at = performance.now();
    (this.unlockQ = this.unlockQ || []).push(() => { if (performance.now() - at <= this.late.seMs) fn(); });
    if (!this.unlockP) this.unlockP = this.ctx.resume().catch(() => {}).then(() => { const q = this.unlockQ; this.unlockQ = []; this.unlockP = null; for (const f of q) f(); });
  },
  waitLoad(key, src, fn, ms) {
    const at = performance.now();
    if (!this.loading[key] && src) this.load(key, src);
    if (!this.loading[key]) return false;
    (this.waitQ = this.waitQ || {});
    if (this.waitQ[key]) return true;   // 同じ音は1回だけ待つ（連打で何回も鳴らない）
    this.waitQ[key] = true;
    this.loading[key].then(() => { delete this.waitQ[key]; if (performance.now() - at <= ms && !this.paused) fn(); });
    return true;
  },
  play(k, opts = {}) {
    if (!this.ctx || this.paused) return;
    if (this.ctx.state === 'suspended') { if (!opts.loop) this.waitUnlock(() => this.play(k, opts)); else this.waitUnlock(() => {}); return; }   // ①
    if (!this.buf['se:' + k] && !this.el['se:' + k] && A.se[k] && !opts.noWait) {   // ②
      if (opts.loop) { if (!this.loading['se:' + k]) this.load('se:' + k, A.se[k]); return; }   // ループ音は鳴らす側が毎フレーム試すので、読み込みだけ始める
      if (this.waitLoad('se:' + k, A.se[k], () => this.play(k, Object.assign({}, opts, { noWait: true })), this.late.seMs)) return;
    }
    const now = this.ctx.currentTime * 1000;
    const mix = (A.seMix && (A.seMix[k] || A.seMix.default)) || { gain: 1, voices: 3, gapMs: 30 };
    const R = A.robotSE || { rate: 1.12, gain: 0.62, avoidSameMs: 70, voices: 1 };
    const vk = opts.robot ? 'robot:' + k : k;
    // 2026-10-11 間隔の判定は実時間（performance.now）で。音の時計（currentTime）は Windows の機器によって数十msずつしか進まず、
    //   0.083秒ごとのマシンガンが「0.05秒以内」に見えて時々鳴らなかった
    const wall = performance.now();
    if (wall - (this.lastAt[vk] || -1e9) < mix.gapMs) return;
    if (opts.robot && wall - (this.lastAt[k] || -1e9) < R.avoidSameMs) return;      // ミカの同じ音と同時なら鳴らさない
    if (!opts.robot && wall - (this.lastAt['robot:' + k] || -1e9) < R.avoidSameMs) this.stopVoices('robot:' + k);
    this.lastAt[vk] = wall;
    const key = 'se:' + k, gain = mix.gain * (opts.robot ? R.gain : 1) * (opts.gain || 1);
    const list = (this.voices[vk] = (this.voices[vk] || []).filter((v) => !v.ended));
    const maxV = opts.robot ? R.voices : mix.voices;
    if (this.buf[key]) while (list.length >= maxV) this.fadeVoice(list.shift());   // 要素で鳴らす時は使い回しで同時数を守る
    else list.splice(0, Math.max(0, list.length - maxV));
    if (this.buf[key]) {
      const g = this.ctx.createGain(); g.gain.value = gain; g.connect(mix.bus === 'voice' ? this.voiceGain : this.seGain);   // 敵の断末魔などは声の音量
      const s = this.ctx.createBufferSource(); s.buffer = this.buf[key];
      s.playbackRate.value = opts.robot ? R.rate : (opts.rate || 1);
      if (opts.loop) { s.loop = true; const L = this.loopPts[key]; if (L) { s.loopStart = L[0]; s.loopEnd = L[1]; } }
      s.connect(g); const v = { s, g, k, touch: wall }; s.onended = () => { v.ended = true; g.disconnect(); };
      s.start(); list.push(v);
      if (opts.loop) this.loops.push(v);
      return v;
    }
    if (this.el[key]) {
      // 2026-10-11 file:// の時: 毎回 cloneNode すると読み込み直しになり、連射（マシンガン）では鳴る前に次の弾で止められて無音になる。
      //   読み込み済みの要素を同時数ぶん用意して、使い回す（頭出しして再生）。ループ音だけは専用の要素を作る
      let el;
      if (opts.loop) el = this.el[key].cloneNode();
      else {
        const pool = (this.pool[vk] = this.pool[vk] || { list: [], i: 0 });
        if (pool.list.length < Math.max(1, maxV)) { el = this.el[key].cloneNode(); el.preload = 'auto'; pool.list.push(el); }
        else {
          el = pool.list[pool.i % pool.list.length]; pool.i++;
          if (el.readyState < 2) return;   // まだ読み込み中の要素は止めない（止めると最初の数発がずっと無音になる）
          for (const v of list) if (v.el === el) v.ended = true; el.pause(); try { el.currentTime = 0; } catch (e) { /* 読み込み中 */ } }
      }
      el.volume = Math.min(1, (mix.bus === 'voice' ? this.voiceVolume : this.seVolume) * gain);
      el.playbackRate = 1;
      if (opts.robot) { el.playbackRate = R.rate; el.preservesPitch = false; }
      if (opts.rate) { el.playbackRate = opts.rate; el.preservesPitch = false; }
      el.play().catch(() => {});
      if (opts.loop) { el.loop = true; const v = { el, k, touch: wall }; this.loops.push(v); return v; }
      const v = { el, k, touch: now, base: el.volume }; el.onended = () => { v.ended = true; }; list.push(v);   // 同時数の管理（連打で前を切る）
      return v;
    }
    if (A.placeholderSE) this.synth(k, opts.robot ? R.rate : 1, gain);
  },
  // ミカの声: 1本だけ鳴らす（優先度の高い声が来たら今の声を止める。低ければ鳴らさない）
  vo: null, voLast: {}, voPrev: {},
  voice(k, noWait) {
    const C = A.voice && A.voice[k];
    if (!C || !this.ctx || this.paused) return false;
    if (this.ctx.state === 'suspended') { this.waitUnlock(() => this.voice(k, noWait)); return true; }   // 2026-10-12 ①
    if (!noWait && C.files.some((f, i) => !this.buf['vo:' + k + ':' + i] && !this.el['vo:' + k + ':' + i])) {   // ② 読み込み中の声は、終わったら鳴らす
      const miss = C.files.findIndex((f, i) => !this.buf['vo:' + k + ':' + i] && !this.el['vo:' + k + ':' + i]);
      if (this.waitLoad('vo:' + k + ':' + miss, C.files[miss], () => this.voice(k, true), this.late.voiceMs)) return true;
    }
    const now = performance.now();   // 2026-10-11 実時間で（音の時計は機器によって粗い）
    if (C.chance < 1 && Math.random() >= C.chance) return false;
    if (now - (this.voLast[k] || -1e9) < (C.coolMs || 0)) return false;
    const cur = this.vo;
    if (cur && !cur.ended && cur.el && cur.el.ended) cur.ended = true;
    if (cur && !cur.ended) { if (C.pri <= cur.pri) return false; this.fadeVoice(cur); }
    let i = Math.floor(Math.random() * C.files.length);
    if (C.files.length > 1 && i === this.voPrev[k]) i = (i + 1 + Math.floor(Math.random() * (C.files.length - 1))) % C.files.length;   // 直前と同じ声を避ける
    this.voPrev[k] = i; this.voLast[k] = now;
    const key = 'vo:' + k + ':' + i, gain = C.gain || 1;
    if (this.buf[key]) {
      const g = this.ctx.createGain(); g.gain.value = gain; g.connect(this.voiceGain);
      const s = this.ctx.createBufferSource(); s.buffer = this.buf[key]; s.connect(g);
      const v = { s, g, k, pri: C.pri }; s.onended = () => { v.ended = true; g.disconnect(); };
      s.start(); this.vo = v; return true;
    }
    if (this.el[key]) {
      const el = this.el[key].cloneNode(); el.volume = Math.min(1, this.voiceVolume * gain); el.play().catch(() => {});
      const v = { el, k, pri: C.pri }; el.onended = () => { v.ended = true; }; this.vo = v; return true;
    }
    return false;
  },
  fadeVoice(v) {
    if (!v || v.ended) return;
    if (v.el) { v.el.pause(); v.ended = true; return; }
    try { const t = this.ctx.currentTime; v.g.gain.setTargetAtTime(0, t, 0.012); v.s.stop(t + 0.05); } catch (e) { /* 既に停止 */ }
    v.ended = true;
  },
  stopVoices(vk) { for (const v of this.voices[vk] || []) this.fadeVoice(v); },
  synth(k, rate = 1, vol = 1) {
    const P = SYN[k];
    if (!P) return;
    const g = this.ctx.createGain(); g.connect(this.seGain);
    const q = P.slice(); q[2] *= rate; if (q[4]) q[4] *= rate; q[3] *= vol;
    return this.synthP(q, g);
  },
  synthP(P, g) {
    const c = this.ctx, t = c.currentTime;
    g.gain.setValueAtTime(P[3], t); g.gain.exponentialRampToValueAtTime(0.001, t + P[1]);
    if (P[0] === 'tone') {
      const o = c.createOscillator(); o.type = 'square';
      o.frequency.setValueAtTime(P[2], t); o.frequency.linearRampToValueAtTime(P[4], t + P[1]);
      o.connect(g); o.start(t); o.stop(t + P[1]);
    } else {
      const len = Math.ceil(c.sampleRate * P[1]);
      const b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const s = c.createBufferSource(); s.buffer = b;
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = P[2];
      s.connect(f); f.connect(g); s.start(t);
    }
  },
  // BGM・ジングル。opts: { loop=true, onEnd }。同じ曲が鳴っていれば鳴らし直さない（二重再生しない）
  playMusic(key, opts = {}) {
    if (!key) { this.stopMusic(); return; }
    if (this.cur && this.cur.key === key && !this.cur.fading) return;
    this.stopMusic();
    if (!this.ctx) { this.pending = { key, opts }; return; }   // 最初のキー入力で音が使えるようになったら鳴らす
    if (!this.ready(key)) { this.pending = { key, opts }; if (A.music[key]) this.load(key, A.music[key]); return; }
    const loop = opts.loop !== false, cur = { key, loop, onEnd: opts.onEnd, fade: 1, fading: 0 };
    if (this.buf[key]) {
      const g = this.ctx.createGain(); g.gain.value = 1; g.connect(this.bgmGain);
      const s = this.ctx.createBufferSource(); s.buffer = this.buf[key]; s.loop = loop; s.connect(g);
      s.onended = () => { if (this.cur === cur) { this.cur = null; cur.ended = true; cur.onEnd && cur.onEnd(); } };
      s.start(); cur.src = s; cur.gain = g; cur.t0 = this.ctx.currentTime;
    } else {
      const el = this.el[key]; el.loop = loop; el.currentTime = 0; el.volume = this.bgmVolume;
      el.onended = () => { if (this.cur === cur) { this.cur = null; cur.ended = true; cur.onEnd && cur.onEnd(); } };
      // 2026-10-12 v121: 最初の操作の前は <audio> の再生をブラウザが断る（file:// の曲はこちら）。断られたら印を付けて、最初の操作で鳴らし直す
      el.play().catch(() => { if (this.cur === cur) cur.blocked = true; }); cur.el = el;
    }
    this.cur = cur;
    return cur;
  },
  // 今鳴っている曲の実際の再生位置（ms）。AudioContext はポーズ中に止まるので、ポーズでずれない
  musicPos(key) {
    const c = this.cur;
    if (!c || (key && c.key !== key)) return -1;
    if (c.src) return (this.ctx.currentTime - c.t0) * 1000;
    if (c.el) return c.el.currentTime * 1000;
    return -1;
  },
  musicPlaying(key) { return !!(this.cur && this.cur.key === key); },
  stopMusic() {
    this.pending = null;
    const c = this.cur; this.cur = null;
    if (!c) return;
    if (c.src) { c.src.onended = null; try { c.src.stop(); } catch (e) { /* 再生前 */ } c.gain.disconnect(); }
    if (c.el) { c.el.onended = null; c.el.pause(); }
  },
  // フェードアウト（ゲームの時計で進む＝ポーズ中は止まる）
  fadeOutMusic(ms, then) {
    if (!this.cur) { then && then(); return; }
    this.cur.fading = Math.max(1, ms); this.cur.fadeLeft = ms; this.cur.then = then;
  },
  update(dt) {
    if (this.loops.length && this.ctx && !this.paused) {
      for (const v of this.loops) if (!v.ended && (v.miss = (v.miss || 0) + 1) > 30) this.fadeVoice(v);   // 約0.5秒ぶんのフレーム
      this.loops = this.loops.filter((v) => !v.ended);
    }
    const c = this.cur;
    if (!c || !c.fading) return;
    c.fadeLeft -= dt; c.fade = Math.max(0, c.fadeLeft / c.fading);
    if (c.gain) c.gain.gain.value = c.fade; else if (c.el) c.el.volume = this.bgmVolume * c.fade;
    if (c.fadeLeft <= 0) { const then = c.then; this.stopMusic(); then && then(); }
  },
  // 2026-10-12 v101 ポーズの ON/OFF 音: ポーズ中は音の仕組み全体（ctx）を止めるので、<audio> 要素で別に鳴らす
  uiSound(k) {
    const src = A.se[k]; if (!src) return;
    const ui = (this.ui = this.ui || {});
    this.uiPrep(k); const el = ui[k];
    const mix = (A.seMix && A.seMix[k]) || { gain: 1 };
    el.volume = Math.min(1, this.seVolume * mix.gain);
    try { el.currentTime = 0; } catch (e) { /* 読み込み中 */ }
    el.play().catch(() => {});
  },
  uiPrep(k) { const ui = (this.ui = this.ui || {}); if (!ui[k] && A.se[k]) { ui[k] = new window.Audio(A.se[k]); ui[k].preload = 'auto'; } },
  pauseAll() {
    this.paused = true;
    if (this.ctx && this.ctx.state === 'running') this.ctx.suspend();
    if (this.cur && this.cur.el) this.cur.el.pause();
    if (this.vo && this.vo.el && !this.vo.ended) this.vo.el.pause();
  },
  resumeAll() {
    this.paused = false;
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    if (this.cur && this.cur.el) this.cur.el.play().catch(() => {});
    if (this.vo && this.vo.el && !this.vo.ended) this.vo.el.play().catch(() => {});
  },
};
M.Audio = Audio_;
})();
