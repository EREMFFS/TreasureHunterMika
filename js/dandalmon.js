// dandalmon.js — 4C「デスポリス駅」ボス 巨大人面要塞ダンダルモン（2026-10-08）
//   素材: MIKA_DANDALMON_SHUTTER_INTRO_v010 / STAGE04C_DANDALMON_v003 / EYE_IMPACT_v001 / TURRETS_v002 / DEFEAT_v001
//   ・5画面目の正面シャッター（左レールごと真上へ上がる）。開くまではシャッターの中へ入れない
//   ・口レーザー（目を見開く→口を開いて溜める→左へ発射）／約3秒の追尾する目ビーム／奥・手前6基の砲台
//   ・撃破: 大笑い→装甲が割れて連続爆発→破片が飛ぶ→瓦礫
//   時間・威力・周期はすべて [仮]。T.dandalmon で調整（tuning.js に無ければ下の既定値）
'use strict';
(function () {
const M = window.MIKA, T = M.TUNING;
const { clamp, rand, sign } = M;
const W = () => M.world;
const D = T.dandalmon = Object.assign({
  idleMs: [900, 1500],          // 攻撃の間
  pattern: ['turret', 'laser', 'eyebeam', 'turret', 'laser', 'eyebeam'],   // 中ボス（5D・6C〜6E）はこのまま
  // 2026-10-11 ユーザー指定: 4Cの本ボスは口レーザーと目ビームをもっと頻繁に（砲台は6回に1回・攻撃の間も短く）
  bossPattern: ['laser', 'eyebeam', 'laser', 'turret', 'eyebeam', 'laser'],
  bossIdleMul: 0.55,
  laserEyesMs: 650, laserChargeMs: 480, laserFireMs: 700, laserAfterMs: 280, laserDmg: 10, laserHitMs: 400,
  eyeBeamMs: 6000, eyeBeamSpeed: 72,   // 2026-10-11 照射を3秒→6秒（ゆっくり追ってくる間ミカが逃げ回る）
  laserDiag: [-1, 1],             // 2026-10-11 口レーザーは正面の1本に加えて、左上45度・左下45度にも撃つ（-1=上 1=下）
  eyeBeamDmg: 3, eyeBeamHitMs: 320, eyeBeamWarnMs: 450,
  turretWarnMs: 240, turretGapMs: 160, turretShots: 2, turretShotGapMs: 150, turretSpeed: 175, turretDmg: 3,
  hurtDepthAny: true,
  score: 40000,
  // 2026-10-11 ユーザー指定: ボス以外（5D・6C〜6E）はシャッターなし。最初から鎮座していて、ミカが近づくと目覚める
  wakeDist: 90,        // 体の端からミカまでの距離（px）がこれ以下で目覚める
  wakeMs: 900,         // 目覚めの演出（目を見開いて揺れる）の長さ。終わったら攻撃を始める
}, T.dandalmon || {});
// 素材上の位置（112×168 の左上から。v003/v010/TURRETS_v002 の実測）
const P = {
  mouth: [48, 114], eye: [58, 80], eye2: [33, 80],   // 2026-10-12 v119 もう片方の目（絵の左目の瞳）
  muzzles: [[12, 44, 'far'], [66, 36, 'near'], [9, 66, 'far'], [77, 57, 'near'], [9, 93, 'far'], [88, 86, 'near']],
  body: [14, 104],      // 当たり判定の左右（素材x）
};

function spec() { return M.REF.dandIntro; }
function sx0(w) { const L = w.map.specials && w.map.specials.dand_left; return L != null ? L : w.camX + spec().boss_placement.top_left_preview[0]; }   // ボス画像左上のワールドx（5Dはv052の壁の位置 specials.dand_left）

const Boss = M.bossBase();
class Dandalmon extends Boss {
  constructor(w, s) {
    const S = spec(), feet = S.boss_placement.feet_y;
    const left = s.left != null ? s.left : sx0(w);
    super(left + 56, feet, { hp: s.hp, id: 'dandalmon', score: D.score });
    this.left = left; this.top = feet - 168;
    this.fl = !!s.flip;   // 2026-10-11 左へ進むマップ（6D）では左に置いて右向き（左右反転）
    this.bodyW = 90; this.bodyH = 160; this.shadowW = 0;
    this.face = this.fl ? 1 : -1; this.state = 'wait'; this.alpha = 1; this.lowHpBlink = true;
    this.face0 = 'dand_idle'; this.patI = 0; this.cool = 1200;
    this.rounds = []; this.sparks = []; this.frags = [];
  }
  get name() { return spec().display_name; }
  grabbable() { return false; }
  canBeHit() { return this.active && !['dying', 'wait', 'entrance'].includes(this.state); }
  hurtbox() { const a = this.X(P.body[0]), b = this.X(P.body[1]); return { x0: Math.min(a, b), x1: Math.max(a, b), y: this.y, anyDepth: true, z0: 0, z1: 160 }; }
  X(px) { return this.fl ? this.left + 112 - px : this.left + px; }   // 素材のx → ワールドx（反転対応）
  get dir() { return this.fl ? 1 : -1; }   // 攻撃の向き（通常は左）
  bodyFront() { return this.fl ? this.left + 112 - P.body[0] : this.left + P.body[0]; }   // ミカ側の体の端（ワールドx）
  pt(p) { return { x: this.X(p[0]), sy: this.top + p[1], z: this.y - (this.top + p[1]) }; }   // 素材の点 → ワールドxと画面yと高さ

  // ------------------------------------------------ 鎮座（シャッターなし）→ 近づくと目覚める
  seat(cb) { this.state = 'wait'; this.seated = true; this.noTarget = true; this.wakeCb = cb || null; this.showBar = false; }
  near() {
    const m = W().mika; if (!m) return false;
    return this.fl ? m.x - this.bodyFront() <= D.wakeDist : this.bodyFront() - m.x <= D.wakeDist;
  }
  updateWait() {
    if (!this.seated || !this.wakeCb) return;
    if (this.near()) { this.state = 'waking'; this.st = 0; W().shake = 2; M.Audio.play('elevator_stop', { rate: 0.55 }); M.Audio.play('warp', { rate: 0.6, gain: 0.7 }); }
  }
  updateWaking() {
    this.face0 = ((this.st / 90) | 0) % 2 ? 'dand_eyes' : 'dand_idle';
    if (this.st < 500) W().shake = Math.max(W().shake, 1);
    if (this.st >= D.wakeMs) { this.state = 'idle'; this.st = 0; this.face0 = 'dand_idle'; this.showBar = true; this.seated = false; this.noTarget = false; const cb = this.wakeCb; this.wakeCb = null; cb && cb(); }
  }

  // ------------------------------------------------ 登場（シャッター）
  beginEntrance(done) {
    this.doneCb = done; this.state = 'entrance'; this.st = 0; this.ent = 'rumble';
    M.Audio.play('elevator_stop', { rate: 0.55 });
  }
  updateEntrance(dt) {
    const w = W(), E = spec().entrance, sh = w.shutter;
    if (this.ent === 'rumble') {
      w.shake = 1;
      const k = Math.floor(this.st / E.look_flip_ms);   // ミカとロボがキョロキョロ
      if (!this.mid) { w.mika.face = k % 2 ? -1 : 1; w.robot.face = k % 2 ? 1 : -1; }   // 中ボスの時は操作中なので向きを変えない
      if ((this.rumbleSE = (this.rumbleSE || 0) + dt) > 330) { this.rumbleSE = 0; M.Audio.play('elevator_stop', { rate: 0.5, gain: 0.5 }); }
      if (this.st >= E.rumble_ms) { this.ent = 'rise'; this.st = 0; if (!this.mid) { w.mika.face = 1; w.robot.face = 1; } M.Audio.play('warp', { rate: 0.45 }); }
    } else if (this.ent === 'rise') {
      sh.off = Math.min(spec().shutter.rise_pixels, spec().shutter.rise_pixels * this.st / E.shutter_rise_ms);
      if ((this.winch = (this.winch || 0) + dt) > 420) { this.winch = 0; M.Audio.play('warp', { rate: 0.45, gain: 0.6 }); }
      if (this.st >= E.shutter_rise_ms) { sh.off = 999; this.ent = 'after'; this.st = 0; this.showBar = true; if (!this.mid) { w.mika.face = 1; w.robot.face = 1; } w.shake = 2; }
    } else if (this.ent === 'after' && this.st >= E.after_open_ms) {
      this.state = 'idle'; this.st = 0; this.doneCb && this.doneCb(); this.doneCb = null;
    }
  }

  update(dt) {
    this.tick(dt);
    this.st += dt;
    const w = W();
    this.updateRounds(dt);
    this.sparks = this.sparks.filter((s) => (s.age += dt) < 420);
    switch (this.state) {
    case 'wait': this.updateWait(); break;
    case 'waking': this.updateWaking(); break;
    case 'entrance': this.updateEntrance(dt); break;
    case 'idle':
      this.face0 = 'dand_idle';
      if (!this.active || w.holdAttacks) break;
      if ((this.cool -= dt) <= 0) this.nextAttack();
      break;
    case 'laser': this.updateLaser(dt); break;
    case 'eyebeam': this.updateEyeBeam(dt); break;
    case 'turret': this.updateTurret(dt); break;
    case 'dying': this.updateDying(dt); break;
    }
  }
  nextAttack() {
    const pat = this.mid ? D.pattern : D.bossPattern, a = pat[this.patI++ % pat.length];
    this.state = a; this.st = 0; this.hitT = new Map();
    if (a === 'turret') { this.seq = 0; this.shots = 0; this.tT = 0; }
    if (a === 'eyebeam') { const m = this.pt(P.mouth); this.beam = { x: m.x + this.dir * 40, y: this.y, sparkT: 0 }; }
  }
  toIdle() {
    // 2026-10-11 5D: 攻撃頻度 freqMul（0.5=半分）。攻撃そのものの長さも含めた1周期が 1/freqMul 倍になるよう、待ちを延ばす
    const atkMs = this.state !== 'idle' ? this.st : 0, k = this.freqMul && this.freqMul < 1 ? 1 / this.freqMul : 1;
    const gap = rand(D.idleMs[0], D.idleMs[1]) * this.coolMul * (this.mid ? 1 : D.bossIdleMul);
    this.state = 'idle'; this.st = 0; this.face0 = 'dand_idle'; this.cool = gap * k + atkMs * (k - 1);
  }
  // 狙える相手（ミカとロボ）
  targets() { const w = W(); return [w.mika, w.robot].filter((t) => t && t.canBeHit && t.canBeHit()); }
  hitOnce(t, key, every, dmg, type, cx, cz) {
    dmg = Math.max(1, Math.round(dmg * (this.dmgMul || 1)));   // 攻撃力の倍率（5Dは2026-10-11から元のまま）
    const now = W().fxTime, k = key + ':' + (t === W().mika ? 'm' : 'r');
    if ((this.hitT.get(k) || -1e9) + every > now) return;
    this.hitT.set(k, now);
    const att = { hits: new Set(), x: this.fl ? this.left + 112 : this.left, freeze: 0, kind: key };
    M.applyAttack(att, { x0: cx - 3, x1: cx + 3, y: t.y, depth: 2, z0: cz - 2, z1: cz + 2 }, [t], { dmg, type, dir: this.dir, strike: false, ranged: true });
  }

  // ------------------------------------------------ 口レーザー（目を見開く→口を開いて溜める→左へ）
  updateLaser(dt) {
    const t = this.st, a = D.laserEyesMs, b = a + D.laserChargeMs, c = b + D.laserFireMs, d = c + D.laserAfterMs;
    this.face0 = t < a ? 'dand_eyes' : t < c ? 'dand_mouth' : 'dand_eyes';
    if (t >= a && !this.chargeSE) { this.chargeSE = true; M.Audio.play('warp', { rate: 1.6, gain: 0.7 }); }
    if (t >= b && t < c) {
      if (!this.fireSE) { this.fireSE = true; M.Audio.play('laser'); W().shake = 1; }   // 2026-10-11 汎用レーザー音（SE_LAZERBERAM）
      // 画面上でレーザーの高さ（口の行）に体がかかっている相手に当たる。手前（下）へ逃げればかわせる
      const m = this.pt(P.mouth), S = m.sy;
      for (const tg of this.targets()) {
        const top = tg.y - tg.z - 44, bot = tg.y - tg.z - 2;
        if (this.fl ? tg.x <= m.x : tg.x >= m.x) continue;
        // 正面（口の高さ）と、斜め45度の上下（口から左へ離れるほど上・下へ）。どれかの線が体にかかれば当たる
        for (const k of [0].concat(D.laserDiag)) {
          const L = S + k * Math.abs(m.x - tg.x);
          if (L >= top && L <= bot) { this.hitOnce(tg, 'laser', D.laserHitMs, D.laserDmg, 'launch', tg.x - this.dir * 4, tg.y - L); break; }
        }
      }
    }
    if (t >= d) { this.chargeSE = this.fireSE = false; this.toIdle(); }
  }
  // ------------------------------------------------ 目ビーム（約3秒、左にいる相手をゆっくり追う）
  updateEyeBeam(dt) {
    const w = W(), B = this.beam, s = dt / 1000;
    this.face0 = 'dand_eyes';
    if (this.st < D.eyeBeamWarnMs) return;
    // 2026-10-11 照射中は目ビームのループ音（SSE_DANDALUMON_EYE_LAZER_LOOP）
    if (!this.eyeV || this.eyeV.ended) this.eyeV = M.Audio.play('eye_laser', { loop: true });
    M.Audio.touchLoop(this.eyeV);
    const tg = w.mika.state !== 'defeated' ? w.mika : w.robot;
    const dx = tg.x - B.x, dy = tg.y - B.y, d = Math.hypot(dx, dy * 1.6) || 1, v = D.eyeBeamSpeed;
    B.x += dx / d * v * s; B.y = clamp(B.y + dy / d * v * 0.6 * s, w.walkY[0], w.walkY[1]);
    B.x = this.fl ? Math.max(B.x, this.left + 102) : Math.min(B.x, this.left + 10);
    // 当たり: 床の照射点の近く
    let hit = null;
    for (const t of this.targets()) {
      if (Math.abs(t.x - B.x) < 11 && Math.abs(t.y - B.y) < 8 && t.z < 24) { hit = t; this.hitOnce(t, 'eyebeam', D.eyeBeamHitMs, D.eyeBeamDmg, 'light', t.x, 18); }
    }
    // 火花: 75msごとに照射点へ（キャラに当たっていればキャラの体へ）。古い火花は薄く残す
    if ((B.sparkT -= dt) <= 0) {
      B.sparkT = 75;
      this.sparks.push(hit ? { x: hit.x + rand(-3, 3), y: hit.y + 1, z: 18 + rand(-4, 6), age: 0 } : { x: B.x + rand(-2, 2), y: B.y + 0.5, z: 0, age: 0 });
    }
    if (this.st >= D.eyeBeamWarnMs + D.eyeBeamMs) { this.beam = null; M.Audio.stopLoop(this.eyeV); this.eyeV = null; this.toIdle(); }
  }
  // ------------------------------------------------ 砲台（6基が順に予告→2発ずつ）
  updateTurret(dt) {
    this.face0 = 'dand_idle';
    const per = D.turretWarnMs + D.turretShots * D.turretShotGapMs + D.turretGapMs;
    const i = Math.floor(this.st / per), t = this.st - i * per;
    if (i >= P.muzzles.length) { if (this.st > per * P.muzzles.length + 500) this.toIdle(); return; }
    this.warnI = t < D.turretWarnMs ? i : -1;
    const shot = Math.floor((t - D.turretWarnMs) / D.turretShotGapMs);
    if (t >= D.turretWarnMs && shot < D.turretShots && this.fired !== i * 10 + shot) {
      this.fired = i * 10 + shot;
      const mz = this.pt(P.muzzles[i]), w = W(), tg = this.targets()[0] || w.mika;
      // 2.5D: 砲口（ボスの足元の奥行き・その高さ）から、撃った瞬間の相手の胸へまっすぐ
      const tx = tg.x + rand(-6, 6), ty = tg.y + rand(-4, 4), tz = 22;
      const dx = tx - mz.x, dy = ty - this.y, dz = tz - mz.z, d = Math.hypot(dx, dy, dz) || 1, v = D.turretSpeed;
      this.rounds.push({ x: mz.x, y: this.y, z: mz.z, vx: dx / d * v, vy: dy / d * v, vz: dz / d * v, t: 0, hits: new Set() });
      w.effects.push(new M.Effect({ x: mz.x, y: this.y + 1, z: mz.z, anim: new M.Anim('dand_tflash'), life: 160, flip: !this.fl }));
      M.Audio.play('gun', { gain: 0.6, rate: 0.8 });
    }
  }
  updateRounds(dt) {
    const s = dt / 1000, w = W();
    for (const r of this.rounds) {
      r.t += dt; r.x += r.vx * s; r.y += r.vy * s; r.z += r.vz * s;
      const att = { hits: r.hits, x: r.x - this.dir * 5, freeze: 0, kind: 'round' };
      const n = M.applyAttack(att, { x0: r.x - 4, x1: r.x + 4, y: r.y, depth: 6, z0: r.z - 4, z1: r.z + 4 }, [w.mika, w.robot], { dmg: Math.max(1, Math.round(D.turretDmg * (this.dmgMul || 1))), type: 'light', dir: this.dir, strike: false, ranged: true });
      if (n || r.z <= 0 || r.x < w.camX - 20 || r.x > w.camX + M.W + 20 || r.t > 4000) {
        r.dead = true;
        if (!n && r.z <= 0) w.effects.push(new M.Effect({ x: r.x, y: r.y + 0.5, z: 0, anim: new M.Anim('dand_eyehit'), life: 200 }));
      }
    }
    this.rounds = this.rounds.filter((r) => !r.dead);
  }

  takeHit(att, info) {
    if (this.state === 'dying') return false;
    this.baseHit(att, info);
    return true;
  }
  // ------------------------------------------------ 撃破（大笑い→連続爆発→破片→瓦礫）
  onDefeated() {
    const w = W();
    this.state = 'dying'; this.st = 0; this.face0 = 'dand_laugh'; this.rounds = []; this.beam = null; this.expT = 0; this.warnI = -1;
    M.Audio.stopLoop(this.eyeV); this.eyeV = null;
    w.run.score += this.def.score;
    M.Audio.play('dand_laugh');   // 2026-10-12 v103 正式な大笑い
    if (this.onDeath) this.onDeath(this);
  }
  updateDying(dt) {
    const w = W(), s = dt / 1000;
    this.expT -= dt;
    if (this.st < 3000 && this.expT <= 0) {
      this.expT = rand(110, 210);
      w.effects.push(new M.Effect({ x: this.left + rand(10, 100), y: this.y + 1, z: rand(15, 155), anim: new M.Anim('rocket_explosion'), life: 500 }));
      M.Audio.play('explosion'); w.shake = 2;
      M.bossDeathVoice(this.st + this.expT >= 3000);
    }
    // 最後の絶叫: 消える瞬間（3.3秒）に終わるように始め、姿が薄くなるのに合わせて音も小さくして消す
    if (this.st > 500 && !this.scream) this.scream = M.Audio.play('boss_death_dandalmon') || { ended: true };
    if (this.scream && !this.scream.ended && this.st > 2600) {
      const k = Math.max(0, 1 - (this.st - 2600) / 700), C = M.AUDIO.seMix.boss_death_dandalmon.gain;
      if (this.scream.g) this.scream.g.gain.value = C * k; else if (this.scream.el) this.scream.el.volume = Math.max(0, this.scream.base * k);
      if (k <= 0) M.Audio.fadeVoice(this.scream);
    }
    if (this.st > 1700 && !this.frags.length) {
      for (let i = 0; i < 8; i++) this.frags.push({ f: 'dand_frag_0' + i, x: this.left + rand(20, 90), z: rand(50, 140), vx: -this.dir * rand(-150, 40), vz: rand(120, 300), rot: 0, vr: rand(-8, 8), bounce: 0 });
    }
    for (const f of this.frags) {
      if (f.rest) continue;
      f.vz -= 650 * s; f.x += f.vx * s; f.z += f.vz * s; f.rot += f.vr * s;
      if (f.z <= 0) { f.z = 0; if (f.bounce++ < 1) { f.vz = -f.vz * 0.35; f.vx *= 0.5; } else f.rest = true; }
    }
    this.alpha = this.st < 2600 ? 1 : Math.max(0, 1 - (this.st - 2600) / 700);
    if (this.st > 4300 && !this.reported) { this.reported = true; this.gone = true; this.onDeathDone && this.onDeathDone(this); }
  }

  // ------------------------------------------------ 描画
  draw() {
    const w = W(), ctx = M.ctx, sx = this.left - w.camX;
    // 2026-10-11 ユーザー指定: 倒れた後の瓦礫と破片は点滅して消える（4.3秒から1秒点滅）
    const debrisOn = !(this.state === 'dying' && this.st > 4300 && (this.st > 5300 || Math.floor((this.st - 4300) / 80) % 2));
    if (this.state === 'dying' && this.st > 2400 && debrisOn) M.drawFrame('dand_rubble', this.left + 56 - w.camX, this.y + 2, [64, 40], this.fl, Math.min(1, (this.st - 2400) / 500));
    if (this.alpha > 0.02) {
      const jit = this.state === 'dying' && this.st < 2600 ? Math.round(rand(-1, 1)) : 0;
      const flash = this.flashT > 0, low = this.lowHpBlink && this.hp > 0 && this.hp / this.maxHp < 0.25 && ((w.fxTime / 160) | 0) % 2;
      if (flash || low) { ctx.save(); ctx.filter = low ? 'sepia(1) saturate(6) hue-rotate(-50deg) brightness(0.95)' : 'brightness(1.6)'; }
      M.drawFrame(this.face0, sx + 56 + jit, this.y, [56, 168], this.fl, this.alpha);
      if (flash || low) ctx.restore();
    }
    // 砲台の予告（赤い点滅）
    if (this.state === 'turret' && this.warnI >= 0 && ((w.fxTime / 60) | 0) % 2) {
      const m = P.muzzles[this.warnI];
      const mx = this.X(m[0]) - w.camX;
      ctx.fillStyle = '#ff3a2a'; ctx.fillRect(Math.round(mx) - 3, Math.round(this.top + m[1]) - 1, 4, 3);
      ctx.fillStyle = 'rgba(255,90,60,0.35)'; ctx.fillRect(Math.round(mx) - 6, Math.round(this.top + m[1]) - 3, 9, 7);
    }
    // 口の溜めとレーザー
    if (this.state === 'laser') this.drawLaser(sx);
    if (debrisOn) for (const f of this.frags) M.drawFrameX(f.f, f.x - w.camX, this.y - f.z, { rot: f.rot });
  }
  drawLaser(sx) {
    const ctx = M.ctx, t = this.st, a = D.laserEyesMs, b = a + D.laserChargeMs, c = b + D.laserFireMs;
    const mx = Math.round(this.X(P.mouth[0]) - W().camX), my = Math.round(this.top + P.mouth[1]);
    if (t >= a && t < b) {
      const k = (t - a) / D.laserChargeMs;
      ctx.fillStyle = `rgba(255,80,60,${0.25 + 0.5 * k})`; ctx.beginPath(); ctx.arc(mx, my, 3 + 5 * k, 0, Math.PI * 2); ctx.fill();
      // 予告線（うっすら）: この高さに体がかかると当たる
      if (((t / 70) | 0) % 2) {
        ctx.fillStyle = 'rgba(255,60,40,0.35)'; if (this.fl) ctx.fillRect(mx, my, M.W - mx, 1); else ctx.fillRect(0, my, mx, 1);
        for (const k of D.laserDiag) this.beamLine(mx, my, k, (len) => ctx.fillRect(-len, 0, len, 1));
      }
    } else if (t >= b && t < c) {
      const f = ((t / 40) | 0) % 2;
      for (const k of [0].concat(D.laserDiag)) this.beamLine(mx, my, k, (len) => {
        ctx.fillStyle = 'rgba(255,40,30,0.35)'; ctx.fillRect(-len, -4, len, 9);
        ctx.fillStyle = '#ff3a24'; ctx.fillRect(-len, -2, len, 5);
        ctx.fillStyle = f ? '#ffe6c8' : '#fff4e8'; ctx.fillRect(-len, -1, len, 2);
      });
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(mx, my, 5 + f, 0, Math.PI * 2); ctx.fill();
    }
  }
  // 口から左へ伸びる線の座標系で描く（k=0 正面、-1 左上45度、1 左下45度）。len は画面の端まで（反転時は右へ）
  beamLine(mx, my, k, fn) {
    const ctx = M.ctx; ctx.save(); ctx.translate(mx, my);
    if (this.fl) ctx.scale(-1, 1);
    if (k) ctx.rotate(-k * Math.PI / 4);
    const span = this.fl ? M.W - mx : mx;
    fn(k ? Math.ceil(Math.min(span, k < 0 ? my : M.H - my) * Math.SQRT2) + 8 : span);
    ctx.restore();
  }
  // 目ビームと火花・砲弾は役者の後（手前）に描く
  drawOver() {
    const w = W(), ctx = M.ctx, B = this.beam;
    if (this.state === 'eyebeam' && B) {
      // 2026-10-12 v119 ユーザー指定: 両目からビーム（当たり判定は今までどおり着弾点 B の1か所）
      const px = B.x - w.camX, py = B.y;
      for (const eyeP of [P.eye, P.eye2]) {
        const e = this.pt(eyeP), ex = e.x - w.camX, ey = e.sy;
        if (this.st < D.eyeBeamWarnMs) {
          if (((this.st / 60) | 0) % 2) { ctx.fillStyle = 'rgba(255,60,40,0.8)'; ctx.beginPath(); ctx.arc(ex, ey, 3, 0, Math.PI * 2); ctx.fill(); }
        } else {
          ctx.strokeStyle = 'rgba(255,60,40,0.4)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(px, py); ctx.stroke();
          ctx.strokeStyle = '#ffd0b0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(px, py); ctx.stroke();
          ctx.lineWidth = 1;
        }
      }
    }
    for (const s of this.sparks) {
      const i = Math.floor(s.age / 75) % 6;
      M.drawFrameX('dand_eyehit_0' + i, s.x - w.camX, s.y - s.z, { alpha: s.age < 150 ? 1 : 0.45 });
    }
    for (const r of this.rounds) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(Math.round(r.x - w.camX) - 2, Math.round(r.y), 4, 1);
      M.drawFrameX('dand_round', r.x - w.camX, r.y - r.z, { flip: r.vx > 0 });
    }
  }
}
M.Dandalmon = Dandalmon;

// ================================================================== 4C マップの仕掛け（シャッターと入れない場所）
M.mapHooks = M.mapHooks || {};
M.mapHooks['4C'] = {
  init(w) {
    if (w.kind === 'room') return;
    const bossSec = w.sections.find((s) => s.kind === 'boss');
    const done = bossSec && w.run.cleared[bossSec.section_id];
    // 2026-10-11 ユーザー指定: シャッターは4Cのボスだけ。5Dの中ボスは最初から壁に鎮座していて、近づくと目覚める
    if (w.mapId !== '4C') {
      if (!done) { const b = new Dandalmon(w, { hp: 1, left: w.map.specials && w.map.specials.dand_left }); b.seat(null); w.enemies.push(b); w.dandSeat = b; }
      return;
    }
    w.shutter = { off: done ? 999 : 0 };
  },
  shutterX(w) { const L = w.map.specials && w.map.specials.dand_left; if (L != null) return L - (spec().boss_placement.top_left_preview[0] - spec().shutter.top_left_closed[0]); return (w.sections.find((s) => s.kind === 'boss').screen - 1) * M.W + spec().shutter.top_left_closed[0]; },
  update(w, dt) {
    const m = w.mika, r = w.robot, b = w.boss instanceof Dandalmon ? w.boss : w.dandSeat;
    if (!w.shutter && !b) return;
    let lim = null;
    if (w.shutter && w.shutter.off < spec().shutter.rise_pixels) lim = this.shutterX(w) - 8;              // 閉じたシャッターの中へは入れない
    else if (b && b.state !== 'dying' && !b.gone) lim = b.left + P.body[0] - 4;   // ボスの体の中へは入れない
    if (lim != null) {
      if (m.x > lim) { m.x = lim; if (m.vx > 0) m.vx = 0; }
      if (r && r.x > lim - 10) r.x = lim - 10;
    }
  },
  drawFront(w) {
    if (w.boss instanceof Dandalmon) w.boss.drawOver();
    else if (w.dandSeat) w.dandSeat.drawOver();
    if (!w.shutter || w.shutter.off >= spec().shutter.rise_pixels) return;
    const S = spec().shutter, x = this.shutterX(w) - w.camX;
    if (x > M.W + 4 || x + S.size[0] < -4) return;
    M.drawFrame('dand_shutter', x, S.top_left_closed[1] - w.shutter.off, [0, 0], false);
  },
};
})();
