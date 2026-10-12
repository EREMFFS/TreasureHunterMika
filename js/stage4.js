// stage4.js — 4面 空中鉄道777（2026-10-09 MIKA_STAGE4AB_ALL_IN_ONE_v001）
//   4A 屋根・4B 車両の背景は data/stage_maps.json の layers（空・雲ループ＋列車／車内、ガタンゴトンは表示だけ）
//   ここでは 4B の終わり「到着演出 v006」: 全滅 → アナウンス全編 → 車内から空→遠くの街→街の上→駅へ斜めに降下
//   → 着陸直前に汽車の外観 → 線路にガシャン → 車内へ戻って12秒で減速・停車 → 到着を見せて 4C へ
//   時間は arrival_spec.json（arrival_controller.js の sampleArrival を移植）。数値は初期案
'use strict';
(function () {
const M = window.MIKA, T = M.TUNING;
const { clamp } = M;
const VOICE_END = 23.769773;
const PRE_WAIT_MS = 2000;
const MIKA_TRAIN = [4, 22.5];   // 2026-10-12 v102 ミカの声（アナウンスの終わりからの秒）
const HALT_S = 4.09;   // 2026-10-12 v101 SE_TRAIN_STOP の長さ（鳴り終わってから暗転して4Cへ）   // 2026-10-11 最後の雑魚が消えてからアナウンス（ピンポーン）まで。ミカたちは止まって待つ
const A = T.arrival = Object.assign({
  bgmDuck: 0.25,          // 声の間のBGM（-12dB）
  bgmRestoreMs: 500,
  skyColor: '#2fa9fe',    // 空の画像の下端の色（窓の下側に見える）
  railsY: 176, trainX: 32,
  stationStopX: 800,      // 停車した時に窓から見える駅の位置（station_approach_long の x）
}, T.arrival || {});

// arrival_controller.js の sampleArrival（v006）をそのまま移植
function sample(t, fadeStart) {
  t = Math.max(0, t);
  const d = t - VOICE_END, u = clamp(d / 38, 0, 1), cityProgress = clamp((d - 6) / 24, 0, 1), near = clamp((d - 29) / 9, 0, 1), tau = clamp(d - 38.65, 0, 12);
  const brakeDistance = 288 * (tau - tau * tau / 24), distance = 288 * Math.min(t, VOICE_END + 38.65) + brakeDistance;
  let shakeY = 0;
  if (d >= 38 && d < 38.32) shakeY = [5, -4, 3, -2, 1, -1, 0, 0][Math.min(7, Math.floor((d - 38) / 0.04))];
  if (d >= 50.65 && d < 50.81) shakeY = [1, -1, 0, 0][Math.min(3, Math.floor((d - 50.65) / 0.04))];
  return {
    d, distance, brakeDistance, windowRise: Math.round(130 * u), cityProgress, cityScale: 0.65 + 0.55 * cityProgress,
    cityY: Math.round(130 - 160 * cityProgress), cityOffset: Math.max(0, d - 6) * 35,
    near, stationX: Math.round(620 * (1 - near) - brakeDistance * 0.3), stationY: Math.round(90 * (1 - near)),
    trainY: Math.round(20 + 76 * u * u), showExterior: d >= 35 && d < 38.65, backMix: d >= 38.65 ? 1 : 0,
    // 2026-10-11 v039: 雲は高度とともに上へ抜けて薄くなり、外観へ切り替わる前（d=34）に通過し終える。車内と外観で同じ値を使う
    cloudAlpha: 1 - clamp((d - 24) / 10, 0, 1), cloudLift: Math.round(150 * clamp((d - 20) / 14, 0, 1)),
    // カメラの切替（車内→外観 d=35、外観→車内 d=38.65）は短い暗転でつなぐ（人物も含めた画面全体）
    blackout: Math.max(0, 1 - Math.abs(d - 35) / 0.3, 1 - Math.abs(d - 38.65) / 0.3),
    landed: d >= 38, braking: d >= 38.65, stopped: d >= 50.65, shakeY,
    fade: clamp((t - fadeStart) / 0.4, 0, 1),
  };
}

// 2026-10-11 v040: 到着演出用の空（雲・街の焼き込みなし）
M.BG['4_sky_clean'] = { file: 'assets/bg_4_sky_clean.webp', size: [768, 216] };
M.mapHooks = M.mapHooks || {};

// ================================================================== 4A 空を横切る飛来物（MIKA_STAGE4A_FLYBY_v044 sky_flyby.js を移植）
//   当たり判定・得点・音なしの飾り。雲の手前・列車とキャラの奥（map.layers の {fx:'flyby'} の位置）に、画面座標で描く
const FLY = {
  airship:   { files: ['airship'], size: [80, 56], weight: 3, speed: [300, 430], y: [48, 104] },
  bird:      { files: ['bird_00', 'bird_01', 'bird_02'], size: [40, 40], weight: 5, speed: [520, 740], y: [46, 112] },
  star_ring: { files: ['star_ring'], size: [72, 72], weight: 1, speed: [470, 650], y: [72, 98] },
  balloons:  { files: ['balloons'], size: [56, 64], weight: 2, speed: [380, 560], y: [65, 94] },
};
for (const t of Object.values(FLY)) for (const f of t.files) M.BG['fly_' + f] = { file: 'assets/bg_fly_' + f + '.webp', size: t.size };
const FLY_CFG = { first: 2000, gap: [5000, 9000], max: 2, dir: -1 };   // 開始2秒後、5〜9秒ごと、同時2個まで。雲と同じく右から左
class SkyFlyby {
  constructor() { this.items = []; this.timer = FLY_CFG.first; this.clock = 0; }
  choose() { let n = Math.random() * 11; for (const [k, t] of Object.entries(FLY)) { n -= t.weight; if (n < 0) return k; } return 'bird'; }
  spawn(key) {
    if (this.items.length >= FLY_CFG.max) return;
    const t = FLY[key], d = FLY_CFG.dir, r = (a) => a[0] + (a[1] - a[0]) * Math.random();
    this.items.push({ key, x: d < 0 ? M.W + t.size[0] / 2 : -t.size[0] / 2, y: r(t.y), speed: r(t.speed), scale: 0.8 + 0.2 * Math.random(), phase: Math.random() * 240, dir: d });
  }
  update(dt) {
    dt = Math.max(0, Math.min(100, dt)); this.clock += dt; this.timer -= dt;
    if (this.timer <= 0) { this.spawn(this.choose()); this.timer = FLY_CFG.gap[0] + (FLY_CFG.gap[1] - FLY_CFG.gap[0]) * Math.random(); }
    for (const p of this.items) p.x += p.dir * p.speed * dt / 1000;
    this.items = this.items.filter((p) => p.x > -100 && p.x < M.W + 100);
  }
  draw() {
    const ctx = M.ctx; ctx.save(); ctx.imageSmoothingEnabled = false;
    for (const p of this.items) {
      const t = FLY[p.key], idx = p.key === 'bird' ? [0, 1, 2, 1][Math.floor((this.clock + p.phase) / 80) % 4] : 0;   // 鳥は羽ばたき 0→1→2→1（各80ms）
      const im = M.bg('fly_' + t.files[idx]); if (!im) continue;
      const w = t.size[0] * p.scale, h = t.size[1] * p.scale, bob = p.key === 'bird' ? 0 : Math.sin((this.clock + p.phase) / 500) * 1.2;
      ctx.save(); ctx.translate(Math.round(p.x), Math.round(p.y + bob)); if (p.dir > 0) ctx.scale(-1, 1);
      ctx.drawImage(im, Math.round(-w / 2), Math.round(-h / 2), Math.round(w), Math.round(h)); ctx.restore();
    }
    ctx.restore();
  }
}
M.layerFx = M.layerFx || {};
M.layerFx.flyby = (w) => { if (w.flyby) w.flyby.draw(); };
// ================================================================== 4A→4B 屋根の奥へ飛び込む（MIKA_STAGE4A_TO4B_JUMP_INSTRUCTION_v048）
//   GO→出口（右端の手前）でミカとロボを止めて自動演出。ミカが屋根の奥の縁へジャンプ→縁の向こうへ落ちて屋根に隠れる→ロボも続く
//   →隠れきってから暗転→4Bで天井から降りて着地。屋根の手前に描き直す遮蔽は飛び込み中だけ
const RJ = {
  gatherMs: 260, jumpMs: 760, robotDelay: 120, afterMs: 100, fadeMs: 220,
  edgeY: 143,          // 屋根の奥側の縁（画面y）。これより下は屋根の絵で隠す
  backY: 138,          // 飛び込んだ先の足元（縁の少し奥）
  apex: 40, sink: 92,  // 頂点の高さ・縁の向こうへ沈む深さ（全身が隠れる）
};
function roofPath(p) {   // 0〜1 → { dx, y, z }（足元の奥行き y と 高さ z を分けて動かす）
  const up = 0.42;
  const y = p < up ? 155 + (RJ.backY - 155) * (p / up) : RJ.backY;
  const z = p < up ? RJ.apex * Math.sin((p / up) * Math.PI / 2) : RJ.apex - (RJ.apex + RJ.sink) * Math.pow((p - up) / (1 - up), 1.6);
  return { dx: 26 * p, y, z };
}
M.mapHooks['4A'] = {
  init(w) { if (w.kind === 'main') w.flyby = new SkyFlyby(); },   // マップに入るたびに作り直す（4Aを出れば消える）
  startRoofJump(w) {
    if (w.roofJump || w.exiting) return;
    const m = w.mika, r = w.robot, ex = w.map.exit;
    w.roofJump = { t: 0, jx: ex.x, m0: [m.x, m.y], r0: [r.x, r.y], robotBroken: r.state === 'broken' };
    w.cutscene = true; w.lockInput = true; w.timerRunning = false; w.holdAttacks = true; w.go = null;
    for (const p of w.projectiles) p.remove = true;
    m.endWeaponHold(); m.vx = 0; m.z = 0; m.face = 1; m.setState('scripted', 'walk');
    r.face = 1; r.z = 0; r.setState('scripted', 'robot_move', { loop: true });   // 壊れていても一緒に連れていく（置き去りで止まらないように）
  },
  update(w, dt) {
    if (M.game && M.game.paused) return;
    if (w.flyby) w.flyby.update(dt);
    const J = w.roofJump; if (!J || J.done) return;
    J.t += dt;
    const m = w.mika, r = w.robot, t = J.t;
    // 1) 出口へ寄せる
    const g = Math.min(1, t / RJ.gatherMs);
    const mx0 = J.jx - 22, rx0 = J.jx - 62;
    if (t < RJ.gatherMs) {
      m.x = J.m0[0] + (mx0 - J.m0[0]) * g; m.y = J.m0[1] + (155 - J.m0[1]) * g;
      r.x = J.r0[0] + (rx0 - J.r0[0]) * g; r.y = J.r0[1] + (160 - J.r0[1]) * g;
      m.anim.update(dt); r.anim.update(dt);
      return;
    }
    // 2) ミカが踏み切って屋根の奥へ。ロボは120ms遅れて同じ経路
    const step = (a, x0, y0, t0, isMika) => {
      const p = Math.max(0, Math.min(1, (t - t0) / RJ.jumpMs));
      if (p <= 0) { a.anim.update(dt); return 0; }
      if (!a.jumped) { a.jumped = true; if (isMika) { a.setState('scripted', 'jump'); M.Audio.play('jump'); } else M.Audio.play('jump', { robot: true }); a.noShadow = false; }
      const P = roofPath(p);
      a.x = x0 + P.dx; a.y = isMika ? P.y : P.y + 2; a.z = P.z;
      if (isMika) a.anim.i = p < 0.12 ? 0 : p < 0.3 ? 1 : p < 0.42 ? 2 : p < 0.7 ? 3 : 4;
      else a.anim.update(dt);
      if (P.y < RJ.edgeY) a.noShadow = true;   // 縁の向こうへ出たら影は消す（屋根の上に影が残らない）
      return p;
    };
    const pm = step(m, mx0, 155, RJ.gatherMs, true);
    const pr = step(r, rx0 + 18, 160, RJ.gatherMs + RJ.robotDelay, false);
    J.hidden = pm >= 1 && pr >= 1;
    if (J.hidden) {
      J.after = (J.after || 0) + dt;
      if (J.after >= RJ.afterMs && !J.leaving) {
        J.leaving = true;
        w.transition(() => {
          if (J.robotBroken) w.robot.state = 'broken';   // 壊れたまま4Bへ（修理の残り時間も引き継ぐ）
          w.saveCarry(false);
          M.setScene(new M.World(w.map.exit.to, { run: w.run, entry: 'map', roofDrop: true, onDone: w.onDone, onGameOver: w.onGameOver }));
        }, { music: false, fadeMs: RJ.fadeMs });   // 4A・4Bは同じ曲を続ける（頭出ししない）
      }
    }
  },
  // 屋根の縁より下を屋根の絵で描き直して、縁の向こうへ落ちた体を隠す（飛び込み中だけ。揺れも列車の層と同じ値）
  drawFront(w) {
    const J = w.roofJump; if (!J) return;
    const L = w.map.layers.find((l) => l.bg === '4A_train'), im = L && M.bg(L.bg); if (!im) return;
    const ctx = M.ctx, clk = M.clock4 || 0, sy = L.shake ? L.shake[Math.floor(clk / 1000 * (L.shakeHz || 8)) % L.shake.length] : 0;
    const xs = [w.mika, w.robot].filter((a) => a.y < RJ.edgeY).map((a) => a.x - w.camX);
    if (!xs.length) return;
    const x0 = Math.floor(Math.min(...xs) - 60), x1 = Math.ceil(Math.max(...xs) + 60);
    ctx.save(); ctx.beginPath(); ctx.rect(x0, RJ.edgeY + sy, x1 - x0, M.H - RJ.edgeY); ctx.clip();
    ctx.drawImage(im, -Math.round(w.camX), (L.y || 0) + sy);
    ctx.restore();
  },
};
M.mapHooks['4B'] = {
  init(w) {
    if (w.kind !== 'main') return;
    w.hookDrawBack = () => (w.arrival ? drawArrivalBack(w) : false);
  },
  // 2026-10-11 全滅してすぐではなく、最後の雑魚の爆発・消滅が終わってから2秒待ってアナウンスを始める（待つ間は操作できない）
  startArrival(w) {
    if (w.arrival || w.arrivalWait != null) return;
    w.arrivalWait = 0; w.lockInput = true; w.timerRunning = false; w.holdAttacks = true;
    const m = w.mika; m.endWeaponHold(); m.vx = 0;
  },
  beginArrival(w) {
    if (w.arrival) return;
    const m = w.mika, r = w.robot;
    w.arrival = { t: 0, voiceDone: false, cloudBase: (M.clock4 || 0) * 0.288, fadeStart: Infinity, cues: {} };
    w.lockInput = true; w.cutscene = true; w.timerRunning = false; w.holdAttacks = true;
    for (const p of w.projectiles) p.remove = true;
    m.endWeaponHold(); m.z = 0; m.vx = 0;
    if (!['defeated'].includes(m.state)) m.setState('idle', 'idle');
    m.face = 1; m.coolPose = true;   // 腕を組んで右を見据える（到着演出だけ）
    if (r && r.state !== 'broken') { r.setState('idle', 'robot_idle', { loop: true }); r.face = 1; }
    // アナウンス（全編を聞かせる）。BGMは声の間だけ下げる
    const v = M.Audio.play('announce');
    w.arrival.voice = v;
    M.Audio.bgmLevel(A.bgmDuck);
  },
  update(w, dt) {
    const paused = M.game && M.game.paused;
    if (paused) return;
    // 2026-10-11 v048: 4Aの屋根から飛び込んで来た → 天井（画面の上）から短く降りて着地。着地してから操作・敵・TIMEを再開
    const RD = w.roofDrop;
    if (RD) {
      RD.t += dt;
      const fall = (a, t0) => {
        const p = Math.max(0, Math.min(1, (RD.t - t0) / 320));
        a.z = 150 * (1 - p * p); a.anim.update(dt);
        if (a === w.mika) a.anim.i = 4;
        if (p >= 1 && !a.landed) { a.landed = true; a.z = 0; M.Audio.play('land', { robot: a !== w.mika }); if (a === w.mika) a.setState('idle', 'idle'); else a.setState(a.hp > 0 ? 'idle' : 'broken', a.hp > 0 ? 'robot_idle' : 'robot_broken', { loop: a.hp > 0, hold: a.hp <= 0 }); }
        return p;
      };
      const a = fall(w.mika, 0), b = fall(w.robot, 120);
      if (a >= 1 && b >= 1 && RD.t >= 600) { w.roofDrop = null; w.cutscene = false; w.mika.landed = w.robot.landed = false; w.onEntranceDone(); }
      return;
    }
    if (!w.arrival && w.arrivalWait != null) {
      const busy = w.enemies.length > 0 || w.effects.some((e) => e.anim && /explosion/.test(e.anim.name || ''));
      w.arrivalWait = busy ? 0 : w.arrivalWait + dt;
      const m = w.mika; w.lockInput = true;   // 待つ間は動かせない（他の処理で戻されても毎フレーム止める）
      if (m.z <= 0 && ['walk', 'run', 'dash'].includes(m.state)) m.setState('idle', 'idle');   // 歩いていたら止める
      if (w.arrivalWait >= PRE_WAIT_MS) this.beginArrival(w);
      return;
    }
    const S = w.arrival; if (!S) return;
    // 2026-10-11 降下の開始は場面の時計で決める（声の長さ23.77秒が来たら始める）。
    //   以前は「音が鳴り終わった」知らせを待って時計を止めていたため、ファイルを直接開いた時など知らせが遅れる環境で、
    //   声が終わった後に景色も人も止まったまま待つ（フリーズして見える）ことがあった
    if (!S.voiceDone && (S.t >= VOICE_END * 1000 || (S.voice && S.voice.ended && S.t > 3000))) {
      S.voiceDone = true; S.restoreT = 0; S.t = Math.max(S.t, VOICE_END * 1000);
    }
    S.t += dt;
    // 2026-10-12 v132 不具合修正: アナウンスが終わったら下げていたBGMを0.5秒で元に戻す（前は戻す処理がなく、4C・ボス戦まで小さいままだった）
    if (S.restoreT != null && S.restoreT < A.bgmRestoreMs) {
      S.restoreT = Math.min(A.bgmRestoreMs, S.restoreT + dt);
      const k = S.restoreT / A.bgmRestoreMs; M.Audio.bgmLevel(A.bgmDuck + (1 - A.bgmDuck) * k);
    }
    // 2026-10-12 v101: 完全に止まった時の音（train_halt）が鳴り終わってから暗転（前は止まって2秒後）
    if (S.voiceDone && S.cues.halt && S.t / 1000 >= VOICE_END + 50.65 + HALT_S + 0.2 && !isFinite(S.fadeStart)) S.fadeStart = S.t / 1000;
    const st = (S.st = sample(S.t / 1000, S.fadeStart));
    w.extraShakeY = st.shakeY;
    w.hideActors = st.showExterior;
    // 切替の暗転（w.fade で画面全体に。退出の暗転とは重ならない時間帯）
    if (st.blackout > 0 && !w.exiting) { w.fade = { a: st.blackout, dir: 0 }; S.blk = true; }
    else if (S.blk && !w.exiting) { w.fade = { a: 0, dir: 0 }; S.blk = false; }
    // 走行音: アナウンスの後に降下音を一度。減速の間は車内の走行音を遅く小さくして、止まったら消す
    if (S.voiceDone && !S.cues.descent) { S.cues.descent = true; M.Audio.play('train_descent'); }
    // 2026-10-12 v102 ミカの声: アナウンスの4秒後に01、窓から町が見える直前（町は d=24 ごろから）に02
    if (S.voiceDone && st.d >= MIKA_TRAIN[0] && !S.cues.mt1) { S.cues.mt1 = true; M.Audio.play('mika_train1'); }
    if (S.voiceDone && st.d >= MIKA_TRAIN[1] && !S.cues.mt2) { S.cues.mt2 = true; M.Audio.play('mika_train2'); }
    const v = w.ambV;
    if (v && st.braking) {
      const k = clamp((st.d - 38.65) / 12, 0, 1);
      if (v.s) v.s.playbackRate.value = 1 - 0.55 * k;
      if (v.g) v.g.gain.value = (M.AUDIO.seMix.train_inside.gain) * (1 - k);
      if (v.el) { v.el.playbackRate = Math.max(0.5, 1 - 0.55 * k); v.el.volume = Math.max(0, M.Audio.seVolume * 0.7 * (1 - k)); }
      if (k >= 1) { w.ambientOff = true; M.Audio.stopLoop(v); }
    }
    if (st.landed && !S.cues.land) { S.cues.land = true; M.Audio.play('train_chakluti'); }   // 2026-10-12 v101 線路に触れた瞬間（前は着地音＋重い着地音）
    if (st.stopped && !S.cues.halt) { S.cues.halt = true; M.Audio.play('train_halt'); }     // 2026-10-12 v101 完全に止まった
    if (st.braking && !S.cues.brake) { S.cues.brake = true; M.Audio.play('train_stop'); }
    if (st.fade >= 1 && !S.cues.go) {
      S.cues.go = true;
      w.mika.coolPose = false;
      w.leave(w.map.exit.to, { fadeMs: 400 });   // 到着演出で暗転済み
    }
  },
};

// 到着演出の背景（窓の外の景色 → 車内／外観）。true を返すと通常の背景は描かない
function drawArrivalBack(w) {
  const ctx = M.ctx, S = w.arrival, st = S.st || sample(0, Infinity);
  if (st.showExterior) { drawExterior(w, st); return true; }
  drawWindowView(w, st);
  const im = M.bg('4B_interior'); if (im) ctx.drawImage(im, -Math.round(w.camX), 0);
  ctx.globalAlpha = 1;
  return true;
}
// 2026-10-11 v040: 窓の外と外観は同じ景色を同じ値で描く（空→遠くの街→雲→駅）。切替で原点をリセットしない
//   空は雲や街の焼き込みのない bg_4_sky_clean、駅は空・雲・街を抜いた透明の bg_4B_station（v040）
function drawScenery(w, st, camShift) {
  const ctx = M.ctx, S = w.arrival, rise = st.windowRise;
  ctx.fillStyle = A.skyColor; ctx.fillRect(0, 0, M.W, M.H);
  tile(M.bg('4_sky_clean') || M.bg('4_sky'), -Math.round(camShift * 0.25), -rise);
  const city = M.bg('4B_city');
  if (city && st.cityProgress > 0) {
    const sc = st.cityScale, cw = city.width * sc, ch = city.height * sc;
    ctx.save(); ctx.globalAlpha = Math.min(1, st.cityProgress * 3); ctx.imageSmoothingEnabled = false;
    let x = -((st.cityOffset % cw) + cw) % cw;
    for (; x < M.W; x += cw) ctx.drawImage(city, Math.round(x), st.cityY + 60, Math.round(cw), Math.round(ch));
    ctx.restore();
  }
  drawClouds(S, st, camShift, -rise);
  const stn = M.bg('4B_station');
  if (stn && st.near > 0) {
    const x = st.braking ? -Math.round(st.brakeDistance * A.stationStopX / 1728) : st.stationX;   // 減速しきった時に駅舎の中央のアーチが窓に来る
    ctx.drawImage(stn, Math.round(x), st.stationY);
  }
}
function drawWindowView(w, st) { drawScenery(w, st, Math.round(w.camX * 0.32)); }
// 着陸直前の汽車の外観（駅へ斜めに降りてきて線路に着く）
function drawExterior(w, st) {
  drawScenery(w, st, 0);
  // 線路（流れる）と汽車
  const off = Math.round(st.distance) % 768;
  M.drawFrame('arr_landing_rails', -off, A.railsY, [0, 0], false);
  M.drawFrame('arr_landing_rails', 768 - off, A.railsY, [0, 0], false);
  const trainY = Math.min(st.trainY, A.railsY + 4 - 84);
  M.drawFrame('arr_train_exterior', A.trainX, trainY, [0, 0], false);
  drawRearCars(A.trainX, trainY);
}
// v063: 先頭は右向き。既存客車を左（後方）へ12両つなげ、車列の終端を画面外へ。
// 先頭の位置・降下・着地・揺れは従来どおり。素材は元の客車をコピー。
let rearCarCanvas = null;
function drawRearCars(trainX, trainY) {
  if (!rearCarCanvas) {
    rearCarCanvas = document.createElement('canvas');
    rearCarCanvas.width = 320; rearCarCanvas.height = 84;
    M.drawFrameTo(rearCarCanvas.getContext('2d'), 'arr_train_exterior', 0, 0);
  }
  const carX = 8, carW = 156, ctx = M.ctx;
  // 元の最後尾の丸い端を連結部で覆う。以後は客車だけ（機関車は複製しない）。
  for (let i = 12; i >= 1; i--) {
    const x = Math.round(trainX + carX - i * carW);
    if (x + carW < 0 || x > M.W) continue;
    ctx.drawImage(rearCarCanvas, carX, 0, carW, 84, x, Math.round(trainY), carW, 84);
  }
}
// 雲: 車内・外観で同じ横の流れ（距離×0.5）と同じ高さ。降下とともに上へ抜けて薄くなり、着地前には消える
function drawClouds(S, st, camShift, y) {
  if (st.cloudAlpha <= 0) return;
  const ctx = M.ctx; ctx.save(); ctx.globalAlpha = st.cloudAlpha;
  tile(M.bg('4_clouds'), -Math.round(camShift + S.cloudBase + st.distance * 0.5), y - st.cloudLift);
  ctx.restore();
}
function tile(im, x, y) {
  if (!im) return;
  const W = im.width; x = ((x % W) + W) % W - W;
  for (; x < M.W; x += W) M.ctx.drawImage(im, x, y);
}
})();
