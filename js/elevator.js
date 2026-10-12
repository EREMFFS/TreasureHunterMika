// elevator.js — 5面 ビル外壁のガラスエレベーター（v004 扉を絵に組み込んだ版）2026-10-11
//   元: MIKA_AFTER_5A_HANDOFF_v034/elevator_v004/elevator_renderer.js をゲームへ移植。
//   ・ビルの右側面の扉と、かごの左側面の扉を同じ敷居でつなぎ、両方を通って歩いて乗り降りする（正面扉は使わない）
//   ・閉扉は絵のまま。開く時は扉の板だけを面の傾きに沿ってスライド。ビルの開口の奥は暗い #030407
//   ・遠景は縮小せず、奥・中・手前の3層を違う速さで下へ沈めて高度を出す
//   ・通常（1F→13F / 13F→37F / 37F→99F）約14秒。5H→展望台は34秒の長距離急加速（音声2本＋仮のシュイイイン）
//   ・ステージのTIMEは止まる（ワールドの外の場面なので時計が進まない）。BGMは前のマップの曲をそのまま続ける
'use strict';
(function () {
const M = window.MIKA, T = M.TUNING;
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const mix = (a, b, t) => a + (b - a) * t, smooth = (t) => t * t * (3 - 2 * t);
const W = 384, H = 216;
const CABIN = [104, 0, 176, 211], WALL = [0, 8, 130, 216];
// 2026-10-11 展望台行き（高速）: 乗り込み・扉・「上に参ります」・動き出しは普通のエレベーターと同じ。
//   動きながら案内が流れ、急加速して雲を突き抜け、雲の上へすっ飛んでいく
const EX = {
  close: 2.0, move: 2.8, ue: 2.9, tenboudai: 4.6, panic: 9, topspeed: 14,
  cruise: 600, boostStart: 9, boostEnd: 17,   // 2.8〜9秒で600px/秒まで → 9〜17秒で10倍（6000）へ → その後も少しずつ
  cloudFrom: 19000, cloudTo: 27000,           // この高度の間に雲の層を突き抜ける（白くかすむ）
  launch: 19.6, black: 20.3, end: 21.5,
};
function exSpeed(t) {
  if (t < EX.move) return 0;
  if (t < EX.boostStart) return EX.cruise * smooth((t - EX.move) / (EX.boostStart - EX.move));
  if (t < EX.boostEnd) return EX.cruise * Math.pow(10, (t - EX.boostStart) / (EX.boostEnd - EX.boostStart));
  return Math.min(11000, EX.cruise * 10 * Math.pow(1.25, t - EX.boostEnd));
}

class ElevatorScene {
  // route: 0=1F→13F 1=13F→37F 2=37F→99F 3=99F→展望台（高速）/ mirrored: かご側を左に（5Hは左の出口から乗る）
  constructor(route, opts) {
    this.route = route; this.express = route === 3; this.mirrored = !!opts.mirrored; this.done = opts.done;
    this.spec = M.ELEV_SPEC; this.t = 0; this.cues = {}; this.end = this.express ? EX.end : 14;
    this.dist = 0; this.speed = 0;   // 高速エレベーターの高度（px）と速さ（px/秒）。update で積分する
    this.im = (k) => M.bg('elev_' + k);
    const S = M.ELEV_SRC, map = (pts, r, s) => pts.map(([x, y]) => [r[0] + x / s[0] * r[2], r[1] + y / s[1] * r[3]]);
    const C = this.spec.connection.doorAnimation;
    this.buildingDoor = map(C.wallSourcePolygon, WALL, S.wall_side_closed);
    this.cabinDoor = map(C.cabinSourcePolygon, CABIN, S.cabin_closed);
    this.mika = { x: 82, face: 1, anim: new M.Anim('idle', { loop: true }), walking: false };
    this.robot = { x: 57, face: 1, anim: new M.Anim('robot_idle', { loop: true }), walking: false };
    this.texts = [];
  }
  update(dt) {
    this.t += dt / 1000;
    const t = this.t;
    M.Audio.update(dt);
    if (!this.express) {
      if (t >= 2.0) this.cue('close', () => M.Audio.play('elev_door'));   // 扉が閉まる
      if (t >= 11.0) this.cue('open', () => M.Audio.play('elev_door', { gain: 0.8 }));   // 止まって扉が開く
      this.moveLoop(t >= 2.8 && t < 10.8, 1);
      if (t >= 2.9) this.cue('ue', () => { M.Audio.play('elev_ue'); this.duck(true); });   // 2026-10-11 扉が閉まったら「上に参ります」
      if (t >= 4.6) this.cue('uee', () => this.duck(false));
      if (t >= 10.8) this.cue('stop', () => M.Audio.play('elev_stop'));   // 着いた階で止まる音（2026-10-11 新しい停止音）
      if (t >= 11.1) this.cue('floor', () => { M.Audio.play(['elev_13f', 'elev_37f', 'elev_99f'][this.route]); this.duck(true); });   // 階の案内
      if (t >= 12.9) this.cue('floore', () => this.duck(false));
    } else {
      this.speed = exSpeed(t); this.dist += this.speed * dt / 1000;
      if (t >= EX.close) this.cue('close', () => M.Audio.play('elev_door'));
      this.moveLoop(t >= EX.move && t < EX.black, 1 + Math.min(0.8, this.speed / 8000));   // 加速に合わせて高く
      if (t >= EX.ue) this.cue('ue', () => { M.Audio.play('elev_ue'); this.duck(true); });
      if (t >= EX.tenboudai) this.cue('v1', () => { M.Audio.play('elev_tenboudai'); this.duck(true); });   // 動きながら案内
      if (t >= EX.tenboudai + 8.9) this.cue('v1e', () => this.duck(false));
      if (t >= EX.topspeed) this.cue('v2', () => { M.Audio.play('elev_topspeed'); this.duck(true); });
      if (t >= EX.topspeed + 2.8) this.cue('v2e', () => this.duck(false));
      if (t >= EX.launch) this.cue('shu', () => M.Audio.play('elev_shuiin'));
    }
    if (this.restore != null && M.Audio.bgmGain) {
      this.restore = Math.min(1, this.restore + dt / 900);
      M.Audio.bgmGain.gain.value = M.Audio.bgmVolume * mix(0.25, 1, this.restore);
      if (this.restore >= 1) this.restore = null;
    }
    for (const a of [this.mika, this.robot]) a.anim.update(dt);
    if (t >= this.end && !this.finished) { this.finished = true; if (M.Audio.bgmGain) M.Audio.bgmGain.gain.value = M.Audio.bgmVolume; this.done && this.done(); }
  }
  // 2026-10-11 上昇中の走行音（ELEVAORMOVE_LOOP）。on の間ループし続け、外れたら切る
  moveLoop(on, rate) {
    if (on) {
      if (!this.mv || this.mv.ended) this.mv = M.Audio.play('elev_move', { loop: true }); else M.Audio.touchLoop(this.mv);
      const v = this.mv; if (v && v.s) v.s.playbackRate.value = rate; if (v && v.el) { v.el.playbackRate = rate; v.el.preservesPitch = false; }
    } else if (this.mv) { M.Audio.stopLoop(this.mv); this.mv = null; }
  }
  cue(id, fn) { if (!this.cues[id]) { this.cues[id] = true; fn(); } }
  // アナウンスの間だけBGMを下げる（4B到着のアナウンスと同じ -12dB）
  duck(on) { if (!M.Audio.bgmGain) return; if (on) { this.restore = null; M.Audio.bgmGain.gain.value = M.Audio.bgmVolume * 0.25; } else this.restore = 0; }

  // ------------------------------------------------ 描画（v004 レンダラーと同じ時間配分・位置）
  floorY(x) {
    if (x < 97) return 175;
    if (x < 111) return mix(175, 173, (x - 97) / 14);
    if (x < 137) return mix(173, 172.3, (x - 111) / 26);
    if (x < 154) return mix(172.3, 176, (x - 137) / 17);
    if (x < 185) return mix(176, 183, (x - 154) / 31);
    return 183;
  }
  poly(p) { const c = M.ctx; c.beginPath(); p.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); }
  clipExcept(p) { const c = M.ctx; c.beginPath(); c.rect(-400, -500, 1200, 1500); p.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.clip('evenodd'); }
  leaves(im, r, p, open) {
    if (open <= 0) return;
    const c = M.ctx, [a, b, cc, d] = p, mt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], mb = [(cc[0] + d[0]) / 2, (cc[1] + d[1]) / 2];
    for (const [leaf, sg] of [[[a, mt, mb, d], -1], [[mt, b, cc, mb], 1]]) {
      c.save(); this.poly(p); c.clip(); c.translate(sg * open * (b[0] - a[0]) / 2, sg * open * (b[1] - a[1]) / 2); this.poly(leaf); c.clip(); c.drawImage(im, ...r); c.restore();
    }
  }
  actor(a, isRobot, panic) {
    const c = M.ctx, x = a.x, feet = this.floorY(x), t = this.t;
    c.save(); c.translate(x, feet);
    if (panic) c.rotate((isRobot ? 1 : -1) * (0.075 + 0.035 * Math.sin(t * 16)));   // 傾きの支点は足
    const name = isRobot ? (a.walking ? 'robot_move' : 'robot_idle') : (a.walking ? 'walk' : 'idle');
    if (a.anim.name !== name) a.anim.set(name, { loop: true });
    M.drawAnim(name, a.anim.i, 0, 0, isRobot ? (panic ? a.face < 0 : a.face > 0) : a.face > 0);
    c.restore();
    if (panic) { const p = c.getTransform().transformPoint(new DOMPoint(x, feet - 53)); this.texts.push([isRobot ? '!' : '!?', p.x, p.y]); }
  }
  drawCity(floor, distance, speed) {
    const c = M.ctx, city = this.im('city'), s = city.width / M.ELEV_SRC.city[0];
    c.drawImage(city, 167 * s, 0, city.width - 167 * s, 180 * s, 0, 0, W, H);   // 固定の空（沈む街並みの上を埋める）
    const a = this.express ? Math.min(1.6, distance / 22000) : clamp((floor - 1) / 98);
    for (const L of this.spec.parallax.layers) {
      const im = this.im(L.asset), [x, y, w, h] = L.drawRect, dy = a * L.downwardPixelsAt99F;
      if (L.cropLeft) c.drawImage(im, L.cropLeft * s, 0, im.width - L.cropLeft * s, im.height, x, y + dy, w, h);
      else c.drawImage(im, x, y + dy, w, h);
    }
    if (this.express) this.drawSkyHigh(distance);
    if (this.express && speed > 100) {
      const k = clamp(speed / 2800); c.save(); c.globalAlpha = 0.08 + 0.2 * k;
      for (let i = 0; i < 28; i++) { const x = 135 + (i * 37) % 246, y = ((i * 43 + distance * 0.2) % 320) - 80; c.fillStyle = i % 3 ? '#79b8ff' : '#f3d18b'; c.fillRect(x, y, 1 + i % 2, 10 + k * 85); }
      c.restore();
    }
  }
  // 高速: 街が沈みきったら青い空（4面の空）に変わり、雲の層を下へ突き抜け、雲の上へ
  drawSkyHigh(distance) {
    const c = M.ctx, sky = M.bg('4_sky_clean'), clouds = M.bg('4_clouds');
    const k = clamp((distance - (EX.cloudFrom + 1200)) / 2600);   // 夜の街→雲の上の青空は、雲の中（白くかすむ間）で入れ替える
    if (sky && k > 0) { c.globalAlpha = k; c.drawImage(sky, 0, 0, W, H); c.globalAlpha = 1; }
    if (clouds && distance > EX.cloudFrom - 3000) {
      // 雲の層: 上から入って下へ抜ける（速さに合わせて流れる）。抜けた後は足元の雲海として下に残る
      const p = (distance - EX.cloudFrom) / (EX.cloudTo - EX.cloudFrom);
      const y = Math.min(H - 70, -H + p * (H * 2));
      for (let x = 0; x < W; x += clouds.width) c.drawImage(clouds, x, Math.round(y));
      if (p < 1) for (let x = 0; x < W; x += clouds.width) c.drawImage(clouds, x, Math.round(y) - H);
    }
  }
  drawWall(distance, speed, open, stopped) {
    const c = M.ctx, im = this.im('wall_side_closed'), off = 8 + (distance % 216 + 216) % 216;
    c.save(); c.beginPath(); c.rect(0, 0, 130, H); c.clip();
    if (stopped && open > 0) this.clipExcept(this.buildingDoor);
    for (let k = -2; k <= 1; k++) c.drawImage(im, 0, k * 216 + off, 130, 216);
    // 2026-10-11 高速時は縦のブレを重ねる（1コマで数十px動くと窓の繰り返しがチラついて逆向きに見えるため、流れて見えるように）
    if (this.express && speed > 300) {
      const d = Math.min(48, speed / 55);
      for (const [f, a] of [[0.33, 0.45], [0.66, 0.3], [1, 0.18]]) {
        c.globalAlpha = a; for (let k = -2; k <= 1; k++) c.drawImage(im, 0, k * 216 + off - d * f, 130, 216);
      }
      c.globalAlpha = 1;
    }
    c.restore();
    if (stopped && open > 0) { c.fillStyle = '#030407'; this.poly(this.buildingDoor); c.fill(); this.leaves(im, WALL, this.buildingDoor, open); }
    if (this.express && speed > 500) { c.fillStyle = 'rgba(141,175,205,.14)'; for (let x = 5; x < 98; x += 13) c.fillRect(x, 0, 2, H); }
  }
  drawCabin(open, panic, launchY, jitter) {
    const c = M.ctx, cab = this.im('cabin_closed');
    c.save(); c.translate(0, launchY + jitter);
    c.save(); if (open > 0) this.clipExcept(this.cabinDoor); c.drawImage(cab, ...CABIN); c.restore();
    if (open > 0) { c.fillStyle = '#05070b'; this.poly(this.cabinDoor); c.fill(); this.leaves(cab, CABIN, this.cabinDoor, open); }
    // 閉扉の間、キャラはかごの中だけに見える。開扉中は側面の開口も通る
    c.save(); c.beginPath(); c.rect(169, 46, 70, 139);
    if (open > 0.1) {
      this.buildingDoor.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath();
      this.cabinDoor.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.rect(110, 127, 61, 52);
    }
    c.clip();
    this.actor(this.robot, true, panic); this.actor(this.mika, false, panic);
    c.restore();
    for (const x of [this.mika.x, this.robot.x]) if (x >= 158) { c.fillStyle = 'rgba(0,0,0,.30)'; c.beginPath(); c.ellipse(x, this.floorY(x), 8, 1.5, 0, 0, Math.PI * 2); c.fill(); }
    // ガラスの柱と下の金色の縁は人物より手前
    c.save(); c.beginPath(); c.rect(234, 36, 22, 151); c.rect(156, 36, 16, 151); c.rect(126, 0, 135, 48); c.rect(126, 187, 135, 25); c.clip(); c.drawImage(cab, ...CABIN); c.restore();   // 2026-10-11 左手前の金の柱（x156〜172）も人物より手前に（行末コメントに処理が入り込み、save が戻らず反転が残っていたのを修正）
    c.restore();
  }
  draw() {
    const c = M.ctx, R = this.spec.routes[this.route], t = clamp(this.t, 0, this.express ? EX.end : 14);
    let board = 0, exit = 0, open = 1, travel = 0, distance = 0, speed = 0, panic = false, launchY = 0, black = 0;
    if (!this.express) {
      if (t < 2) board = t / 2;
      else if (t < 2.8) { board = 1; open = 1 - (t - 2) / 0.8; }
      else if (t < 10.8) { board = 1; open = 0; travel = smooth((t - 2.8) / 8); }
      else if (t < 11.6) { board = 1; travel = 1; open = (t - 10.8) / 0.8; }
      else { board = 1; travel = 1; exit = clamp((t - 11.6) / 2); }
      distance = travel * (R.toFloor - R.fromFloor) * 216;
    } else {
      if (t < 2) board = t / 2;
      else if (t < 2.8) { board = 1; open = 1 - (t - 2) / 0.8; }
      else { board = 1; open = 0; }
      distance = this.dist; speed = this.speed; panic = t >= EX.panic;
      if (t >= EX.launch) { const p = clamp((t - EX.launch) / 1.1); launchY = -340 * p * p; }   // 雲の上へすっ飛ぶ
      if (t >= EX.black) black = clamp((t - EX.black) / 1.0);
      // 雲の中は白くかすむ
      const cp = (distance - EX.cloudFrom) / (EX.cloudTo - EX.cloudFrom);
      if (cp > 0 && cp < 1) this.fog = Math.sin(cp * Math.PI) * 0.85; else this.fog = 0;
    }
    const floor = this.express ? 99 : mix(R.fromFloor, R.toFloor, travel);
    // 乗る（右へ）→ 降りる（左のビルへ）。歩いている間は歩きのアニメ
    let mx = mix(82, 185, board), rx = mix(57, 219, clamp(board * 1.25 - 0.25));
    if (exit > 0) { mx = mix(185, 65, exit); rx = mix(219, 65, clamp(exit * 1.25 - 0.25)); }
    for (const [a, x] of [[this.mika, mx], [this.robot, rx]]) {
      const dx = x - a.x; a.walking = Math.abs(dx) > 0.01; if (a.walking) a.face = dx > 0 ? 1 : -1; else if (!exit) a.face = 1; a.x = x;
    }
    c.save();
    c.imageSmoothingEnabled = false; c.fillStyle = '#07152d'; c.fillRect(0, 0, W, H);
    this.drawCity(floor, distance, speed);
    c.save(); if (this.mirrored) { c.translate(W, 0); c.scale(-1, 1); }
    // 2026-10-11 高速でも縮小しない（0.82倍だとビルの壁が画面の上下・端に届かず、小さな箱が揺れて見えて上昇感が出なかった）
    const stopped = (!this.express && (travel === 0 || travel === 1)) || (this.express && t < EX.move);
    this.texts = [];
    this.drawWall(distance, speed, open, stopped);
    if (stopped && open > 0.1) { const wi = this.im('wall_side_closed'), sx = wi.width / M.ELEV_SRC.wall_side_closed[0], sy = wi.height / M.ELEV_SRC.wall_side_closed[1]; c.drawImage(wi, 660 * sx, 1378 * sy, 100 * sx, Math.max(1, 15 * sy), 110, 173, 28, 3); }   // 敷居（同じ壁画像の石・金属部分）
    this.drawCabin(open, panic && t < EX.launch + 1.2, launchY, this.express && speed > 500 && t < EX.launch ? Math.sin(t * 46) * (0.65 + Math.min(1.2, speed / 6000)) : 0);
    c.restore();
    // 焦りの !?（反転しない）。座標は transformPoint で画面の座標にしてあるので、変換を外して描く（反転が残っていて「?!」の鏡文字になっていた）
    c.save(); c.resetTransform(); for (const [s, x, y] of this.texts) M.text(s, Math.round(x) - 4, Math.round(y), { color: '#ffe174' }); c.restore();
    if (this.express && this.fog > 0) { c.fillStyle = `rgba(235,242,250,${this.fog})`; c.fillRect(0, 0, W, H); }
    if (black > 0) { c.fillStyle = `rgba(0,0,0,${black})`; c.fillRect(0, 0, W, H); }
    // 場面の入りと終わりは暗転でつなぐ
    const fin = Math.min(1, this.t / 0.6), fout = this.express ? 0 : clamp((this.t - (this.end - 0.7)) / 0.7);
    const k = Math.max(1 - fin, fout);
    if (k > 0) { c.fillStyle = `rgba(0,0,0,${k})`; c.fillRect(0, 0, W, H); }
    c.restore();
  }
}
M.ElevatorScene = ElevatorScene;
})();
