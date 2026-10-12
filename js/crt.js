// crt.js — ブラウン管（CRT）風の画面効果
//   ゲームは今まで通り 384×216 の canvas(#screen) に描き、その絵を WebGL で拡大して表示する。
//   画面の湾曲・走査線・横方向のにじみ・RGBの粒（アパーチャーグリル）・光のにじみ（グロー）・周辺減光。
//   F3 で ON/OFF（ブラウザに覚える）。WebGL が使えない環境では従来の整数倍表示のまま。
'use strict';
(function () {
const M = window.MIKA, T = M.TUNING;
const C = Object.assign({
  enabled: true,
  curvature: [0.030, 0.042],  // 画面の湾曲（横, 縦）。0で平面
  scanline: 0.60,             // 走査線の濃さ（0〜1）
  beamMin: 0.36, beamMax: 0.56, // 電子ビームの太さ（暗い所→明るい所。走査線1本=1.0）
  sharpness: 0.62,            // 横方向のにじみ（小さいほどにじむ）
  convergence: 0.18,          // RGBのずれ（ドット単位）
  mask: 0.22,                 // RGBの粒の濃さ（0〜1）
  glow: 0.16,                 // 明るい所の光のにじみ
  vignette: 0.22,             // 周辺減光
  corner: 0.035,              // 角の丸み
  brightness: 1.18,           // 走査線・粒で暗くなる分の持ち上げ
}, T.crt || {});
T.crt = C;

const src = M.canvas, W = M.W, H = M.H;
const old = document.getElementById('crt'); if (old) old.remove();   // 公開ページの更新で読み直された時に二重にしない
const view = document.createElement('canvas');
view.id = 'crt';
view.tabIndex = 0;
view.style.display = 'block';
view.style.outline = 'none';
const gl = view.getContext('webgl', { antialias: false, alpha: false, preserveDrawingBuffer: true, premultipliedAlpha: false });

let on = C.enabled;
try { const v = localStorage.getItem('mika_crt'); if (v != null) on = v === '1'; } catch (e) { /* 保存できない環境 */ }

if (!gl) { M.CRT = null; return; }

const VS = `attribute vec2 p; varying vec2 uv; void main(){ uv = p*0.5+0.5; uv.y = 1.0-uv.y; gl_Position = vec4(p,0.0,1.0); }`;
const FS = `
precision highp float;
varying vec2 uv;
uniform sampler2D tex;      // 最近傍
uniform sampler2D texL;     // 線形（グロー用）
uniform vec2 srcSize, outSize;
uniform vec2 curv;
uniform float scan, bMin, bMax, sharp, conv, maskK, glowK, vig, corner, bright, scale;
vec3 lin(vec3 c){ return c*c; }   // ガンマ2.0で近似
vec3 fetch(vec2 t){ return lin(texture2D(tex, (t+0.5)/srcSize).rgb); }
vec2 warp(vec2 u){
  u = u*2.0-1.0;
  u *= 1.0 + vec2(u.y*u.y, u.x*u.x) * curv;
  return u*0.5+0.5;
}
float gauss(float d, float w){ return exp(-0.5*(d*d)/(w*w)); }
void main(){
  vec2 u = warp(uv);
  // 画面の外（湾曲で出来る縁）と角の丸み
  vec2 q = abs(u*2.0-1.0);
  vec2 cc = max(q - (1.0-corner), 0.0);
  float edge = length(cc) / corner;
  float px = 2.0/min(outSize.x, outSize.y) / corner;
  float inside = 1.0 - smoothstep(1.0-px*2.0, 1.0, edge);
  if (q.x > 1.0 || q.y > 1.0) inside = 0.0;

  vec2 s = u*srcSize - 0.5;       // 元画素の座標（画素中心=整数）
  vec2 i = floor(s);
  vec2 f = s - i;
  // 走査線の強さは拡大率に合わせる（小さい表示でモアレを出さない）
  float sk = scan * smoothstep(1.6, 3.2, scale);
  vec3 acc = vec3(0.0), nrm = vec3(0.0);
  for (int y = -1; y <= 2; y++) {
    float dy = float(y) - f.y;
    vec3 rowR = vec3(0.0); vec3 wsum = vec3(0.0);
    for (int x = -2; x <= 2; x++) {
      vec3 c = fetch(vec2(i.x + float(x), i.y + float(y)));
      float dx = float(x) - f.x;
      // 横のにじみ（RGBで少しずらす＝コンバージェンス）
      vec3 w = vec3(gauss(dx + conv, sharp), gauss(dx, sharp), gauss(dx - conv, sharp));
      rowR += c*w; wsum += w;
    }
    vec3 row = rowR / wsum;
    // 明るい色ほど太いビーム
    vec3 bw = mix(vec3(bMin), vec3(bMax), sqrt(clamp(row, 0.0, 1.0)));
    vec3 g = vec3(gauss(dy, bw.r), gauss(dy, bw.g), gauss(dy, bw.b));
    acc += row * g; nrm += g;
  }
  vec3 flat_ = acc / max(nrm, vec3(1e-4));
  vec3 col = mix(flat_, acc * bright * 1.35, sk);

  // RGBの粒（アパーチャーグリル：画面の画素3本で1組）
  float mk = maskK * smoothstep(2.4, 4.0, scale);
  float m = mod(gl_FragCoord.x, 3.0);
  vec3 mask = m < 1.0 ? vec3(1.0, 1.0-mk, 1.0-mk) : m < 2.0 ? vec3(1.0-mk, 1.0, 1.0-mk) : vec3(1.0-mk, 1.0-mk, 1.0);
  col *= mask * (1.0 + mk*0.66);

  // グロー（明るい所が周りへにじむ）
  vec2 t = u;
  vec2 o = 1.6/srcSize;
  vec3 glw = lin(texture2D(texL, t + vec2( o.x, o.y)).rgb) + lin(texture2D(texL, t + vec2(-o.x, o.y)).rgb)
           + lin(texture2D(texL, t + vec2( o.x,-o.y)).rgb) + lin(texture2D(texL, t + vec2(-o.x,-o.y)).rgb)
           + lin(texture2D(texL, t + vec2(2.6*o.x, 0.0)).rgb) + lin(texture2D(texL, t - vec2(2.6*o.x, 0.0)).rgb);
  col += glw/6.0 * glowK;

  // 周辺減光
  vec2 v = u*(1.0-u);
  col *= mix(1.0, pow(clamp(v.x*v.y*16.0, 0.0, 1.0), 0.35), vig);

  col = sqrt(max(col, 0.0));
  gl_FragColor = vec4(col * inside, 1.0);
}`;

function sh(type, code) {
  const s = gl.createShader(type); gl.shaderSource(s, code); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}
let prog;
try {
  prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
} catch (e) { console.warn('CRT shader:', e); M.CRT = null; return; }

gl.useProgram(prog);
const buf = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buf);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
const ap = gl.getAttribLocation(prog, 'p');
gl.enableVertexAttribArray(ap); gl.vertexAttribPointer(ap, 2, gl.FLOAT, false, 0, 0);
function mkTex(filter) {
  const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return t;
}
const texN = mkTex(gl.NEAREST), texL = mkTex(gl.LINEAR);
const U = {};
for (const k of ['tex', 'texL', 'srcSize', 'outSize', 'curv', 'scan', 'bMin', 'bMax', 'sharp', 'conv', 'maskK', 'glowK', 'vig', 'corner', 'bright', 'scale']) U[k] = gl.getUniformLocation(prog, k);
gl.uniform1i(U.tex, 0); gl.uniform1i(U.texL, 1);

// 表示: CRT の時は画面いっぱい（16:9を保つ・整数倍でなくてよい）
let cssScale = 1;
function layout() {
  if (!on) { view.style.display = 'none'; src.style.display = 'block'; return; }
  src.style.display = 'none'; view.style.display = 'block';
  const fit = Math.min(window.innerWidth / W, window.innerHeight / H);
  cssScale = fit;
  const cw = Math.floor(W * fit), ch = Math.floor(H * fit);
  view.style.width = cw + 'px'; view.style.height = ch + 'px';
  const dpr = window.devicePixelRatio || 1;
  const bw = Math.max(1, Math.round(cw * dpr)), bh = Math.max(1, Math.round(ch * dpr));
  if (view.width !== bw || view.height !== bh) { view.width = bw; view.height = bh; }
}
src.parentNode.insertBefore(view, src.nextSibling);
window.addEventListener('resize', layout);
layout();

let failed = false;
function present() {
  if (!on || failed) return;
  try { draw(); } catch (e) {
    // 描けない環境（画像の読み込み制限など）は従来のドット表示に戻す
    failed = true; console.warn('CRT off:', e); on = false; layout();
    const msg = document.getElementById('hint'); if (msg) { msg.hidden = false; msg.textContent = 'この環境ではブラウン管表示が使えないため、通常表示にしました'; }
  }
}
function draw() {
  gl.viewport(0, 0, view.width, view.height);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texN);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, texL);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
  gl.uniform2f(U.srcSize, W, H);
  gl.uniform2f(U.outSize, view.width, view.height);
  gl.uniform2f(U.curv, C.curvature[0], C.curvature[1]);
  gl.uniform1f(U.scan, C.scanline); gl.uniform1f(U.bMin, C.beamMin); gl.uniform1f(U.bMax, C.beamMax);
  gl.uniform1f(U.sharp, C.sharpness); gl.uniform1f(U.conv, C.convergence); gl.uniform1f(U.maskK, C.mask);
  gl.uniform1f(U.glowK, C.glow); gl.uniform1f(U.vig, C.vignette); gl.uniform1f(U.corner, Math.max(0.002, C.corner));
  gl.uniform1f(U.bright, C.brightness); gl.uniform1f(U.scale, view.height / H);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}
function set(v) {
  if (failed) return;
  on = !!v;
  try { localStorage.setItem('mika_crt', on ? '1' : '0'); } catch (e) { /* 保存できない環境 */ }
  const had = document.activeElement === src || document.activeElement === view;
  layout();
  if (had) (on ? view : src).focus();
}
window.addEventListener('keydown', (e) => { if (e.code === 'F3') { set(!on); e.preventDefault(); } });
view.addEventListener('pointerdown', () => view.focus());
M.CRT = { present, set, get on() { return on; }, view, layout };
})();
