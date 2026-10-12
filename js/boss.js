// boss.js — ボス登場の共通演出・ゴブリンメカ・ダークミカ・ゴブリンクイーン・取り巻き・クイーンの命乞い
'use strict';
(function () {
const M = window.MIKA, T = M.TUNING;
const { clamp, rand, sign, approach } = M;
const W = () => M.world;

// ================================================================== 登場演出（MIKA_BOSS_INTRO_COMMON v001）
//   ステージBGMフェードアウト → ボス固有の登場 → 肩書・名前を一文字ずつ「ダン！」
//   → 最後の文字から1200ms保持 → 文字が弾ける瞬間（同じフレーム）にボスBGMと戦闘開始
class BossIntro {
  constructor(world, boss, specId, onCombat) {
    this.w = world; this.boss = boss; this.onCombat = onCombat;
    this.spec = M.REF.bossIntro.bosses.find((b) => b.id === specId);
    this.phase = 'fade'; this.t = 0; this.next = 0; this.letters = []; this.particles = []; this.done = false;
    const s = this.spec;
    this.schedule = [
      ...s.epithet_glyphs.map((g, i) => ({ g, at: i * s.epithet_step_ms })),
      ...s.name_glyphs.map((g, i) => ({ g, at: s.epithet_glyphs.length * s.epithet_step_ms + s.line_gap_ms + i * s.name_step_ms })),
    ];
    this.burstAt = this.schedule[this.schedule.length - 1].at + s.hold_ms;
    world.lockInput = true; world.timerRunning = false;
    const m = world.mika;
    m.endWeaponHold();
    if (!['idle', 'walk'].includes(m.state) || m.z > 0) { m.z = 0; m.vx = 0; m.move = null; m.wmove = null; }
    m.setState('idle', 'idle');
    this.face();
    // 2026-10-09 ユーザー指定: 登場演出の前に、ミカを画面の左側へ歩かせて右を向かせる（着くまで登場を待つ）
    const B = T.bossTuning, tx = world.camX + (B.introMikaX || 64), ty = (world.walkY[0] + world.walkY[1]) / 2;
    this.arrived = Math.abs(m.x - tx) <= 2 && Math.abs(m.y - ty) <= 2;
    if (this.arrived) m.face = 1;
    else m.goTo(tx, ty, () => { m.face = 1; this.arrived = true; });
    M.Audio.fadeOutMusic(s.fade_ms);
  }
  face() {
    const { mika, robot } = this.w, b = this.boss;
    mika.face = b.x >= mika.x ? 1 : -1; robot.face = b.x >= robot.x ? 1 : -1; b.face = mika.x >= b.x ? 1 : -1;
  }
  get busy() { return !this.done; }
  update(dt) {
    this.t += dt;
    for (const l of this.letters) l.age += dt;
    for (const p of this.particles) p.age += dt;
    this.particles = this.particles.filter((p) => p.age < this.spec.burst_ms);
    if (this.phase === 'fade' && this.t >= this.spec.fade_ms && (this.arrived || this.t >= this.spec.fade_ms + 5000)) {
      if (!this.arrived) { const m = this.w.mika; m.autoGoal = null; m.setState('idle', 'idle'); m.face = 1; this.arrived = true; }
      M.Audio.stopMusic();
      this.phase = 'entrance'; this.t = 0;
      this.boss.beginEntrance(() => { if (this.phase === 'entrance') { this.phase = 'title'; this.t = 0; this.face(); } });
    } else if (this.phase === 'title') {
      while (this.next < this.schedule.length && this.t >= this.schedule[this.next].at) {
        this.letters.push({ g: this.schedule[this.next].g, age: 0 });
        this.next++;
        M.Audio.play('boss_title_dan');
      }
      if (this.t >= this.burstAt) this.burst();
    }
  }
  burst() {
    this.letters.forEach((l, index) => {
      const g = l.g, name = g.path.split('/').pop().replace('.png', '');
      for (let yy = 0; yy < g.height; yy += 8) for (let xx = 0; xx < g.width; xx += 8) {
        const ang = (index * 37 + xx * 9 + yy * 13) * 0.1, sp = 48 + (xx + yy + index * 3) % 60;
        this.particles.push({ g, name, xx, yy, w: Math.min(8, g.width - xx), h: Math.min(8, g.height - yy),
          vx: Math.cos(ang) * sp + (g.x - 192) * 0.6, vy: Math.sin(ang) * sp - 30, age: 0 });
      }
    });
    this.letters = [];
    this.phase = 'battle'; this.done = true;
    M.Audio.playMusic('boss');   // 同じフレームでボスBGMを先頭から
    M.Audio.voice('boss_encount');   // 2026-10-11 ユーザー指定: ミカの声は名前表示が終わってバトル曲になった時
    this.w.lockInput = false; this.w.timerRunning = true;
    this.onCombat && this.onCombat();
  }
  draw() {
    const ctx = M.ctx;
    for (const { g, age } of this.letters) {
      const name = g.path.split('/').pop().replace('.png', '');
      const k = 1 + 0.4 * Math.max(0, 1 - age / 90);
      const w = Math.round(g.width * k), h = Math.round(g.height * k);
      ctx.save(); ctx.translate(Math.round(g.x + (g.width - w) / 2), Math.round(g.y + (g.height - h) / 2)); ctx.scale(w / g.width, h / g.height);
      M.drawFrame(name, 0, 0, [0, 0], false);
      ctx.restore();
    }
    for (const p of this.particles) {
      const q = p.age / this.spec.burst_ms;
      ctx.save(); ctx.beginPath();
      const px = Math.round(p.g.x + p.xx + p.vx * q), py = Math.round(p.g.y + p.yy + p.vy * q + 85 * q * q);
      ctx.rect(px, py, p.w, p.h); ctx.clip();
      M.drawFrame(p.name, px - p.xx, py - p.yy, [0, 0], false, 1 - q);
      ctx.restore();
    }
  }
}
M.BossIntro = BossIntro;
M.bossBase = () => Boss;

// ================================================================== ボスの共通部分
class Boss extends M.Actor {
  constructor(x, y, o) {
    super(x, y);
    this.team = 'enemy'; this.boss = true; this.showBar = false;
    this.maxHp = o.hp; this.hp = o.hp; this.def = { enemy_id: o.id, score: o.score || 0 };
    this.hits = new Set(); this.id = 9000 + (Boss.n = (Boss.n || 0) + 1);
    this.cool = 1200; this.flashT = 0;
    this.coolMul = T.stageCooldown[W().stage] || 1;
  }
  grabbable() { return false; }
  target() { const w = W(), m = w.mika; return m && !['defeated', 'down', 'knock', 'getup', 'rescued'].includes(m.state) ? m : (w.robot.targetable() ? w.robot : m); }
  hitSE(info) { if (info.se) return info.se; if (info.ranged && info.weapon === 'machinegun') return 'hit_mg'; if (info.ranged && info.weapon === 'yoichi_bow') return 'hit_arrow';   /* 2026-10-12 v103 */ if (info.weapon && !info.ranged) return 'weapon_hit'; return info.type === 'launch' ? 'hit_mid' : info.ranged ? 'bullet_hit' : 'hit'; }
  baseHit(att, info) {
    const w = W();
    this.hp = Math.max(0, this.hp - info.dmg);
    w.onEnemyHit(this, att, info);
    this.flashT = 90;
    const stop = info.finisher ? T.hitstop.finisherMs : info.ranged ? 30 : T.hitstop.normalMs * 0.8;
    if (!info.flame) { this.freeze = stop * 0.6; if (!info.ranged) att.freeze = Math.max(att.freeze || 0, stop); }
    M.spark(this.x - info.dir * this.bodyW * 0.3, this.y, this.z + Math.min(60, this.bodyH * 0.5));
    if (!info.flame || ((this.flameSE = (this.flameSE || 0) + 1) % 3 === 1)) M.Audio.play(this.hitSE(info), { robot: info.robot });
    if (info.smash) { M.spawnSmash(this.x, this.y, this.z + 60); w.shake = T.hitstop.shakeFinisher; }
    if (this.hp <= 0 && !this.defeated) { this.defeated = true; this.onDefeated(); }
  }
  // 赤点滅（HP25%未満）と被弾の白い光
  drawBody(anim, idx, extraZ = 0) {
    const ctx = M.ctx, low = this.lowHpBlink && this.hp > 0 && this.hp / this.maxHp < 0.25 && ((W().fxTime / 160) | 0) % 2;
    if (this.flashT > 0 || low) { ctx.save(); ctx.filter = low ? 'sepia(1) saturate(6) hue-rotate(-50deg) brightness(0.95)' : 'brightness(1.7)'; }
    const blink = this.invulnT > 0 && this.state !== 'dying' && ((W().fxTime / 60) | 0) % 2;   // 無敵中は点滅
    M.drawAnim(anim, idx, this.x - W().camX, this.y - this.z - extraZ, this.face > 0, this.alpha * (blink ? 0.35 : 1));
    if (this.flashT > 0 || low) ctx.restore();
  }
  tick(dt) { if (this.flashT > 0) this.flashT -= dt; if (this.invulnT > 0) this.invulnT -= dt; }
}

// ================================================================== ゴブリンメカ（1面ボス／3A終端の半HP版）
// 伸びるパンチ8、マシンガン10発各1、ジャンプ踏み10。HP25%未満で赤点滅。転倒→起き上がりジャンプまで無敵
class GoblinMech extends Boss {
  constructor(x, y, o) {
    super(x, y, { hp: o.hp, id: 'goblin_robot', score: o.score });
    this.mini = !!o.mini; this.lowHpBlink = true;
    this.bodyW = 64; this.bodyH = 112; this.shadowW = 80;
    this.face = -1; this.z = 260; this.state = 'wait';
    this.anim = new M.Anim('goblin_robot_idle', { loop: true });
    this.stagger = 0; this.delay = o.delay || 0;
  }
  get name() { return this.mini ? 'ゴブリンメカ' : M.REF.bossIntro.bosses.find((b) => b.id === 'goblin_robot').display_name; }
  canBeHit() { return ['idle', 'walk', 'punch', 'smg', 'jumpwait', 'land', 'hurt'].includes(this.state) && !(this.invulnT > 0); }
  hurtbox() { const hw = (T.bossTuning.mechHurtW || this.bodyW) / 2; return { x0: this.x - hw, x1: this.x + hw, y: this.y, z0: this.z, z1: this.z + this.bodyH }; }
  beginEntrance(done) { this.state = 'fall'; this.vz = 0; this.doneCb = done; this.showBar = true; this.anim.set('goblin_robot_jump'); this.anim.i = 3; }
  takeHit(att, info) {
    this.baseHit(att, info);
    if (this.hp <= 0) return true;
    this.stagger += info.dmg;
    if ((this.stagger >= 22 || ((info.type === 'launch' || info.smash) && this.stagger >= 10)) && this.z === 0) this.knockdown(info.dir);
    else if (this.z === 0 && !info.flame && ['idle', 'walk', 'punch', 'smg', 'hurt', 'land'].includes(this.state) && !(info.ranged && info.dmg < 2)) {
      // 2026-10-08 普通にひるむ（攻撃も止まる）。重さ＝転倒までの蓄積は今のまま
      this.state = 'hurt'; this.st = 0; this.face = -info.dir || this.face;
      this.anim.set(info.dmg >= 4 ? 'goblin_robot_damage_heavy' : 'goblin_robot_damage_light', { hold: true });
    }
    return true;
  }
  knockdown(dir) {
    this.stagger = 0; this.state = 'knock'; this.st = 0; this.vx = dir * 70; this.invulnT = 3000;
    this.anim.set('goblin_robot_knockback'); M.Audio.play('enemy_down'); W().shake = 2;
  }
  onDefeated() {
    const w = W();
    this.state = 'dying'; this.st = 0; this.anim.set('goblin_robot_death_start'); this.z = 0; this.expT = 0;
    w.run.score += this.def.score;
    if (this.onDeath) this.onDeath(this);
  }
  update(dt) {
    this.tick(dt);
    if (this.freeze > 0) { this.freeze -= dt; return; }
    const s = dt / 1000, w = W();
    this.st += dt;
    const tg = this.target();
    switch (this.state) {
    case 'wait': if (this.autoDrop && (this.delay -= dt) <= 0) this.beginEntrance(null); break;
    case 'fall':
      this.vz -= 900 * s; this.z = Math.max(0, this.z + this.vz * s); this.anim.i = 3;
      if (this.z === 0) { this.state = 'land'; this.st = 0; this.anim.i = 4; w.shake = T.boss.landShakePx; M.Audio.play('elevator_stop'); M.Audio.play('robo_goblin_step', { gain: 1.2 }); this.landHit(); }
      break;
    case 'land':
      this.anim.i = this.st < 240 ? 4 : 5;
      if (this.st > 790) { this.state = 'idle'; this.anim.set('goblin_robot_idle', { loop: true }); this.doneCb && this.doneCb(); this.doneCb = null; this.cool = 600; }
      break;
    case 'idle': case 'walk': this.think(dt, s, tg); break;
    case 'hurt': if (this.st > T.bossTuning.mechHurtMs) this.toIdle(500); break;
    case 'punch': {
      this.anim.update(dt);
      if (this.anim.i === 1 || this.anim.i === 2) {
        M.applyAttack(this, this.attackBox({ reach: [20, 150], band: [16, 80], depth: 12 }), [w.mika, w.robot], { dmg: 8, type: 'launch', dir: this.face, strike: true });
      }
      if (this.anim.done) this.toIdle(1100);
      break;
    }
    case 'smg': {
      const a = this.anim;
      if (a.i === 1 || a.i === 2) {
        this.shotT -= dt;
        if (this.shotT <= 0 && this.shots < 10) {
          this.shots++; this.shotT = 45;
          const mz = M.muzzleOf('goblin_robot_smg', a.i);
          w.projectiles.push(new M.Shot({ team: 'enemy', kind: 'bullet', x: this.x + this.face * mz[0], y: this.y + rand(-2, 2), z: mz[1], zTo: 30, zRate: 300, vx: this.face * 280, dmg: 1, anim: 'mg_bullet', range: 330 }));
          w.effects.push(new M.Effect({ x: this.x + this.face * mz[0], y: this.y + 0.3, z: mz[1], anim: new M.Anim('muzzle_flash'), life: 60, flip: this.face < 0 }));
          M.Audio.play('gun');
        }
        if (this.shots < 10) { a.t = Math.min(a.t, 100); if (a.i === 2 && this.shotT <= 0) a.i = 1; }
      }
      a.update(dt);
      if (a.done) this.toIdle(1000);
      break;
    }
    case 'jump': {   // 踏みつけ: しゃがむ→跳ぶ→ミカの位置へ→着地で範囲ダメージ
      const a = this.anim;
      if (this.st < 400) { a.i = 0; break; }
      if (!this.air) { this.air = true; this.vz = 520; this.jx = this.tx; M.Audio.play('jump'); }
      this.vz -= 1100 * s; this.z = Math.max(0, this.z + this.vz * s);
      this.x = approach(this.x, this.jx, 220 * s); this.y = approach(this.y, this.ty, 80 * s);
      a.i = this.vz > 120 ? 1 : this.vz > -60 ? 2 : 3;
      if (this.z <= 0 && this.vz < 0) { this.air = false; this.state = 'land'; this.st = 0; a.i = 4; w.shake = 2; M.Audio.play('robo_goblin_step', { gain: 1.2 }); this.landHit(); this.invulnT = this.invulnT > 0 ? T.bossTuning.mechWakeInvulnMs : 0; this.doneCb = null; this.afterLand = true; }
      break;
    }
    case 'knock':
      this.x += this.vx * s; this.vx = approach(this.vx, 0, 120 * s);
      if (this.st > 420) { this.state = 'down'; this.st = 0; this.anim.set('goblin_robot_down'); w.shake = 1; }
      break;
    case 'down': if (this.st > 1000) { this.state = 'getup'; this.st = 0; this.anim.set('goblin_robot_getup'); } break;
    case 'getup': if (this.st > 350) { this.state = 'ready'; this.st = 0; this.anim.set('goblin_robot_recovery_ready'); } break;
    case 'ready': if (this.st > 260) this.beginJump(tg, true); break;   // 起き上がりジャンプ攻撃（着地まで無敵）
    case 'dying': this.updateDying(dt); break;
    }
    if (this.state !== 'dying' && this.state !== 'wait' && this.state !== 'fall') this.y = clamp(this.y, w.walkY[0], w.walkY[1]);
    if (!['dying', 'wait', 'fall'].includes(this.state)) this.x = clamp(this.x, w.camX + 30, w.camX + M.W - 30);
    // 足音: 歩きのコマが 0・2 に変わった時
    if (this.state === 'walk' && this.anim.name === 'goblin_robot_walk') {
      if (this.anim.i !== this.stepI) { this.stepI = this.anim.i; if (this.anim.i % 2 === 0) M.Audio.play('robo_goblin_step'); }
    } else this.stepI = -1;
  }
  toIdle(cool) { this.state = 'idle'; this.anim.set('goblin_robot_idle', { loop: true }); this.cool = (cool + rand(0, 600)) * this.coolMul; }
  landHit() {
    const w = W();
    M.applyAttack({ hits: new Set(), x: this.x, freeze: 0 }, { x0: this.x - 52, x1: this.x + 52, y: this.y, depth: 14, z0: 0, z1: 40 }, [w.mika, w.robot], { dmg: 10, type: 'launch', dir: this.face, strike: true });
  }
  beginJump(tg, invuln) {
    this.state = 'jump'; this.st = 0; this.air = false; this.anim.set('goblin_robot_jump'); this.anim.i = 0;
    this.tx = tg ? tg.x : this.x; this.ty = tg ? tg.y : this.y;
    if (invuln) this.invulnT = 2000;
  }
  think(dt, s, tg) {
    const w = W();
    if (!this.active) { if (this.state === 'idle') this.anim.update(dt); return; }   // 登場演出の間は動かない
    if (this.cool > 0) this.cool -= dt;
    if (!tg) return;
    const dx = tg.x - this.x, adx = Math.abs(dx), dy = tg.y - this.y;
    this.face = sign(dx) || this.face;
    if (this.cool <= 0 && !w.holdAttacks) {
      if (Math.abs(dy) <= 10 && adx > 40 && adx < 150 && Math.random() < 0.6) { this.state = 'punch'; this.anim.set('goblin_robot_punch'); this.newAttack(); return; }
      if (Math.abs(dy) <= 8 && adx >= 90 && adx < 280 && Math.random() < 0.5) { this.state = 'smg'; this.anim.set('goblin_robot_smg'); this.shots = 0; this.shotT = 0; return; }
      if (adx < 220 && Math.random() < 0.25) { this.beginJump(tg, false); return; }
    }
    // 軸を合わせつつ、パンチの間合いへゆっくり
    const want = tg.x - sign(dx || -1) * 100;
    const mx = Math.abs(want - this.x) > 8 ? sign(want - this.x) : 0, my = Math.abs(dy) > 3 ? sign(dy) : 0;
    if (mx || my) {
      this.x += mx * T.bossTuning.mechWalk * s; this.y += my * 26 * s;
      if (this.state !== 'walk') { this.state = 'walk'; this.anim.set('goblin_robot_walk', { loop: true }); }
      this.anim.update(dt);
    } else if (this.state !== 'idle') { this.state = 'idle'; this.anim.set('goblin_robot_idle', { loop: true }); }
    else this.anim.update(dt);
  }
  // 撃破: 長い爆発 → 崩れる → 瓦礫 → 操縦ゴブリンが飛び出して落ちる
  updateDying(dt) {
    const w = W();
    this.expT -= dt;
    if (this.st < 3400 && this.expT <= 0) {
      this.expT = 150 + rand(0, 120);
      w.effects.push(new M.Effect({ x: this.x + rand(-40, 40), y: this.y + 0.6, z: rand(20, 100), anim: new M.Anim('rocket_explosion'), life: 500 }));
      M.Audio.play('explosion'); w.shake = 2;
      M.bossDeathVoice(this.st + this.expT >= 3400);
    }
    if (this.st >= 2400 && this.anim.name === 'goblin_robot_death_start') this.anim.set('goblin_robot_collapse');
    if (this.st >= 3400 && this.anim.name === 'goblin_robot_collapse') {
      this.anim.set('goblin_robot_rubble');
      this.pilot = { x: this.x, y: this.y + 2, z: 70, vx: -this.face * 50, vz: 170, state: 'fly', t: 0 };
    }
    const p = this.pilot;
    if (p && p.state !== 'rest') {
      p.t += dt;
      if (p.state === 'fly') { const s = dt / 1000; p.vz -= 700 * s; p.z += p.vz * s; p.x += p.vx * s; if (p.z <= 0) { p.z = 0; p.state = 'landing'; p.t = 0; M.Audio.play('land'); } }
      else if (p.state === 'landing' && p.t > 250) { p.state = 'rest'; p.t = 0; }
    }
    if (this.mini) {
      // 2026-10-11 中ボス（5A・3Aの2体）: 残骸と操縦ゴブリンが点滅して消えてから次へ
      if (p && p.state === 'rest' && this.st > 4600 && this.blinkT == null) this.blinkT = 0;
      if (this.blinkT != null && !this.gone) {
        this.blinkT += dt;
        if (this.blinkT >= 1000) { this.gone = true; if (!this.reported) { this.reported = true; this.onDeathDone && this.onDeathDone(this); } }
      }
      return;
    }
    if (p && p.state === 'rest' && !this.reported && this.st > 4600) { this.reported = true; this.onDeathDone && this.onDeathDone(this); }
  }
  draw() {
    if (this.state === 'wait' || this.gone) return;
    if (this.blinkT != null && Math.floor(this.blinkT / 80) % 2) return;   // 消える前の点滅
    this.drawShadow();
    this.drawBody(this.anim.name, this.anim.i);
    const p = this.pilot;
    if (p) {
      const sx = p.x - W().camX;
      M.ctx.fillStyle = 'rgba(0,0,0,0.25)'; M.ctx.fillRect(Math.round(sx) - 8, Math.round(p.y) - 1, 16, 3);
      M.drawAnim(p.state === 'fly' ? 'goblin_pilot_ejected' : p.state === 'landing' ? 'goblin_pilot_landing' : 'goblin_pilot_defeated', 0, sx, p.y - p.z, this.face > 0);
    }
  }
}
M.GoblinMech = GoblinMech;

// ================================================================== ダークミカ（2面ボス）
// 黒い影のクローン。頻繁に移動ジャンプ（着地後に短い隙）。前半は刀（吹っ飛ばすと一度だけ落とす）、後半はSMG・ランチャー（落とさない）
class DarkMika extends Boss {
  constructor(x, y, o) {
    super(x, y, { hp: o.hp, id: 'dark_mika', score: o.score });
    this.bodyW = 20; this.bodyH = 46; this.shadowW = 20;
    this.phase2At = o.phase2Ratio; this.katana = true; this.dropped = false;
    this.face = -1; this.state = 'wait'; this.alpha = 0;
    this.anim = new M.Anim('dark_mika_idle', { loop: true });
    this.hitWindow = [];
    this.coolMul /= T.bossTuning.darkSpeed;   // 2026-10-08 速く
  }
  get name() { return M.REF.bossIntro.bosses.find((b) => b.id === 'dark_mika').display_name; }
  get phase2() { return this.hp / this.maxHp <= this.phase2At; }
  canBeHit() { return !['wait', 'appear', 'knock', 'down', 'getup', 'dying', 'escape'].includes(this.state) && !(this.invulnT > 0); }
  // 登場: 研究所のクローン装置が光る → 影が刀を持って跳び出す
  beginEntrance(done) {
    this.doneCb = done; this.state = 'appear'; this.st = 0; this.showBar = true;
    const w = W(); this.devX = w.camX + 192; this.x = this.devX; this.y = w.walkY[0] + 4; this.z = 26;
  }
  takeHit(att, info) {
    this.baseHit(att, info);
    if (this.hp <= 0) return true;
    const now = W().fxTime;
    this.hitWindow = this.hitWindow.filter((t) => now - t < 1400); this.hitWindow.push(now);
    if (info.type === 'launch' || info.smash || this.z > 0) {
      this.state = 'knock'; this.st = 0; this.vx = info.dir * 120; this.vz = 160; this.face = -info.dir; this.anim.set('dark_mika_knockback', { hold: true });
      // 刀は吹っ飛ばした時に一度だけ落とす（ミカが拾える）
      if (this.katana && !this.dropped) { this.dropped = true; this.katana = false; W().dropWeaponItem('katana', this.x, this.y); }
      this.endAttack();
    } else if (this.hitWindow.length >= 5) {
      this.hitWindow = []; this.escape(att);   // 連続で殴られ続けたら跳んで逃げる（はめ防止）
    } else if (['idle', 'run', 'land'].includes(this.state)) {
      this.state = 'hurt'; this.st = 0; this.face = -info.dir; this.anim.set(info.dmg >= 3 ? 'dark_mika_damage_heavy' : 'dark_mika_damage_light');
    }
    return true;
  }
  endAttack() { if (this.flame) { this.flame.on = false; this.flame = null; } }
  escape(att) {
    const w = W(), dir = sign(this.x - att.x) || 1;
    this.jumpTo(clamp(this.x + dir * 120, w.camX + 30, w.camX + M.W - 30), this.y + rand(-20, 20), null);
    this.invulnT = 350; this.state = 'escape';
  }
  // 吹っ飛んで起き上がったら、無敵のままミカから離れるよう大きく跳ぶ
  bigEscape() {
    const w = W(), m = w.mika;
    const side = m.x < w.camX + M.W / 2 ? 1 : -1;
    const tx = side > 0 ? w.camX + M.W - rand(30, 60) : w.camX + rand(30, 60);
    this.jumpTo(tx, rand(w.walkY[0], w.walkY[1]), null);
    this.vz = 470; this.state = 'escape'; this.bigJump = true; this.invulnT = T.bossTuning.darkWakeInvulnMs;
  }
  onDefeated() {
    const w = W();
    this.endAttack();
    this.state = 'dying'; this.st = 0; this.z = 0; this.anim.set('dark_mika_defeated', { hold: true }); this.expT = 0;
    w.run.score += this.def.score;
    if (this.onDeath) this.onDeath(this);
  }
  jumpTo(x, y, airAttack) {
    const w = W();
    this.state = 'jump'; this.st = 0; this.jx = clamp(x, w.camX + 24, w.camX + M.W - 24); this.jy = clamp(y, w.walkY[0], w.walkY[1]);
    this.vz = 330; this.airAttack = airAttack; this.airDone = false; this.anim.set('dark_mika_jump'); this.newAttack();
    this.face = sign(this.jx - this.x) || this.face;
  }
  update(dt) {
    this.tick(dt);
    if (this.freeze > 0) { this.freeze -= dt; return; }
    const s = dt / 1000, w = W(), tg = this.target();
    this.st += dt;
    switch (this.state) {
    case 'wait': break;
    case 'appear': {
      if (this.st > 500 && this.alpha < 1) this.alpha = Math.min(1, (this.st - 500) / 300);
      if (this.st > 900 && !this.jumped) { this.jumped = true; this.jumpTo(w.camX + 300, (w.walkY[0] + w.walkY[1]) / 2, 'katana_jump'); this.vz = 300; this.state = 'appearjump'; this.alpha = 1; }
      break;
    }
    case 'appearjump': case 'jump': case 'escape': {
      this.vz -= 1100 * s; this.z = Math.max(0, this.z + this.vz * s);
      const dur = (this.state === 'escape' && this.bigJump ? 0.75 : 0.6) / T.bossTuning.darkSpeed;
      this.x = approach(this.x, this.jx, Math.abs(this.jx - this.x) / Math.max(0.05, dur - this.st / 1000) * s);
      this.y = approach(this.y, this.jy, 90 * s);
      if (this.airAttack && this.vz < 120 && !this.airDone) {
        const a = this.airAttack;
        if (a === 'katana_jump') {
          if (this.anim.name !== 'dark_mika_katana_jump') this.anim.set('dark_mika_katana_jump');
          this.anim.update(dt);
          if (this.anim.i === 1) M.applyAttack(this, this.attackBox({ reach: [4, 50], band: [-10, 46], depth: 10 }), [w.mika, w.robot], { dmg: M.ENEMY_WEAPON.katana.dmg, type: 'light', dir: this.face, strike: true, weapon: 'katana' });
          if (this.anim.i >= 2) this.anim.i = 2;
        } else if (a === 'gun') {
          if (this.anim.name !== 'dark_mika_machinegun_jump_fire') this.anim.set('dark_mika_machinegun_jump_fire', { loop: true });
          this.anim.update(dt); this.gunT = (this.gunT || 0) - dt;
          if (this.gunT <= 0) { this.gunT = 90; this.fireGun('dark_mika_machinegun_jump_fire'); }
        }
      } else if (this.anim.name === 'dark_mika_jump') this.anim.i = this.st < 60 ? 0 : this.vz > 90 ? 1 : this.vz > -90 ? 2 : 3;
      if (this.z <= 0 && this.vz < 0) {
        this.z = 0;
        if (this.state === 'appearjump') { this.state = 'idle'; this.anim.set('dark_mika_katana_idle'); this.doneCb && this.doneCb(); this.doneCb = null; this.cool = 700; break; }
        this.state = 'land'; this.st = 0; this.bigJump = false; this.anim.set('dark_mika_jump'); this.anim.i = 4; M.Audio.play('land');
      }
      break;
    }
    case 'land': if (this.st > T.bossTuning.darkLandOpeningMs) this.toIdle(200); break;   // 着地後の短い隙
    case 'hurt': if (this.st > 220) this.toIdle(300); this.anim.update(dt); break;
    case 'knock': {
      this.anim.i = this.vz > 40 ? 1 : this.vz > -40 ? 2 : 2;
      this.vz -= 900 * s; this.z = Math.max(0, this.z + this.vz * s); this.x += this.vx * s;
      if (this.z <= 0 && this.vz < 0) { this.z = 0; this.state = 'down'; this.st = 0; this.anim.i = 3; M.Audio.play('enemy_down'); }
      break;
    }
    case 'down': this.anim.i = 3; if (this.st > 650) { this.state = 'getup'; this.st = 0; this.anim.set('dark_mika_getup'); } break;
    case 'getup': this.anim.update(dt); if (this.anim.done) this.bigEscape(); break;
    case 'idle': case 'run': this.think(dt, s, tg); break;
    case 'attack': this.updateAttack(dt, tg); break;
    case 'gun': this.updateGun(dt); break;
    case 'rocket': this.updateRocket(dt); break;
    case 'dying': this.updateDying(dt); break;
    }
    if (!['dying', 'wait', 'appear', 'appearjump'].includes(this.state)) {
      this.y = clamp(this.y, w.walkY[0], w.walkY[1]); this.x = clamp(this.x, w.camX + 14, w.camX + M.W - 14);
    }
  }
  toIdle(cool) { this.state = 'idle'; this.anim.set(this.katana ? 'dark_mika_katana_idle' : 'dark_mika_idle', { loop: true }); this.cool = (cool + rand(0, 300)) * this.coolMul; }
  think(dt, s, tg) {
    const w = W();
    if (!this.active) { if (this.state === 'idle') this.anim.update(dt); return; }   // 登場演出の間は動かない
    if (this.cool > 0) this.cool -= dt;
    if (this.state === 'idle') this.anim.update(dt);
    if (!tg || this.cool > 0 || w.holdAttacks) return;
    const dx = tg.x - this.x, adx = Math.abs(dx), dy = tg.y - this.y;
    this.face = sign(dx) || this.face;
    if (!this.phase2) {
      if (Math.abs(dy) <= 8 && adx < 50) return this.beginMelee();
      if (adx < 160 && Math.random() < 0.35) return this.jumpTo(tg.x - sign(dx) * 30, tg.y, this.katana ? 'katana_jump' : null);
      return this.jumpTo(tg.x + (Math.random() < 0.5 ? -1 : 1) * rand(50, 90), tg.y + rand(-10, 10), null);
    }
    // 後半: 軸を合わせて撃つ。空中から撃つことも
    if (Math.abs(dy) <= 6 && adx > 70 && adx < 260) {
      if (Math.random() < 0.38 && (this.lastRocket || 0) + 4500 < w.fxTime) { this.lastRocket = w.fxTime; this.state = 'rocket'; this.st = 0; this.anim.set('dark_mika_rocket_launcher'); this.anim.i = 0; this.fired = false; return; }
      this.state = 'gun'; this.st = 0; this.shots = 0; this.anim.set('dark_mika_machinegun_ready'); return;
    }
    if (Math.abs(dy) <= 8 && adx < 50 && Math.random() < 0.6) return this.beginMelee();
    const side = sign(this.x - tg.x) || 1;
    this.jumpTo(tg.x + side * rand(130, 170), tg.y, Math.random() < 0.3 ? 'gun' : null);
  }
  beginMelee() {
    this.newAttack(); this.state = 'attack'; this.st = 0;
    if (this.katana) { this.alt = !this.alt; this.anim.set(this.alt ? 'dark_mika_katana_vertical' : 'dark_mika_katana_horizontal'); this.atkDmg = M.ENEMY_WEAPON.katana.dmg; this.reach = [4, 50]; this.wpn = 'katana'; }
    else { const seq = ['dark_mika_punch', 'dark_mika_kick_right', 'dark_mika_kick_left']; this.combo = ((this.combo || 0) + 1) % 3; this.anim.set(seq[this.combo]); this.atkDmg = this.combo === 2 ? 3 : 2; this.reach = [6, 40]; this.wpn = null; }
    M.Audio.play('swing');
  }
  updateAttack(dt, tg) {
    const w = W(), a = this.anim;
    a.update(dt);
    if (a.i === 1) M.applyAttack(this, this.attackBox({ reach: this.reach, band: [10, 46], depth: 9 }), [w.mika, w.robot], { dmg: this.atkDmg, type: 'light', dir: this.face, strike: true, weapon: this.wpn });
    if (a.done) {
      if (!this.katana && this.combo < 2 && tg && Math.abs(tg.x - this.x) < 50) return this.beginMelee();
      this.toIdle(500);
    }
  }
  fireGun(anim) {
    const w = W(), mz = M.muzzleOf(anim, this.anim.i);
    const x = this.x + this.face * mz[0], z = this.z + mz[1];
    w.projectiles.push(new M.Shot({ team: 'enemy', src: this, kind: 'bullet', x, y: this.y, z, vx: this.face * 280, dmg: M.ENEMY_WEAPON.machinegun.dmg, anim: 'mg_bullet', range: 320 }));
    w.effects.push(new M.Effect({ x, y: this.y + 0.3, z, anim: new M.Anim('muzzle_flash'), life: 60, flip: this.face < 0 }));
    M.Audio.play('gun');
  }
  updateGun(dt) {
    if (this.anim.name === 'dark_mika_machinegun_ready') { if (this.st > 260) this.anim.set('dark_mika_machinegun_fire', { loop: true }); return; }
    this.anim.update(dt); this.gunT = (this.gunT || 0) - dt;
    if (this.gunT <= 0 && this.shots < 8) { this.gunT = 80; this.shots++; this.fireGun('dark_mika_machinegun_fire'); }
    if (this.shots >= 8 && this.gunT < -200) this.toIdle(700);
  }
  updateRocket(dt) {
    const a = this.anim;
    a.i = this.st < 380 ? 0 : 1;   // 構え（予兆）→ 発射
    if (a.i === 1 && !this.fired) {
      this.fired = true;
      const mz = M.muzzleOf('dark_mika_rocket_launcher', 1), w = W();
      w.projectiles.push(new M.Shot({ team: 'enemy', src: this, kind: 'rocket', x: this.x + this.face * mz[0], y: this.y, z: mz[1], vx: this.face * 190, dmg: M.ENEMY_WEAPON.rocket_launcher.dmg, anim: 'rocket_projectile', w: 8, h: 6, range: 330 }));
      M.Audio.play('missile');
    }
    if (this.st > 760) this.toIdle(900);
  }
  // 倒れる → 爆発 → 点滅 → 消える
  updateDying(dt) {
    const w = W();
    this.anim.update(dt);
    this.expT -= dt;
    const S = M.REF.darkMika.defeat;
    if (this.st > 450 && this.st < 450 + S.explosion_ms_proposal && this.expT <= 0) {
      this.expT = 170;
      w.effects.push(new M.Effect({ x: this.x + rand(-16, 16), y: this.y + 0.6, z: rand(4, 30), anim: new M.Anim('rocket_explosion'), life: 500 }));
      M.Audio.play('explosion'); w.shake = 1;
      M.bossDeathVoice(this.st + this.expT >= 450 + S.explosion_ms_proposal);
    }
    const b0 = 450 + S.explosion_ms_proposal;
    if (this.st > b0) this.alpha = Math.floor((this.st - b0) / S.blink_interval_ms_proposal) % 2 ? 0 : 1;
    if (this.st > b0 + S.blink_ms_proposal && !this.reported) { this.reported = true; this.alpha = 0; this.gone = true; this.onDeathDone && this.onDeathDone(this); }
  }
  draw() {
    if (this.state === 'wait' || this.gone) return;
    const w = W();
    if (this.state === 'appear') {
      // クローン装置の光
      const k = clamp(1 - Math.abs(this.st - 450) / 450, 0, 1), sx = this.devX - w.camX;
      const g = M.ctx.createRadialGradient(sx, 110, 0, sx, 110, 70);
      g.addColorStop(0, `rgba(220,255,240,${0.85 * k})`); g.addColorStop(1, 'rgba(120,255,200,0)');
      M.ctx.fillStyle = g; M.ctx.fillRect(sx - 70, 40, 140, 140);
    }
    if (this.alpha > 0) this.drawShadow();
    this.drawBody(this.anim.name, this.anim.i);
  }
}
M.DarkMika = DarkMika;

// ================================================================== ゴブリンクイーン（3面ボス）
// 歩かずワープだけ。出現でミカを向き、炎・雷・高笑いのどれか1つ → 再ワープ。後半は速く、高笑いが減る
class Queen extends Boss {
  constructor(x, y, o) {
    super(x, y, { hp: o.hp, id: 'goblin_queen', score: o.score });
    this.R = M.REF.queenRules; this.P = this.R.proposals_only;
    this.bodyW = 26; this.bodyH = 60; this.shadowW = 26;
    this.phase2At = o.phase2Ratio; this.face = -1; this.state = 'seated';
    this.anim = new M.Anim('queen_rise');
  }
  get name() { return M.REF.bossIntro.bosses.find((b) => b.id === 'goblin_queen').display_name; }
  get late() { return this.hp / this.maxHp <= this.phase2At; }
  get tm() { return this.late ? this.P.late : this.P.early; }
  canBeHit() { return !['seated', 'rise', 'hidden', 'dying', 'warp_out', 'ending'].includes(this.state) && this.alpha > 0.3; }
  get noTarget() { return this.state === 'hidden' || this.state === 'seated'; }
  beginEntrance(done) {
    // 玉座から立ち上がる（rise 各300ms）→ 高笑い800ms
    const I = M.REF.queenIntro.entrance;
    this.doneCb = done; this.state = 'rise'; this.st = 0; this.showBar = true; this.anim.set('queen_rise', { durs: [I.rise_ms / 4, I.rise_ms / 4, I.rise_ms / 4, I.rise_ms / 4], hold: true });
  }
  takeHit(att, info) {
    this.baseHit(att, info);
    if (this.hp > 0) this.hitAnimT = 200;
    return true;
  }
  onDefeated() {
    const w = W();
    this.state = 'ending'; this.st = 0; this.alpha = 1; this.anim.set('queen_hit', { hold: true });
    if (this.lightning) this.lightning = null;
    w.holdAdds = false;
    w.run.score += this.def.score;
    if (this.onDeath) this.onDeath(this);
  }
  update(dt) {
    this.tick(dt);
    if (this.hitAnimT > 0) this.hitAnimT -= dt;
    if (this.freeze > 0) { this.freeze -= dt; return; }
    const w = W(), tm = this.tm;
    this.st += dt;
    this.updateLightning(dt);
    switch (this.state) {
    case 'seated': this.anim.i = 0; break;
    case 'rise': {
      const I = M.REF.queenIntro.entrance, i = Math.min(3, Math.floor(this.st / (I.rise_ms / 4)));
      this.anim.i = i; this.x = I.rise_foot_frames[i][0]; this.y = I.rise_foot_frames[i][1];
      if (this.st >= I.rise_ms) { this.state = 'introlaugh'; this.st = 0; this.anim.set('queen_laugh', { loop: true }); M.Audio.play('queen_start'); }
      break;
    }
    case 'introlaugh':
      this.anim.update(dt);
      if (this.st >= Math.max(M.REF.queenIntro.entrance.laugh_ms, 2700)) {   // 2026-10-11 登場の声（約2.8秒）が終わるまで笑いのポーズ
      this.state = 'idle'; this.anim.set('queen_idle', { loop: true }); this.doneCb && this.doneCb(); this.doneCb = null; this.cool = 600; }
      break;
    case 'idle':
      this.anim.update(dt);
      if (this.active && !w.holdAttacks && (this.cool -= dt) <= 0) this.warpOut();
      break;
    case 'warp_out':
      this.alpha = Math.max(0, 1 - this.st / tm.warp_out_ms);
      if (this.st >= tm.warp_out_ms) { this.state = 'hidden'; this.st = 0; this.alpha = 0; this.relocate(); }
      break;
    case 'hidden':
      if (this.st >= tm.hidden_ms) { this.state = 'warp_in'; this.st = 0; w.effects.push(new M.Effect({ x: this.x, y: this.y + 0.5, z: 0, anim: new M.Anim('qfx_warp'), life: 300 })); M.Audio.play('warp'); }
      break;
    case 'warp_in': {
      this.alpha = Math.min(1, this.st / tm.warp_in_ms);
      const m = w.mika; this.face = m.x >= this.x ? 1 : -1;   // 出現でミカを向く
      if (this.st >= tm.warp_in_ms) { this.alpha = 1; this.chooseAction(); }
      break;
    }
    case 'windup': {
      this.anim.update(dt); if (this.anim.i > 1) this.anim.i = 1;
      if (this.st >= tm.windup_ms) { this.state = 'action'; this.st = 0; this.doAction(); }
      break;
    }
    case 'action': this.anim.update(dt); if (this.anim.i > 3) this.anim.i = 3; if (this.st >= 400) { this.state = 'recover'; this.st = 0; } break;
    case 'laugh': this.anim.update(dt); if (this.st >= 800) { this.state = 'recover'; this.st = 0; } break;
    case 'recover':
      if (this.anim.name !== 'queen_idle') this.anim.set('queen_idle', { loop: true });
      this.anim.update(dt);
      if (this.st >= tm.recovery_ms) this.warpOut();
      break;
    case 'ending': this.anim.update(dt); break;
    }
  }
  warpOut() {
    if (W().holdAttacks) { this.state = 'idle'; this.cool = 500; return; }
    this.state = 'warp_out'; this.st = 0;
    W().effects.push(new M.Effect({ x: this.x, y: this.y + 0.5, z: 0, anim: new M.Anim('qfx_warp'), life: 300 })); M.Audio.play('warp');
  }
  relocate() {
    const w = W(), B = this.P.warp_destination_bounds_world, m = w.mika;
    for (let k = 0; k < 20; k++) {
      const x = rand(B[0], B[1]), y = rand(B[2], B[3]);
      if (Math.hypot(x - m.x, (y - m.y) * 2) >= this.P.minimum_mika_separation_px || k === 19) { this.x = x; this.y = clamp(y, w.walkY[0], w.walkY[1]); break; }
    }
  }
  chooseAction() {
    const wts = this.tm.weights; let r = Math.random() * (wts.fire + wts.lightning + wts.laugh);
    const act = (r -= wts.fire) < 0 ? 'fire' : (r -= wts.lightning) < 0 ? 'lightning' : 'laugh';
    this.act = act; this.st = 0;
    if (act === 'laugh') { this.state = 'laugh'; this.anim.set('queen_laugh', { loop: true }); M.Audio.play('queen_laugh'); return; }
    this.state = 'windup'; this.anim.set(act === 'fire' ? 'queen_fire' : 'queen_lightning');
    M.Audio.play(act === 'fire' ? 'queen_fire' : 'queen_thunder');   // 2026-10-11 構えの声
    if (act === 'lightning') {
      // 予告の影: 予告開始時のミカの足元を狙う（その後は追わない）
      const m = W().mika;
      this.lightning = { x: m.x, y: m.y, t: 0, struck: false };
      W().holdAdds = true;   // 雷と取り巻きの攻撃を同時にしない
    }
  }
  doAction() {
    const w = W();
    if (this.act === 'fire') {
      // 炎: 前方の奥・中央・手前の三方向、頭の高さ（z30）で固定。下（スライディング）か上（ジャンプ）でかわす
      const R = this.R.fire, sp = 150;
      for (const ang of R.ground_fan_angles_degrees_proposal) {
        const a = ang * Math.PI / 180;
        w.projectiles.push(new M.Shot({ team: 'enemy', kind: 'qfire', x: this.x + this.face * 20, y: this.y, z: R.fixed_z_proposal, vx: this.face * Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.55,
          dmg: M.REF.queenRules.fire.damage, anim: 'qfx_fire', w: 9, h: 6, depth: 6, range: 340, type: 'light' }));   // 炎は吹っ飛ばし技ではない（続けて当たると吹っ飛ぶ）
      }
      M.Audio.play('fire');
    }
  }
  updateLightning(dt) {
    const L = this.lightning; if (!L) return;
    const w = W();
    L.t += dt;
    if (!L.struck && L.t >= this.P.lightning_shadow_ms) {
      L.struck = true;
      w.effects.push(new M.Effect({ x: L.x, y: L.y + 0.7, z: 0, anim: new M.Anim('qfx_lightning'), life: 400 }));
      M.Audio.play('lightning'); w.shake = 2;
      // 落雷の柱: 影の中ならジャンプしていても当たる
      const att = { hits: new Set(), x: L.x - this.face, freeze: 0 };
      M.applyAttack(att, { x0: L.x - 13, x1: L.x + 13, y: L.y, depth: 8, z0: 0, z1: 200 }, [w.mika, w.robot], { dmg: M.REF.queenRules.lightning.damage, type: 'launch', dir: sign(w.mika.x - L.x) || 1, strike: false, ranged: true });
    }
    if (L.t >= this.P.lightning_shadow_ms + 500) { this.lightning = null; w.holdAdds = false; }
  }
  draw() {
    const w = W(), L = this.lightning;
    if (L && !L.struck) {
      const k = L.t / this.P.lightning_shadow_ms, sx = Math.round(L.x - w.camX), sy = Math.round(L.y);
      M.ctx.fillStyle = `rgba(20,0,40,${0.25 + 0.35 * k})`;
      M.ctx.beginPath(); M.ctx.ellipse(sx, sy, 14, 5, 0, 0, Math.PI * 2); M.ctx.fill();
    }
    if (this.state === 'hidden') return;
    if (this.alpha > 0.05) this.drawShadow();
    let anim = this.anim.name, idx = this.anim.i;
    if (this.hitAnimT > 0 && this.state !== 'ending') { anim = 'queen_hit'; idx = this.hitAnimT > 100 ? 0 : 1; }
    if (this.state === 'seated') { anim = 'queen_rise'; idx = 0; }
    this.drawBody(anim, idx);
  }
}
M.Queen = Queen;

// ================================================================== 取り巻き（ボス専用枠。通常区間の5体枠・4体上限とは別）
class Adds {
  constructor(w, o) {
    this.w = w; this.o = o; this.spawned = 0; this.cool = 1200; this.on = false; this.side = 1;
  }
  start() { this.on = true; }
  stop() { this.on = false; }
  update(dt) {
    if (!this.on) return;
    const w = this.w, o = this.o;
    const alive = w.enemies.filter((e) => e.isAdd && !e.dead && e.state !== 'dying').length;
    if (this.coolWait && alive < o.max) { this.cool -= dt; }
    if (alive >= o.max) { this.coolWait = true; this.cool = Math.max(this.cool, o.interval); return; }
    if (o.total != null && this.spawned >= o.total) return;
    if (this.cool > 0) { this.cool -= dt; return; }
    const id = Array.isArray(o.ids) ? o.ids[this.spawned % o.ids.length] : o.ids;
    const def = M.MON[id] || M.MON.goblin;
    this.side = -this.side;
    const [w0, w1] = w.walkY, y = w0 + (w1 - w0) * rand(0.15, 0.85);
    const x = this.side < 0 ? w.camX - 30 : w.camX + M.W + 30;
    const e = new M.Enemy(def, x, y, { slot: 20 + this.spawned, enterTo: this.side < 0 ? w.camX + rand(30, 60) : w.camX + M.W - rand(30, 60) });
    e.isAdd = true; e.sectionId = w.sec.section_id; e.dropWeapon = false;
    w.enemies.push(e);
    this.spawned++; this.cool = o.interval; this.coolWait = false;
  }
}

// ボス撃破の爆発に合わせた断末魔: 爆発ごとに boom（同時1本で連打）、最後の爆発で last（長いステレオ）
M.bossDeathVoice = function (last) {
  if (last) { M.Audio.stopVoices('boss_death_boom'); M.Audio.play('boss_death_last'); }
  else M.Audio.play('boss_death_boom');
};
// 2026-10-12 ユーザー指定: 1面ボスと同じ撃破の爆発（爆発音＋断末魔を連打）→ 最後に大爆発。毎フレーム呼ぶ。大爆発を出したら true
//   o: { ms: 連続爆発の長さ, dx: 横の散らばり, z0/z1: 高さ（ボスの z からの相対）, big: 大爆発の数 }
M.bossBlast = function (b, dt, o) {
  const w = W();
  b.blastT = (b.blastT || 0) + dt; b.blastExp = (b.blastExp || 0) - dt;
  if (b.blastT < o.ms && b.blastExp <= 0) {
    b.blastExp = 150 + rand(0, 120);
    w.effects.push(new M.Effect({ x: b.x + rand(-o.dx, o.dx), y: b.y + 0.6, z: (b.z || 0) + rand(o.z0, o.z1), anim: new M.Anim('rocket_explosion'), life: 500 }));
    M.Audio.play('explosion'); w.shake = Math.max(w.shake, 2);
    M.bossDeathVoice(false);
  }
  if (b.blastT >= o.ms && !b.blastBig) {
    b.blastBig = true; w.shake = 4;
    const n = o.big || 9;
    for (let i = 0; i < n; i++) w.effects.push(new M.Effect({ x: b.x + rand(-o.dx * 1.3, o.dx * 1.3), y: b.y + 0.7, z: (b.z || 0) + rand(o.z0, o.z1 * 1.2), anim: new M.Anim('rocket_explosion'), life: 500 + i * 40 }));
    if (M.ANIMS.qfx_burst) w.effects.push(new M.Effect({ x: b.x, y: b.y + 0.8, z: (b.z || 0) + (o.z0 + o.z1) / 2, anim: new M.Anim('qfx_burst'), life: 800 }));
    M.Audio.play('explosion'); M.Audio.play('explosion', { rate: 0.7 }); M.Audio.play('hit_heavy');
    M.bossDeathVoice(true);
  }
  return !!b.blastBig;
};

// ================================================================== ボス区間の開始
M.startBoss = function (w, spec, sec) {
  const B = T.bossTuning, mid = (w.walkY[0] + w.walkY[1]) / 2, cam = w.camX;
  w.bossSpec = spec;
  if (M.startBossExt && M.startBossExt(w, spec, sec)) return;   // 2026-10-11 5I・5Jのボス（js/stage6.js）
  if (spec.type === 'goblin_mech' && spec.count) {
    // 3A終端: 半HPのゴブリンメカ2体。取り巻きなし。2体とも倒すと光の階段
    const hp = Math.round(((B.hpByStage && B.hpByStage[1]) || M.PLACEMENTS[1].boss.hp) * (spec.hp_ratio_of_stage1_boss || 0.5));
    const feet = spec.feet || w.map.specials.miniboss.feet;
    const list = feet.map((f, i) => { const b = new GoblinMech(f[0], f[1], { hp, mini: true, score: B.miniScore, delay: 300 + i * 900 }); b.autoDrop = true; if (spec.cool_mul) b.coolMul *= spec.cool_mul; return b; });
    let dead = 0;
    for (const b of list) {
      b.onDeathDone = () => { dead++; if (dead === list.length) { if (w.map.exit && w.map.exit.mode === 'light_stairs') M.openStairs(w); else w.completeSection(); } };   // 5A: 撃破でGO→右のエレベーター
      b.active = true; w.enemies.push(b); w.bosses.push(b);
    }
    w.bossCtl = { update() {} };
    M.Audio.voice('boss_encount');
    return;
  }
  let boss, introId, adds;
  spec = Object.assign({}, spec, { hp: (B.hpByStage && B.hpByStage[w.stage]) || spec.hp });   // 2026-10-08 ボスHPは面ごと（55/65/75/85）
  if (spec.type === 'goblin_mech') {
    boss = new GoblinMech(cam + 290, mid, { hp: spec.hp, score: B.mechScore }); introId = 'goblin_robot';
    adds = new Adds(w, { ids: spec.adds_enemy_id || 'goblin', max: Math.min(T.bossTuning.maxAdds, spec.adds_max_alive || 2), total: spec.adds_total, interval: spec.adds_interval_ms || 2000 });
  } else if (spec.type === 'dark_mika') {
    boss = new DarkMika(cam + 192, mid, { hp: spec.hp, phase2Ratio: spec.phase2_ratio, score: B.darkScore }); introId = 'dark_mika';
    adds = new Adds(w, { ids: spec.adds_enemy_id, max: spec.adds_max_alive, total: spec.adds_total, interval: spec.adds_interval_ms });
  } else if (spec.type === 'dandalmon') {
    // 2026-10-11 中ボス（5D）は最初から鎮座している個体（js/dandalmon.js の init）をそのまま使う
    if (spec.mid && w.dandSeat) { boss = w.dandSeat; boss.hp = boss.maxHp = spec.hp; w.dandSeat = null; }
    else boss = new M.Dandalmon(w, spec);
    introId = 'dandalmon';
    adds = { start() {}, stop() {}, update() {} };   // 取り巻きなし
  } else if (spec.type === 'goblin_queen') {
    const I = M.REF.queenIntro.entrance;
    boss = new Queen(I.rise_foot_frames[0][0], I.rise_foot_frames[0][1], { hp: spec.hp, phase2Ratio: spec.phase2_ratio, score: B.queenScore }); introId = 'goblin_queen';
    adds = new Adds(w, { ids: spec.adds, max: spec.adds_max_alive, total: spec.adds_total, interval: spec.adds_interval_ms });
  }
  if (spec.dmg_mul) boss.dmgMul = spec.dmg_mul;
  if (spec.freq_mul) boss.freqMul = spec.freq_mul;   // 2026-10-11 攻撃頻度の倍率（0.5=半分）
  if (!w.enemies.includes(boss)) w.enemies.push(boss);
  w.bosses.push(boss); w.boss = boss;
  // 登場演出（名前の表示）が終わり、ミカが動けるようになってから戦い始める
  const startFight = () => { boss.active = true; boss.cool = Math.max(boss.cool || 0, 500); adds.start(); };
  // 2026-10-11 ユーザー指定: 中ボス（5Dダンダルモンなど）は名前の演出もBGMの切り替えもなし。登場の動きだけで、そのまま戦える
  if (spec.mid && spec.type === 'dandalmon') { boss.mid = true; w.bossIntro = null; boss.seat(startFight); }   // 2026-10-11 シャッターなし。近づくと目覚めて戦い始める
  else if (spec.mid) { boss.mid = true; w.bossIntro = null; boss.beginEntrance(startFight); }
  else w.bossIntro = new BossIntro(w, boss, introId, startFight);
  // ボス部屋に残っている雑魚は消す（ボスが待ち受ける部屋にする）
  for (const e of w.enemies) if (e !== boss && !e.boss && !e.dead && !e.friendly && e.state !== 'dying') { e.remove = true; e.dead = true; }
  boss.onDeath = () => {
    adds.stop();
    w.startClear(boss, { boss: true, wait: spec.type === 'goblin_queen' });
  };
  boss.onDeathDone = () => w.bossDeathDone();
  if (spec.type === 'goblin_queen') boss.onDeathDone = null;
  // 中ボス（5Dダンダルモン）: 倒しても面クリアにしない。区間を終えて出口へ、曲はステージの曲に戻す
  if (spec.mid) {
    boss.onDeath = () => { adds.stop(); w.holdAttacks = false; };
    boss.onDeathDone = () => { if (w.song && !M.Audio.musicPlaying(w.song)) M.Audio.playMusic(w.song); w.completeSection(); };
  }
  w.bossCtl = {
    update(dt) {
      adds.update(dt);
      // クイーン: 撃破スローの後に命乞いの演出
      // 2026-10-12 クイーンも撃破の爆発（1面ボスと同じ音）→ 大爆発 → 命乞いの場面へ
      if (spec.type === 'goblin_queen' && boss.state === 'ending' && !boss.blastDoneT) { if (M.bossBlast(boss, dt, { ms: 2600, dx: 26, z0: 10, z1: 70, big: 8 })) boss.blastDoneT = 1; }
      else if (boss.blastDoneT && boss.blastDoneT < 600) boss.blastDoneT += dt;
      if (spec.type === 'goblin_queen' && w.clearSeq && w.clearSeq.phase === 'bossdeath' && !w.ending && boss.blastDoneT >= 600) w.ending = new QueenEnding(w, boss);
      if (w.ending) w.ending.update(dt);
    },
  };
};

// 3A: 光の階段（3段階1800ms）→ ミカとロボが昇って3Bへ
const STAIR = { footDx: -14, slope: 0.77, leaveMs: 900 };   // 2026-10-12 v119 足元（絵の左下）からの位置・傾き（絵の段の縁を測った値）・昇り始めてから暗転までの時間
M.openStairs = function (w) {
  const ex = w.map.exit;
  w.mapCleared = true;
  w.run.cleared[w.sec.section_id] = true;
  w.finishMapTime();
  w.timerRunning = false;
  w.stairs = { x: ex.stairs_foot[0], y: ex.stairs_foot[1], t: 0 };
  const tick = setInterval(() => {}, 1e9); clearInterval(tick);
  w.extraUpdate = (dt) => {
    const s = w.stairs; s.t += dt;
    if (s.t >= 1800 && !s.climb) {
      s.climb = true; w.lockInput = true;
      // 2026-10-12 v119 ユーザー指定: 階段の絵が途切れても同じ角度で昇り続ける。足元（階段の左下）まで歩いたら、
      //   遠く右上へ歩かせ続け、高さは「足元からの横の距離×階段の傾き」で毎フレーム決める（前は z を別の速さで上げ、着いたら z=0 に落ちていた）
      w.mika.goTo(s.x + STAIR.footDx, w.walkY[0], () => {
        s.x0 = w.mika.x; s.going = true;
        w.mika.goTo(s.x + 600, w.walkY[0], null);
        s.leaveAt = s.t + STAIR.leaveMs;
      });
    }
    if (s.going) {
      const m = w.mika;
      if (m.state === 'auto') m.z = Math.max(0, m.x - s.x0) * STAIR.slope;
      if (s.t >= s.leaveAt && !s.left) { s.left = true; w.transition(() => { w.saveCarry(false); M.setScene(new M.World(ex.to, { run: w.run, entry: 'map', onDone: w.onDone, onGameOver: w.onGameOver })); }, {}); }
    }
  };
};

// ================================================================== クイーン撃破後: 命乞い → 吹き出し4枚 → 右を指す → 横一列に着地 → ミカとロボが右へ → STAGE CLEAR
// 2026-10-12 v127 ユーザー指定: 吹き出し（画面に固定）としっぽの先にゴブリンが来るよう、全員を画面の決まった位置へ。
//   女王は爆発で玉座の前へ飛ばされ、ミカはジャンプ、ロボは走って定位置へ。x は画面の座標（camX からの距離）、吹き出しのしっぽの先は (256,155)
const QE_POS = { queen: 300, mika: [138, 196], robot: [94, 190], gob: [[190, 194], [226, 199], [262, 194]], queenHopMs: 700, queenHopH: 22, mikaAt: 250, mikaHopMs: 620, mikaHopH: 34, robotAt: 250, robotSpeed: 150 };
class QueenEnding {
  constructor(w, queen) {
    this.w = w; this.q = queen; this.t = 0; this.E = M.REF.queenEnding;
    this.seq = {}; for (const s of this.E.sequence) this.seq[s.id] = [s.start_ms_proposal, s.end_ms_proposal];
    w.cutscene = true; w.lockInput = true; w.holdAttacks = true;
    const m = w.mika; m.endWeaponHold(); m.z = 0; m.vx = 0; if (!['idle'].includes(m.state)) m.setState('idle', 'idle');
    w.effects.push(new M.Effect({ x: queen.x, y: queen.y + 0.8, z: 40, anim: new M.Anim('qfx_burst'), life: 800 }));
    M.Audio.play('explosion'); w.shake = 2;
    for (const p of w.projectiles) p.remove = true;
    this.qFrom = queen.x;   // 女王は爆発で定位置（玉座の前）へ
    // 子分3体（演出専用。敵数・撃破報酬に数えない）
    const cam = w.camX;
    this.gob = [0, 1, 2].map((i) => ({ id: 8000 + i, x: cam + M.W + 30 + i * 26, y: 190 + i * 4, z: 0, face: -1, gx: cam + QE_POS.gob[i][0], gy: QE_POS.gob[i][1],
      row: [cam + this.E.goblin_final_reposition.native_ground_feet_proposal[i][0], this.E.goblin_final_reposition.native_ground_feet_proposal[i][1]], st: 'walk', t: 0 }));
    w.extraActors = this.gob.map((g) => ({ get y() { return g.y; }, id: g.id, draw: () => this.drawGob(g) }));
    this.cardT = -1;
  }
  update(dt) {
    const w = this.w, q = this.q, S = this.seq, R = this.E.goblin_final_reposition;
    this.t += dt;
    const t = this.t;
    // 女王: 爆発 → へたり込み（生存、消さない）
    if (t >= S.slump[0] && q.anim.name !== 'queen_slump') q.anim.set('queen_slump', { hold: true });
    { const k = clamp(t / QE_POS.queenHopMs, 0, 1); q.x = this.qFrom + (w.camX + QE_POS.queen - this.qFrom) * k; q.z = Math.sin(Math.PI * k) * QE_POS.queenHopH; }
    q.face = w.mika.x > q.x ? 1 : -1;
    this.place(dt);
    // ミカとロボは女王の方を向いて待つ
    if (t < S.mika_exit_right[0]) { w.mika.face = q.x > w.mika.x ? 1 : -1; w.robot.face = q.x > w.robot.x ? 1 : -1; }
    for (const g of this.gob) {
      g.t += dt;
      if (g.st === 'walk' && t >= S.gather[0]) {
        const d = g.gx - g.x; g.x += sign(d) * Math.min(Math.abs(d), 120 * dt / 1000); g.y = approach(g.y, g.gy, 30 * dt / 1000);
        g.face = sign(d) || -1;
        if (Math.abs(d) < 1) { g.st = 'plead'; g.t = 0; }
      }
      if (g.st === 'plead') g.face = w.mika.x > g.x ? 1 : -1;   // 2026-10-12 v128 ユーザー指定: 命乞いはミカの方を向く（前は女王の方）
      if ((g.st === 'plead' || g.st === 'walk') && t >= S.take_train[0]) { g.st = 'point'; g.t = 0; g.face = 1; }
      if (g.st === 'point' && t >= S.goblins_jump_to_row[0]) { g.st = 'hop'; g.t = 0; g.fx = g.x; g.fy = g.y; }
      if (g.st === 'hop') {
        const k = clamp(g.t / R.jump_ms_proposal, 0, 1);
        g.x = g.fx + (g.row[0] - g.fx) * k; g.y = g.fy + (g.row[1] - g.fy) * k; g.z = k > 0 && k < 1 ? Math.sin(Math.PI * k) * R.jump_height_proposal : 0;
        if (k >= 1) { g.st = 'row'; g.t = 0; g.face = -1; }
      }
    }
    // 吹き出し（文字なしの絵）
    const cards = this.E.speech_card_order;
    this.card = null;
    for (const c of cards) if (t >= S[c][0] && t < S[c][1]) this.card = c;
    // 全員の着地を待ってから、ミカとロボが右へ走って退場
    if (t >= S.mika_exit_right[0] && this.gob.every((g) => g.st === 'row') && !this.exit) {
      this.exit = true;
      const m = w.mika, r = w.robot;
      m.walkoutSpeed = T.mika.dashSpeed; m.walkoutDirection = 1; m.setState('walkout', 'dash');
      r.setState('move', 'robot_move', { loop: true }); this.robotRun = true;
    }
    if (this.robotRun) { w.robot.x += 150 * dt / 1000; w.robot.face = 1; w.robot.anim.update(dt); }
    if (this.exit && w.mika.x > w.camX + M.W + 30 && w.robot.x > w.camX + M.W + 30 && !this.done) {
      this.done = true; this.robotRun = false;
      w.clearSeq.offscreen = true;
      w.clearReady();   // ここで初めてクリア曲（命乞い中には流さない）
    }
  }
  // 2026-10-12 v127: ミカはジャンプで、ロボは走って定位置へ（演出中は本体の update が止まっているので、ここで直接動かす）
  place(dt) {
    const w = this.w, m = w.mika, r = w.robot, P = QE_POS, t = this.t;
    if (!this.mHop && t >= P.mikaAt) {
      const tx = w.camX + P.mika[0];
      this.mHop = { x0: m.x, y0: m.y, x1: tx, y1: P.mika[1], t: 0, skip: Math.abs(tx - m.x) < 6 && Math.abs(P.mika[1] - m.y) < 4 };
      if (!this.mHop.skip) { m.anim.set('jump', { hold: true }); M.Audio.play('jump'); }
    }
    const h = this.mHop;
    if (h && !h.done) {
      h.t += dt;
      const k = h.skip ? 1 : clamp(h.t / P.mikaHopMs, 0, 1);
      m.x = h.x0 + (h.x1 - h.x0) * k; m.y = h.y0 + (h.y1 - h.y0) * k; m.z = Math.sin(Math.PI * k) * P.mikaHopH;
      if (!h.skip) { m.anim.set('jump', { hold: true }); m.anim.i = k < 0.25 ? 1 : k < 0.55 ? 2 : 3; }
      if (k >= 1) { h.done = true; m.z = 0; if (!h.skip) { m.setState('idle', 'idle'); M.Audio.play('land'); } }
    }
    if (t >= P.robotAt && !this.exit && !this.robotPlaced) {
      const tx = w.camX + P.robot[0], ty = P.robot[1], dx = tx - r.x, dy = ty - r.y, st = P.robotSpeed * dt / 1000;
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
        if (r.state !== 'move') r.setState('move', 'robot_move', { loop: true });
        r.x += clamp(dx, -st, st); r.y += clamp(dy, -st * 0.75, st * 0.75); r.anim.update(dt);
      } else { this.robotPlaced = true; r.setState('idle', 'robot_idle', { loop: true }); }
    }
  }
  drawGob(g) {
    const sx = g.x - this.w.camX;
    M.ctx.fillStyle = 'rgba(0,0,0,0.28)'; M.ctx.fillRect(Math.round(sx) - 9, Math.round(g.y) - 1, 18, 3);
    let anim = 'goblin_walk', i = Math.floor(g.t / 110) % 6;
    if (g.st === 'plead') { anim = 'goblin_plead'; i = Math.floor(g.t / 220) % 4; }
    if (g.st === 'point') { anim = 'goblin_point'; i = Math.min(3, Math.floor(g.t / 100)); }
    if (g.st === 'hop') { anim = 'goblin_event_hop'; i = 0; }
    if (g.st === 'row') { anim = 'goblin_plead'; i = 1; }
    M.drawAnim(anim, i, sx, g.y - g.z, g.face > 0);
  }
  drawOverlay() {
    if (!this.card) return;
    const bx = 80, by = 18;
    M.drawFrame('speech_bubble', bx, by, [0, 0], false);
    M.drawFrame('story_' + this.card, bx + 16, by + 8, [0, 0], false);
  }
}
M.QueenEnding = QueenEnding;
})();
