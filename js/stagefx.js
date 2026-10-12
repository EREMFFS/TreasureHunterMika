// stagefx.js — 2Bエレベーター、各面の背景演出（砂嵐・流れ星・モニター・泡・妖精・小道・光の階段）
'use strict';
(function () {
const M = window.MIKA, T = M.TUNING;
const { clamp } = M;

// ================================================================== 2B 地下エレベーター
// 床・枠は固定、降下中だけ奥の壁が上へ流れる。停車中は左右のドアから、降下中は上から敵。
// 出発階の番号は壁と一緒に上へ抜け、到着を決めた時に次の階の番号を一度だけ壁に置く（long_travel.js を移植）
class Elevator {
  constructor(w) {
    this.w = w; this.cfg = w.map.specials.elevator;
    this.offset = 0; this.floor = 0; this.phase = 'stopped'; this.target = null;
    this.markers = [{ floor: 0, y: this.cfg.anchor_y }];
    this.doors = [1, 1]; this.doorGoal = [1, 1];
    this.impactT = 999; this.flickT = 0; this.nextFlick = 8000;
  }
  canSpawn() {
    const s = this.w.sec;
    if (!s) return false;
    if (s.kind === 'elevator_stop') return this.phase === 'stopped' && this.doors[0] > 0.95 && this.doors[1] > 0.95;
    return this.phase === 'travel';
  }
  // 2026-10-11 扉が動き出す時に開閉の音（左右どちらかでも動けば一度）
  setDoors(goal) {
    if (goal.some((g, i) => Math.abs(g - this.doors[i]) > 0.05 && g !== this.doorGoal[i])) M.Audio.play('elev_door');
    this.doorGoal = goal;
  }
  onBeginSection(sec) {
    if (sec.kind === 'elevator_stop') { this.setDoors([1, 1]); }
    else { this.setDoors([0, 0]); this.phase = 'travel'; }
  }
  onSectionDone(sec) {
    const w = this.w;
    if (sec.kind === 'elevator_stop') {
      if (sec.floor >= this.cfg.floors.length - 1) { this.setDoors([0, 1]); w.onMapCleared(); return; }   // B4: 右のドアから2Cへ
      this.phase = 'closing'; this.setDoors([0, 0]);
      return;
    }
    // 降下中の敵を全部倒したら到着を要求（壁はそのまま流れ続け、次の階の番号が下から現れて止まる）
    if (this.phase === 'travel') {
      this.target = Math.ceil(this.offset) + this.cfg.arrival_px;
      this.phase = 'arriving';
      this.markers.push({ floor: this.floor + 1, y: this.target + this.cfg.anchor_y });
    }
  }
  impactY() {
    const t = this.impactT, o = this.cfg.impact.native_vertical_offsets;
    if (t >= this.cfg.impact.duration_ms) return 0;
    return o[Math.min(o.length - 1, Math.floor(t / (this.cfg.impact.duration_ms / o.length)))];
  }
  update(dt) {
    const w = this.w, s = dt / 1000;
    this.impactT += dt;
    for (let i = 0; i < 2; i++) this.doors[i] = M.approach(this.doors[i], this.doorGoal[i], dt / this.cfg.door_ms);
    if (this.phase === 'closing' && this.doors[0] <= 0 && this.doors[1] <= 0) {
      this.phase = 'travel';
      w.beginSection(w.secIdx + 1, false);
    }
    // 2026-10-11 動いている間は走行音をループ（止まったら切る）
    const moving = this.phase === 'travel' || this.phase === 'arriving';
    if (moving) { if (!this.mv || this.mv.ended) this.mv = M.Audio.play('elev_move', { loop: true }); else M.Audio.touchLoop(this.mv); }
    else if (this.mv) { M.Audio.stopLoop(this.mv); this.mv = null; }
    if (this.phase === 'travel' || this.phase === 'arriving') {
      this.offset += this.cfg.speed * s;
      if (this.phase === 'arriving' && this.offset >= this.target) {
        this.offset = this.target; this.floor++; this.phase = 'stopped'; this.impactT = 0;
        M.Audio.play('elev_stop');   // 2026-10-11 新しい停止音
        this.setDoors([1, 1]); this.opening = true;
      }
    }
    if (this.opening && this.doors[0] >= 1 && this.doors[1] >= 1) { this.opening = false; w.beginSection(w.secIdx + 1, false); }
    // 蛍光灯: 8〜18秒に1回、短くちらつく
    this.flickT += dt;
    if (this.flickT >= this.nextFlick) { this.flickStart = this.flickT; this.nextFlick = this.flickT + 8000 + Math.random() * 10000; }
  }
  drawBack() {
    const ctx = M.ctx, c = this.cfg, h = c.shaft_tile, im = M.bg('2B_shaft');
    const shift = -Math.floor(this.offset % h);
    ctx.drawImage(im, 0, shift); ctx.drawImage(im, 0, shift + h);
    for (const mk of this.markers) {
      const y = Math.floor(mk.y - this.offset);
      if (y < -28 || y > 145) continue;
      const f = 'elev_paint_' + c.floors[mk.floor];
      if (M.ATLAS.frames[f]) M.drawFrame(f, c.sign_anchor[0], y, [0, 0], false);
    }
    ctx.drawImage(M.bg('2B_carriage'), 0, 0);
    c.doors.forEach(([x, y, dw, dh], i) => {
      const amt = clamp(this.doors[i], 0, 1);
      ctx.save(); ctx.beginPath(); ctx.rect(x, y, dw, dh); ctx.clip();
      M.drawFrame('elev_door_panel', x + (i === 0 ? -1 : 1) * Math.round(amt * dw), y, [0, 0], false);
      ctx.restore();
    });
    const a = this.flickT - (this.flickStart || -1e9);
    if (a >= 0 && a < 280) {
      const n = [1, 2, 3, 0][Math.min(3, Math.floor(a / 70))];
      for (const [x, y] of c.fluorescent) M.drawFrame('s2_fluorescent_0' + n, x - 32, y + 1, [0, 0], false);
    }
  }
}
M.Elevator = Elevator;

// ================================================================== 1A 奥の上空を横切る空中列車（2026-10-12 v105 ユーザー指定）
//   最初の区間（A1）の雑魚を倒し、そこから少し進んだら一度だけ。エンディングの列車の絵（end_airtrain）を小さく、右から左へ
//   1面の空（far）の直後に描く（js/stage.js drawStage1Back）ので、遠くの街・建物に隠れる。汽笛は小さく一度
const SKYTRAIN = { afterPx: 96, y: 36, scale: 0.15, cars: 10, speed: 34, parallax: 0.1, hornAt: 300, hornGain: 0.35 };
M.layerFx = M.layerFx || {};
M.layerFx.skytrain = (w) => {
  if (w.kind !== 'main' || w.run.skyTrainDone) return;
  const S = (w.skyTrain = w.skyTrain || { phase: 'wait' });
  const sec = w.sec && w.sec.section_id;
  if (S.phase === 'wait') {
    if (sec && sec !== 'A1' && S.cam0 == null) S.cam0 = w.camX;   // A1 が終わった時のカメラ
    if (S.cam0 != null && w.camX >= S.cam0 + SKYTRAIN.afterPx) { S.phase = 'run'; S.t0 = w.fxTime; S.camR = w.camX; }
    return;
  }
  const im = M.bg('end_airtrain'), TR = M.END_TRAIN; if (!im || !TR) return;
  const k = SKYTRAIN.scale, h = TR.h * k, locoW = TR.car[0] * k, carW = TR.car[2] * k;
  const len = locoW + SKYTRAIN.cars * carW;
  const x = M.W + 6 - (w.fxTime - S.t0) / 1000 * SKYTRAIN.speed - (w.camX - S.camR) * SKYTRAIN.parallax;
  if (!S.horn && x < SKYTRAIN.hornAt) { S.horn = true; M.Audio.play('train_horn', { gain: SKYTRAIN.hornGain }); }
  if (x + len < -4) { w.run.skyTrainDone = true; return; }
  const ctx = M.ctx, y = SKYTRAIN.y + Math.sin(w.fxTime / 900) * 0.6;
  ctx.save(); ctx.imageSmoothingEnabled = true; ctx.globalAlpha = 0.85;   // 遠くなので少し霞ませる
  ctx.drawImage(im, 0, 0, TR.car[0], TR.h, x, y, locoW, h);
  for (let i = 0; i < SKYTRAIN.cars; i++) ctx.drawImage(im, TR.car[0], 0, TR.car[2], TR.h, x + locoW + i * carW, y, carW, h);
  ctx.restore();
};

// ================================================================== 背景演出（決まった乱数で、ポーズ中は止まる＝ゲームの時計）
function seeded(n) { const x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x); }
M.drawAmbient = function (w, layer) {
  const fx = w.map.fx, ctx = M.ctx, t = w.fxTime / 1000;
  if (layer === 'front') return;
  if (w.stairs) drawStairs(w);
  if (fx === '2A' && w.kind === 'main') {
    // 薄い砂嵐（18〜35秒に1回・5秒）と流れ星（12〜28秒に1回・0.65秒）
    const sandCycle = 26, sa = (t + 6) % sandCycle;
    if (sa < 5) {
      ctx.globalAlpha = 0.18 * Math.sin(Math.PI * sa / 5); ctx.fillStyle = '#c4b18a';
      for (let i = 0; i < 100; i++) { const x = (i * 79 + t * 100) % 410 - 14, y = 115 + (i * 31) % 94; ctx.fillRect(x, y, 8 + (i % 13), 1); }
      ctx.globalAlpha = 1;
    }
    const starCycle = 19, k = Math.floor((t + 3) / starCycle), st = (t + 3) % starCycle;
    if (st < 0.65) {
      const x = 50 + seeded(k) * 200 + st * 240, y = 12 + seeded(k + 7) * 20 + st * 46;
      ctx.strokeStyle = '#b4d4ef'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x - 18, y - 4); ctx.lineTo(x, y); ctx.stroke();
      ctx.fillStyle = '#f4f8ff'; ctx.fillRect(Math.round(x), Math.round(y), 2, 1);
    }
  }
  if (fx === '2C' && w.kind === 'main') {
    const L = w.map.specials.lab_fx, n = Math.floor(t * 8) % 8;
    for (const [x, y, ww, hh] of L.monitors) { const sx = x - w.camX; if (sx > -40 && sx < M.W) M.drawFrame('s2_monitor_0' + n, sx, y, [0, 0], false); }
    for (const [x, y, ww, hh] of L.vats) {
      const sx = x - w.camX; if (sx < -ww || sx > M.W) continue;
      ctx.save(); ctx.beginPath(); ctx.rect(sx, y, ww, hh); ctx.clip();
      for (let bx = 0; bx < ww; bx += 32) M.drawFrame('s2_bubbles_0' + ((n + bx / 32) % 8), sx + bx, y + hh - 80, [0, 0], false);
      ctx.restore();
    }
    // 1か所だけ短く暗くして戻る（全体やHUDは暗くしない）
    const lc = 21, la = t % lc, li = Math.floor(t / lc);
    if (la < 0.32) {
      const p = L.lights[li % L.lights.length], pulse = la < 0.08 ? 0.42 : la < 0.15 ? 0 : la < 0.23 ? 0.27 : 0;
      if (pulse) { ctx.globalAlpha = pulse; ctx.fillStyle = '#07100e'; ctx.fillRect(p[0] - w.camX, p[1], p[2], p[3]); ctx.globalAlpha = 1; }
    }
  }
  if (fx === '3A') {
    // 奥の小道と看板（入れる道だけ看板）
    for (const pp of (w.map.specials.path_ports || [])) {
      const sx = pp.foot[0] - w.camX; if (sx < -60 || sx > M.W + 60) continue;
      if (w.kind === 'main') M.drawFrame('forest_path_' + pp.style, sx, pp.foot[1], [48, 80], false);
      if (pp.enterable) {
        const port = w.map.portals.find((p) => p.id === pp.route_id || p.id === pp.route_id + '_back');
        const ok = port && w.portalUsable(port);
        if (ok || !port) M.drawFrame('forest_arrow_up', sx + 30, pp.foot[1] - 2, [16, 40], false);
      }
    }
    // 2026-10-12 v064: 正解の部屋（3F3）だけ、上に行ける道の右に「→」の木の看板（足元[24,46]・右向きのまま）
    const RS = w.map.specials.right_signs, sg = RS && M.bg('sign_forest_right_v064');
    if (sg) for (const x of RS.xs) { const sx = Math.round(x - w.camX); if (sx > -30 && sx < M.W + 30) ctx.drawImage(sg, sx - 24, RS.y - 46); }
    // 逃げる小さな妖精（木や空の奥・背景演出のみ）
    if (w.kind === 'main') {
      ctx.save(); ctx.beginPath(); ctx.rect(0, 32, M.W, 108); ctx.clip();
      ['pink', 'blue', 'yellow'].forEach((c, j) => {
        const x = ((360 - t * 42 - j * 92) % 450 + 450) % 450 - 30, y = 55 + j * 18 + Math.sin(t * 2 + j) * 4;
        M.drawAnim('fairy_' + c, Math.floor(t * 8) % 4, x, y, false);
      });
      ctx.restore();
    }
  }
  if (fx === '3B' && w.kind === 'main') {
    for (let j = 0; j < 3; j++) {
      const phase = (t + j * 2.7) % 8, a = Math.max(0, 1 - Math.abs(phase - 1.5) / 0.7) * 0.38;
      if (!a) continue;
      ctx.globalAlpha = a; ctx.fillStyle = '#fff9b7';
      const x = 65 + j * 103, y = 45 + (j * 29) % 78; ctx.fillRect(x - 2, y, 5, 1); ctx.fillRect(x, y - 2, 1, 5);
      ctx.globalAlpha = 1;
    }
  }
};
function drawStairs(w) {
  const s = w.stairs, f = Math.min(2, Math.floor(s.t / 600));
  M.drawFrame('forest_light_stairs_0' + f, s.x - w.camX, s.y, [24, 112], false);
}
})();
