// actors.js — ミカ・敵・ロボ・弾・小物・演出
'use strict';
(function () {
const M = window.MIKA, T = M.TUNING, I = M.Input;
const AN = M.ANIMS;
const { clamp, rand, sign, approach } = M;

// ================================================================== 共通
let attackSerial = 1;
class Actor {
  constructor(x, y) {
    this.x = x; this.y = y; this.z = 0;
    this.vx = 0; this.vy = 0; this.vz = 0;
    this.face = 1; this.freeze = 0; this.invuln = 0;
    this.state = 'idle'; this.st = 0;
    this.anim = new M.Anim('idle');
    this.dead = false; this.remove = false; this.alpha = 1;
    this.bodyW = 22; this.bodyH = 44; this.shadowW = 18;
    this.hits = null; this.attackId = 0;
  }
  setState(s, anim, opts) { this.state = s; this.st = 0; if (anim) this.anim.set(anim, opts); }
  get w() { return M.world; }
  hurtbox() { return { x0: this.x - this.bodyW / 2, x1: this.x + this.bodyW / 2, y: this.y, z0: this.z, z1: this.z + this.bodyH }; }
  // 攻撃の箱（向きを考慮）
  attackBox(mv, zOff = 0) {
    const r0 = mv.reach[0], r1 = mv.reach[1];
    const x0 = this.face > 0 ? this.x + r0 : this.x - r1, x1 = this.face > 0 ? this.x + r1 : this.x - r0;
    return { x0, x1, y: this.y, depth: mv.depth, z0: this.z + zOff + mv.band[0], z1: this.z + zOff + mv.band[1] };
  }
  newAttack() { this.attackId = attackSerial++; this.hits = new Set(); }
  physicsAir(dt, grav) {
    const s = dt / 1000;
    this.vz -= grav * s; this.z += this.vz * s;
    this.x += this.vx * s; this.y += this.vy * s;
    if (this.z <= 0) { this.z = 0; return true; }
    return false;
  }
  drawShadow() {
    if (this.noShadow) return;   // 2026-10-11 4A→4Bの飛び込み中（屋根の奥へ消える間）は影を出さない
    const sx = Math.round(this.x - M.world.camX), sy = Math.round(this.y);
    const k = clamp(1 - this.z / 120, 0.5, 1), w = Math.round(this.shadowW * k);
    M.ctx.fillStyle = 'rgba(0,0,0,0.28)';
    M.ctx.fillRect(sx - (w >> 1), sy - 1, w, 3);
    M.ctx.fillRect(sx - (w >> 1) + 2, sy - 2, w - 4, 5);
  }
  drawSprite(anim, idx, extraZ = 0) {
    if (this.alpha <= 0) return;
    M.drawAnim(anim || this.anim.name, idx === undefined ? this.anim.i : idx,
      this.x - M.world.camX + (this.shakeX || 0), this.y - this.z - extraZ, this.face > 0, this.alpha, this.variant);
  }
}
M.Actor = Actor;

function overlap(box, hb) {
  return box.x0 <= hb.x1 && box.x1 >= hb.x0 && (hb.anyDepth || Math.abs(box.y - hb.y) <= box.depth) && box.z0 <= hb.z1 && box.z1 >= hb.z0;   // anyDepth: 巨大ボスはどの奥行きからでも当たる
}
M.overlap = overlap;

// 攻撃判定を対象群に当てる。当たった数を返す。
function applyAttack(att, box, targets, info) {
  let n = 0;
  for (const t of targets) {
    if (t === att || t.dead) continue;
    if (att.hits.has(t)) continue;
    if (!t.canBeHit || !t.canBeHit(info)) continue;
    const hb = t.hurtbox();
    if (!overlap(box, hb)) continue;
    att.hits.add(t);
    // 実際の接触点: 攻撃側から見た相手の当たり判定の表面（攻撃範囲の中）。高さは重なりの中央
    const dir = info.dir || (t.x >= (att.x != null ? att.x : t.x) ? 1 : -1);
    const cx = dir > 0 ? Math.max(hb.x0, box.x0) : Math.min(hb.x1, box.x1);
    const cz = (Math.max(box.z0, hb.z0) + Math.min(box.z1, hb.z1)) / 2;
    M._contact = { x: cx, y: hb.y, z: cz, info, dir, shot: att.kind, used: false, player: att === M.world.mika || att.team === 'player' || att.owner === M.world.mika };
    if (t.takeHit(att, info)) n++;
    M._contact = null;
  }
  if (T.prototype.showHitboxes && M.world.debugBoxes) M.world.debugBoxes.push({ box, color: n ? '#f00' : '#ff0' });
  return n;
}
M.applyAttack = applyAttack;

// ================================================================== 演出（エフェクト）
class Effect {
  constructor(o) { Object.assign(this, { t: 0, life: 300, z: 0 }, o); }
  update(dt) {
    if (this.delay > 0) { this.delay -= dt; return; }
    this.t += dt;
    if (this.anim) this.anim.update(dt);
    if (this.vy) { this.y += this.vy * dt / 1000; }
    if (this.t >= this.life || (this.anim && this.anim.done && !this.anim.loop)) this.remove = true;
  }
  draw() {
    if (this.delay > 0) return;
    const sx = Math.round(this.x - M.world.camX), sy = Math.round(this.y - this.z);
    const ctx = M.ctx;
    if (this.kind === 'label') {
      M.text(this.text, sx, sy - this.t / 40, { color: this.color || '#fff', align: 'center' });
    } else if (this.anim) {
      M.drawAnim(this.anim.name, this.anim.i, sx, sy, this.flip ? false : true);
    }
  }
}
M.Effect = Effect;

// 2026-10-11 v034 SMASH!: 文字描画を画像3種（smash_a/b/c）に。出すたびに柄を順送り（同じ柄が続かない）。
//   画面に出るのは1枚だけ。90ms以内の連打は文字を出し直さず、当たった所の光だけ足す（最大2つ）。命中点の少し上、画面端では内側に収める。
//   左向きでも文字は反転しない。音・ヒットストップ・揺れは呼び出し側（今まで通り）で、ここでは何も鳴らさない。
const SMASH = { dur: 480, gap: 90, rot: [-0.035, 0.04, -0.025], keys: ['smash_a', 'smash_b', 'smash_c'], width: 110 };
class SmashFx {
  constructor() { this.t = 0; this.last = -1; this.lastAt = -1e9; this.popup = null; this.bursts = []; this.serial = 0; }
  trigger(x, y) {   // x, y: 画面座標
    this.serial++;
    this.bursts.push({ x, y, t: 0, seed: this.serial }); if (this.bursts.length > 2) this.bursts.shift();
    if (this.t - this.lastAt < SMASH.gap) return;
    this.last = (this.last + 1) % 3;
    this.popup = { v: this.last, x: M.clamp(x, 66, M.W - 66), y: M.clamp(y - 22, 36, 160), t: 0 };
    this.lastAt = this.t;
  }
  update(dt) {
    this.t += dt;
    if (this.popup && (this.popup.t += dt) >= SMASH.dur) this.popup = null;
    for (const b of this.bursts) b.t += dt;
    this.bursts = this.bursts.filter((b) => b.t < 250);
  }
  draw() {
    const ctx = M.ctx;
    for (const b of this.bursts) {
      const u = b.t / 250;
      ctx.save(); ctx.translate(b.x, b.y); ctx.globalAlpha = 1 - u;
      ctx.strokeStyle = u < 0.3 ? '#fffbd6' : '#ffd06a'; ctx.lineWidth = u < 0.3 ? 2 : 1;
      for (let i = 0; i < 9; i++) {
        const a = i * Math.PI * 2 / 9 + b.seed * 0.37, r = 4 + u * 23, len = 5 + u * 10;
        ctx.beginPath(); ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); ctx.lineTo(Math.cos(a) * (r + len), Math.sin(a) * (r + len)); ctx.stroke();
      }
      if (u < 0.3) { ctx.fillStyle = '#fff8db'; ctx.beginPath(); ctx.arc(0, 0, 4 * (1 - u / 0.3), 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    }
    const p = this.popup; if (!p) return;
    const f = M.ATLAS.frames[SMASH.keys[p.v]]; if (!f) return;
    const [pg, fx, fy, fw, fh] = f, u = p.t / SMASH.dur;
    const sc = u < 0.17 ? 0.65 + u / 0.17 * 0.5 : u < 0.35 ? 1.15 - (u - 0.17) / 0.18 * 0.15 : 1;
    const w = SMASH.width * sc, h = w * fh / fw;
    ctx.save(); ctx.translate(p.x, p.y - 7 * u); ctx.rotate(SMASH.rot[p.v]);
    ctx.globalAlpha = Math.max(0, Math.min(1, u / 0.045, (1 - u) / 0.25));
    const sm = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = true;
    ctx.drawImage(M.atlasPage(pg), fx, fy, fw, fh, -w / 2, -h / 2, w, h);
    ctx.imageSmoothingEnabled = sm; ctx.restore();
  }
}
// 呼び出し: 世界座標の命中点（x, y=床, z=高さ）。ワールドごとに1つ
M.spawnSmash = function (x, y, z) {
  const w = M.world; if (!w) return;
  if (!w.smashFx) w.smashFx = new SmashFx();
  w.smashFx.trigger(Math.round(x - w.camX), Math.round(y - z));
};
// ヒット火花（v117 fx/hit_spark 4コマ・非ループ）。判定上の命中が確定した時だけ、接触点に1回出す
// ヒット（MIKA_HIT_EFFECTS_v002 の鋭い白い星形）。実際の接触点に一度だけ出し、相手には追従しない。
//   小=通常打撃 / 大=重い攻撃・吹っ飛ばし / 弾=マシンガン / 斬=刀。武器の接触火花（WEAPON_CONTACT_FX）がある武器はそちらだけ（二重にしない）
const CONTACT_WEAPONS = { war_axe: 1, battle_hammer: 1, gungnir: 1, yoichi_bow: 1 };
if (AN.wfx_contact_spark === undefined && M.ATLAS.frames.wfx_contact_spark) AN.wfx_contact = { frames: ['wfx_contact_spark'], dur: [110], origin: [12, 12], loop: false };
function hitKind(c) {
  const info = c.info || {};
  if (c.shot === 'bullet' || info.weapon === 'machinegun' || (info.robot && info.type === 'light')) return 'bullet';
  if (info.weapon === 'katana') return 'slash';
  if (info.weapon && CONTACT_WEAPONS[info.weapon] && c.player) return 'contact';
  if (info.finisher || info.smash || info.thrownBody || info.thrownLand || (info.type === 'launch' && info.dmg >= 4) || info.dmg >= 6 || (info.weapon && CONTACT_WEAPONS[info.weapon])) return 'heavy';
  return 'small';
}
class HitFx {
  constructor(o) { Object.assign(this, o); this.t = 0; this.an = new M.Anim(o.anim, { loop: false }); }
  update(dt) { this.t += dt; this.an.update(dt); if (this.an.done || this.t > 400) this.remove = true; }
  draw() {
    const sx = this.x - M.world.camX, sy = this.y - this.z;
    M.drawFrameX(M.ANIMS[this.an.name].frames[this.an.i], sx, sy, { scale: this.scale, rot: this.rot, flip: this.flip });
  }
}
M.HitFx = HitFx;
function spark(x, y, z) {
  const c = M._contact, w = M.world;
  let kind = 'small', dir = 1;
  if (c && !c.used) { c.used = true; x = c.x; y = c.y; z = c.z; dir = c.dir || 1; kind = hitKind(c); }
  else if (c && c.used) return;   // 同じ命中で二重に出さない
  const R = (a, b) => a + Math.random() * (b - a);
  if (kind === 'contact') { w.effects.push(new HitFx({ x, y: y + 1, z, anim: 'wfx_contact', scale: 1, rot: 0, flip: dir < 0 })); return; }
  const spec = { small: ['hitfx_small', 0.9, 1.05, 10], heavy: ['hitfx_heavy', 0.9, 1.05, 10], bullet: ['hitfx_bullet', 0.8, 1.15, 35], slash: ['hitfx_slash', 1, 1, 0] }[kind];
  if (!M.ANIMS[spec[0]]) { w.effects.push(new Effect({ x, y: y + 0.5, z, anim: new M.Anim('hit_spark', { loop: false }), life: 400 })); return; }
  w.effects.push(new HitFx({ x, y: y + 1, z, anim: spec[0], scale: R(spec[1], spec[2]), rot: R(-spec[3], spec[3]) * Math.PI / 180, flip: kind === 'slash' && dir < 0 }));
}
M.spark = spark;
// アトラスのコマを中心基準で、拡大・回転・反転して描く（滑らかな補間は smooth:true の時だけ）
M.drawFrameX = function (name, cx, cy, o = {}) {
  const f = M.ATLAS.frames[name]; if (!f) return;
  const [pg, sx, sy, tw, th, ox, oy, cw, ch] = f;
  const ctx = M.ctx, ax = o.ax != null ? o.ax : cw / 2, ay = o.ay != null ? o.ay : ch / 2;
  ctx.save();
  if (o.alpha != null) ctx.globalAlpha = o.alpha;
  if (o.smooth) { ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; }
  if (o.filter) ctx.filter = o.filter;
  ctx.translate(Math.round(cx), Math.round(cy));
  if (o.rot) ctx.rotate(o.rot);
  const s = o.scale || 1; ctx.scale(o.flip ? -s : s, s);
  ctx.drawImage(M.atlasPage(pg), sx, sy, tw, th, ox - ax, oy - ay, tw, th);
  ctx.restore();
};

// 斬風エフェクト（MIKA_ATTACK_FX v001）: 絵だけでダメージ判定は持たない。ミカに取り付けて追従し、
// ヒットストップ中はミカと同じ時計で止まる（ポーズ中は世界ごと止まる）。第3コマで透明度1→0
class AttachedFx {
  constructor(owner, anim, off) {
    this.owner = owner; this.off = off; this.face = owner.face;
    this.anim = new M.Anim(anim, { loop: false });
    this.y = owner.y + 0.6; this.alpha = 1;
  }
  update(dt) {
    if (this.owner.freeze > 0) return;
    this.anim.update(dt);
    this.alpha = this.anim.i >= 2 ? Math.max(0, 1 - this.anim.t / (this.anim.durs[2] || 50)) : 1;
    if (this.anim.done) this.remove = true;
  }
  draw() {
    const o = this.owner;
    M.drawAnim(this.anim.name, this.anim.i, o.x - M.world.camX + this.face * this.off[0], o.y - o.z + this.off[1], this.face > 0, this.alpha);
  }
}
M.AttachedFx = AttachedFx;
function spawnAttackFx(owner, move) {
  if (move === 'somersault') M.world.effects.push(new AttachedFx(owner, 'fx_somersault', [0, 0]));     // 足元原点・高さは一度だけ引く
  else if (move === 'jump_kick') M.world.effects.push(new AttachedFx(owner, 'fx_jump_kick', T.fxTips.jump_kick));
  else if (T.fxTips[move]) M.world.effects.push(new AttachedFx(owner, 'fx_melee', T.fxTips[move]));
}

// ミカは js/mika.js
// ================================================================== ロボ（自律支援）
const RB = T.robot;
class Robot extends Actor {
  constructor(x, y) {
    super(x, y);
    this.team = 'player';
    this.maxHp = RB.maxHp; this.hp = this.maxHp;
    this.bodyW = 30; this.bodyH = 40; this.shadowW = 30;
    this.smgCool = 1200; this.missileCool = RB.missileCooldownMs * 0.6;
    this.killsSinceBroken = 0;
    this.hits = new Set();
    this.setState('entrance', 'robot_move', { loop: true });
    this.fx = new M.Anim('robot_fault_fx', { loop: true });
  }
  targetable() { return !['broken', 'revive', 'entrance'].includes(this.state) && !(this.state.startsWith('rescue') && RB.rescueInvulnerable); }
  canBeHit() { return this.targetable() && this.invuln <= 0; }
  takeHit(att, info) {
    const hp0 = this.hp, src = att && (att.src || att.owner || att);
    if (src && src.dmgMul) info = Object.assign({}, info, { dmg: info.dmg * src.dmgMul });   // 2026-10-12 v131 6Fのダークミカは攻撃力半分
    this.hp = Math.max(0, this.hp - info.dmg);
    if (this.hp > 0 && this.hp < this.maxHp * 0.25 && hp0 >= this.maxHp * 0.25) M.world.onRobotLowHp && M.world.onRobotLowHp();   // 2026-10-11 HP25%を切った（ロボの声）
    spark(this.x, this.y, this.z + 24, false); M.Audio.play(info && info.se === 'fg_attack_hit' ? info.se : 'hurt', { robot: true });   // 2026-10-12 v103 長老の杖は専用の音。ロボの被弾: ミカと同じ音を少し高く小さく
    if (!info.flame) att.freeze = this.freeze = 60;
    this.invuln = 400;
    if (this.hp <= 0) {
      this.setState('broken', 'robot_broken', { hold: true }); this.killsSinceBroken = 0; this.repairT = 0;
      M.world.onRobotBroken();
    } else this.setState('hurt', info.dmg >= 8 ? 'robot_damage_heavy' : 'robot_damage_light');
    return true;
  }
  onKill() {
    if (this.state === 'broken') this.killsSinceBroken++;   // 2026-10-08 修理は時間制（repairMs）。撃破数は記録だけ
  }
  update(dt) {
    if (this.invuln > 0) this.invuln -= dt;
    if (this.freeze > 0) { this.freeze -= dt; return; }
    this.st += dt;
    const w = M.world, m = w.mika, s = dt / 1000;
    if (this.smgCool > 0) this.smgCool -= dt;
    if (this.missileCool > 0) this.missileCool -= dt;
    switch (this.state) {
    case 'entrance': {
      const dir = w.rtl ? -1 : 1;
      this.anim.update(dt); this.face = dir;
      this.x += dir * T.mika.entranceSpeed * s;
      if (dir * (this.x - (w.entranceTo - dir * RB.followOffsetX * -1)) >= 0) this.setState('idle', 'robot_idle', { loop: true });
      break;
    }
    case 'idle': case 'move': {
      // 救命は何より優先
      if (m.state === 'defeated') { this.setState('rescue_go', 'robot_move', { loop: true }); break; }
      const tgt = w.bossIntro && !w.bossIntro.done ? null : this.combatTarget(dt);   // ボス登場演出の間はミカの後ろへ
      let tx, ty, sp = RB.speed;
      if (tgt) {
        // 戦闘中: ミカへの追従より、敵の位置と射線を優先して自由に動く
        if (!this.side || this.sideT <= 0) { this.side = sign(this.x - tgt.x) || -sign(tgt.face) || 1; this.sideT = 1500; }
        this.sideT -= dt;
        let side = this.side;
        const lo = w.camX + 16, hi = w.camX + M.W - 16;
        if (tgt.x + side * RB.fireDistance < lo || tgt.x + side * RB.fireDistance > hi) side = this.side = -side;
        tx = tgt.x + side * RB.fireDistance;
        ty = tgt.y + (this.laneOffset || 0);
        // 近くで敵がこちらを狙っていたら、軸を外して距離を取る
        const threat = w.enemies.find((e) => !e.dead && e.state !== 'dying' && Math.abs(e.x - this.x) < RB.dodgeRange && Math.abs(e.y - this.y) < 8 && (e.state === 'attack' || e.state === 'approach'));
        if (threat) { tx = this.x + sign(this.x - threat.x || side) * 40; ty = this.y + (this.y < (w.walkY[0] + w.walkY[1]) / 2 ? 22 : -22); sp *= 1.3; }
        // 射線が合っていれば、移動の途中でも撃つ（ミカとの距離のために撃つのをやめない）
        if (this.smgCool <= 0 && Math.abs(tgt.y - this.y) <= RB.smgDepth && Math.abs(tgt.x - this.x) <= RB.smgRange && Math.abs(tgt.x - this.x) > 14) {
          this.face = sign(tgt.x - this.x) || this.face;
          if (this.missileCool <= 0) { this.setState('missile', 'robot_missile'); this.shotTarget = tgt; this.missileCool = RB.missileCooldownMs; break; }
          this.setState('smg', 'robot_smg'); this.burst = 0; this.shotT = 0; break;
        }
      } else {
        // 敵がいない時だけミカについてくる
        tx = m.x + (m.face > 0 ? RB.followOffsetX : -RB.followOffsetX); ty = m.y + RB.followOffsetY;
      }
      tx = clamp(tx, w.camX + 18, w.camX + M.W - 18);
      ty = clamp(ty, w.walkY[0], w.walkY[1]);
      const ddx = tx - this.x, ddy = ty - this.y;
      if (Math.abs(ddx) > 4 || Math.abs(ddy) > 2) {
        this.x += clamp(ddx, -sp * s, sp * s);
        this.y += clamp(ddy, -sp * 0.75 * s, sp * 0.75 * s);
        this.face = tgt ? sign(tgt.x - this.x) || this.face : (Math.abs(ddx) > 4 ? sign(ddx) : this.face);
        if (this.state !== 'move') this.setState('move', 'robot_move', { loop: true });
      } else {
        this.face = tgt ? sign(tgt.x - this.x) || this.face : m.face;
        if (this.state !== 'idle') this.setState('idle', 'robot_idle', { loop: true });
      }
      this.anim.update(dt);
      break;
    }
    case 'smg': {
      const a = this.anim;
      // ready→(fire を連射数ぶん)→recoil→recover
      if (a.i === 1) {
        this.shotT -= dt;
        if (this.shotT <= 0 && this.burst < RB.smgBullets) {
          const mp = AN.robot_smg.muzzle_points[1];
          const ox = this.face > 0 ? mp[0] - 48 : -(mp[0] - 48) ;
          w.projectiles.push(new Bullet(this, this.x + ox, this.y, 77 - mp[1], this.face));
          w.effects.push(new Effect({ x: this.x + ox, y: this.y + 0.3, z: 77 - mp[1], anim: new M.Anim('muzzle_flash'), life: 60, flip: this.face < 0 }));
          M.Audio.play('gun', { robot: true });
          this.burst++; this.shotT = 70;
        }
        if (this.burst < RB.smgBullets) { a.t = 0; break; }
      }
      a.update(dt);
      if (a.done) { this.smgCool = RB.smgCooldownMs; this.setState('idle', 'robot_idle', { loop: true }); }
      break;
    }
    case 'missile': {
      const a = this.anim; a.update(dt);
      if (a.i === 2 && !this.launched) {
        this.launched = true;
        const lp = AN.robot_missile.launch_point;
        const ox = this.face > 0 ? lp[0] - 48 : -(lp[0] - 48);
        w.projectiles.push(new Missile(this, this.x + ox, this.y, 77 - lp[1], this.shotTarget));
        M.Audio.play('missile', { robot: true });
      }
      if (a.done) { this.launched = false; this.smgCool = 600; this.setState('idle', 'robot_idle', { loop: true }); }
      break;
    }
    case 'hurt': this.anim.update(dt); if (this.st > 220) this.setState('idle', 'robot_idle', { loop: true }); break;
    case 'broken': {
      this.anim.update(dt); this.fx.update(dt);
      // 修理: 戦闘が動いている間だけ進む（演出中・ポーズ中は止まる）
      if (!w.lockInput && !w.cutscene && !w.clearSeq) this.repairT = (this.repairT || 0) + dt;
      if (this.repairT >= RB.repairMs) { this.setState('revive', 'robot_revive'); this.flag = new M.Anim('robot_flag_retract'); }
      break;
    }
    case 'revive': {
      this.anim.update(dt); if (this.flag) this.flag.update(dt);
      if (this.anim.done) { this.hp = this.maxHp;   /* 2026-10-12 v119 ユーザー指定: 復活したら全快（前は reviveHpRatio） */ this.invuln = 1200; this.setState('idle', 'robot_idle', { loop: true }); w.onRobotRevived(); }
      break;
    }
    case 'rescue_go': {
      this.anim.update(dt);
      // 目標はかならず歩ける範囲・画面内に収める（ミカが手前の端で倒れると、届かない位置を目指して止まっていた）
      const ty = clamp(m.y + 2, w.walkY[0], w.walkY[1]);
      let goal = m.x + (this.x < m.x ? -24 : 24);
      if (goal < w.camX + 12 || goal > w.camX + M.W - 12) goal = m.x - (goal - m.x);
      goal = clamp(goal, w.camX + 12, w.camX + M.W - 12);
      const ddx = goal - this.x, ddy = ty - this.y;
      this.face = sign(m.x - this.x) || 1;
      this.x += clamp(ddx, -RB.speed * 1.4 * s, RB.speed * 1.4 * s); this.y += clamp(ddy, -RB.speed * s, RB.speed * s);
      // 着いたら救命開始（念のため、3秒たっても着かなければその場で始める）
      if ((Math.abs(ddx) < 2 && Math.abs(ddy) < 2) || this.st > 3000) { this.setState('rescue', 'robot_rescue'); this.rescueT = 0; w.onRescueStart(); }
      break;
    }
    case 'rescue': {
      this.rescueT += dt;
      const a = this.anim; a.update(dt);
      // 治療ループ（press↔release）
      if (this.rescueT < RB.rescueMs && a.i >= 3) { a.i = 1; a.t = 0; }
      if (a.done) a.done = false, (a.i = 1);
      if (this.rescueT >= RB.rescueMs) { this.setState('idle', 'robot_idle', { loop: true }); w.onRescueDone(); }
      break;
    }
    }
    this.y = clamp(this.y, w.walkY[0], w.walkY[1]);
    // 画面外に取り残されたら合流（壊れている時は画面端に押し出されてついてくる）
    if (this.state === 'broken') this.x = clamp(this.x, w.camX + 12, w.camX + M.W - 12);
    else if (!['entrance', 'rescue', 'revive'].includes(this.state)) {
      if (this.x < w.camX - 70) this.x = w.camX - 24;
      if (this.x > w.camX + M.W + 70) this.x = w.camX + M.W + 24;
      if (this.x < w.camX + 10) this.x = Math.min(w.camX + 10, this.x + RB.speed * 1.5 * s);
      if (this.x > w.camX + M.W - 10) this.x = Math.max(w.camX + M.W - 10, this.x - RB.speed * 1.5 * s);
    }
  }
  // 戦闘中の狙い: ミカを攻撃中の敵を優先、なければロボに近い敵。数秒は同じ相手を追う
  combatTarget(dt) {
    const w = M.world, ok = (e) => e && !e.dead && !e.dormant && !e.noTarget && !['dying', 'down', 'thrown', 'grabbed', 'drop', 'hidden', 'warp_out', 'warp_in'].includes(e.state) && e.x > w.camX - 8 && e.x < w.camX + M.W + 8;
    this.retargetT = (this.retargetT || 0) - dt;
    if (ok(this.tgt) && this.retargetT > 0) return this.tgt;
    const list = w.enemies.filter(ok);
    if (!list.length) { this.tgt = null; return null; }
    const onMika = list.filter((e) => e.state === 'attack' && e.target && e.target() === w.mika);
    const pool = onMika.length ? onMika : list;
    pool.sort((a, b) => (Math.abs(a.x - this.x) + Math.abs(a.y - this.y) * 2) - (Math.abs(b.x - this.x) + Math.abs(b.y - this.y) * 2));
    this.tgt = pool[0]; this.retargetT = RB.retargetMs;
    this.laneOffset = (Math.random() < 0.5 ? -1 : 1) * Math.floor(Math.random() * 4);
    return this.tgt;
  }
  findTarget() {
    let best = null, bd = 1e9;
    for (const e of M.world.enemies) {
      if (e.dead || ['dying', 'down', 'thrown', 'grabbed'].includes(e.state)) continue;
      const dx = Math.abs(e.x - this.x);
      if (dx > RB.smgRange || e.x < M.world.camX || e.x > M.world.camX + M.W) continue;
      const d = dx + Math.abs(e.y - this.y) * 3;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }
  draw() {
    this.drawShadow();
    if (this.invuln > 0 && this.state !== 'revive' && ((this.invuln / 60) | 0) % 2) return;
    this.drawSprite();
    const sx = this.x - M.world.camX, sy = this.y - this.z;
    // 煙・電気・白旗は頭の取り付け位置 head_attachment [52,46]（ロボ原点[48,77]から +4,-31）
    if (this.state === 'broken') M.drawAnim('robot_fault_fx', this.fx.i, sx + this.face * 4, sy - 31, this.face > 0);
    if (this.state === 'revive' && this.flag && !this.flag.done) M.drawAnim('robot_flag_retract', this.flag.i, sx + this.face * 4, sy - 31, this.face > 0);
    if (this.state === 'broken') this.drawRepair(Math.round(sx), Math.round(sy));
  }
  // 修理中: 頭の上に小さな残り秒と、右へ伸びる緑のバー
  drawRepair(sx, sy) {
    const ctx = M.ctx, k = clamp((this.repairT || 0) / RB.repairMs, 0, 1), left = Math.max(0, Math.ceil((RB.repairMs - (this.repairT || 0)) / 1000));
    const bw = 26, bx = sx - bw / 2, by = sy - 60;
    ctx.fillStyle = '#10141c'; ctx.fillRect(bx - 1, by - 1, bw + 2, 5);
    ctx.fillStyle = '#1d3a22'; ctx.fillRect(bx, by, bw, 3);
    ctx.fillStyle = '#4cff6a'; ctx.fillRect(bx, by, Math.round(bw * k), 3);
    ctx.fillStyle = '#c8ffd0'; ctx.fillRect(bx, by, Math.round(bw * k), 1);
    M.text(String(left), sx, by - 10, { align: 'center', color: '#8dff9c' });
  }
}
M.Robot = Robot;

// ================================================================== 弾
class Bullet {
  constructor(owner, x, y, z, dir) {
    this.owner = owner; this.x = x; this.y = y; this.z = z; this.dir = dir;
    this.t = 0; this.hits = new Set(); this.anim = new M.Anim('mg_bullet');
  }
  update(dt) {
    this.t += dt; this.anim.update(dt);
    this.x += this.dir * T.robot.bulletSpeed * dt / 1000;
    const box = { x0: this.x - 4, x1: this.x + 4, y: this.y, depth: T.robot.smgDepth - 4, z0: this.z - 6, z1: this.z + 4 };
    const n = applyAttack(this, box, M.world.enemies, { dmg: T.robot.smgDamage, type: 'light', dir: this.dir, ranged: true, strike: false, robot: true });
    if (n || this.x < M.world.camX - 20 || this.x > M.world.camX + M.W + 20) this.remove = true;
  }
  draw() { M.drawAnim('mg_bullet', this.anim.i, this.x - M.world.camX, this.y - this.z, this.dir > 0); }
}
class Missile {
  constructor(owner, x, y, z, target) {
    this.owner = owner; this.x = x; this.y = y; this.z = z; this.t = 0; this.hits = new Set();
    const tx = target ? target.x : x + owner.face * 120, ty = target ? target.y : y;
    this.sx = x; this.sy = y; this.sz = z; this.tx = tx; this.ty = ty; this.dur = 700;
  }
  update(dt) {
    this.t += dt;
    const k = Math.min(1, this.t / this.dur);
    const px = this.x, pz = this.z;
    this.x = this.sx + (this.tx - this.sx) * k;
    this.y = this.sy + (this.ty - this.sy) * k;
    this.z = this.sz * (1 - k) + Math.sin(k * Math.PI) * 50;
    this.ang = Math.atan2(this.z - pz, Math.abs(this.x - px) + 0.001) * 180 / Math.PI;
    this.dirX = sign(this.x - px) || 1;
    if (k >= 1) {
      this.remove = true;
      M.world.effects.push(new Effect({ x: this.x, y: this.y + 0.5, z: 0, anim: new M.Anim('rocket_explosion'), life: 500 }));
      M.Audio.play('explosion', { robot: true }); M.world.shake = 2;
      const box = { x0: this.x - 22, x1: this.x + 22, y: this.y, depth: 12, z0: 0, z1: 50 };
      applyAttack(this, box, M.world.enemies, { dmg: T.robot.missileDamage, type: 'launch', dir: this.dirX, ranged: true, strike: false, robot: true, se: 'hit_mid' });
    }
  }
  draw() {
    const angs = AN.robot_missile_projectile ? [45, 35, 25, 15, 5, -5, -15, -25, -35, -45, -55, -60] : [];
    let bi = 0, bd = 1e9;
    angs.forEach((a, i) => { const d = Math.abs(a - (this.ang || 0)); if (d < bd) { bd = d; bi = i; } });
    M.drawAnim('robot_missile_projectile', bi, this.x - M.world.camX, this.y - this.z, this.dirX > 0);
  }
}
M.Bullet = Bullet; M.Missile = Missile;

// ================================================================== 小物・宝箱・拾い物
// kind: chest / barricade など1面の小物（props.json）/ state_prop（通常・破損・残骸の3絵）/ deco（壊れない飾り）
//       secret_wall（叩くと開く壁）/ hatch（2Cの点検口）/ cylinder（2Cの脱出槽）
class Prop {
  constructor(o) {
    Object.assign(this, o);
    this.hp = o.hp || 1; this.alpha = 1; this.t = 0;
    // 武器の宝箱（重み付きの抽選）: [[武器ID, 重み], ...]
    if (o.loot_weapons && !o.loot_item) { let r = Math.random() * o.loot_weapons.reduce((a, x) => a + x[1], 0); for (const [id, wgt] of o.loot_weapons) { if ((r -= wgt) <= 0) { this.loot_item = id; break; } } }
    const p = M.PROPS[o.kind];
    this.frame = p ? 'prop_' + o.kind : null;
    this.origin = o.origin || (p ? p.origin : [48, 86]);
    this.fp = o.footprint || (p ? p.footprint_proposal : [40, 10]);
    this.hits = new Set();
    if (o.kind === 'chest') this.chestType = o.chest_type || (o.loot_item ? 'good' : (M.REF.map.loot_table_mapping[o.loot_table] || 'weak'));
    this.solid = !['deco', 'chest'].includes(o.kind);
    this.persistKey = (M.world && M.world.mapId) + ':' + o.id;
  }
  get breakable() { return !['deco', 'cylinder'].includes(this.kind) && !(this.kind === 'secret_wall' && false); }
  canBeHit() { return !this.broken && this.breakable && this.kind !== 'deco'; }
  hurtbox() {
    const h = this.kind === 'chest' ? 28 : this.kind === 'hatch' ? 70 : this.kind === 'secret_wall' ? 60 : 34;   // 銃弾（ミカの胸の高さ）でも壊せる高さ
    const yy = this.hitY != null ? this.hitY : this.y;
    return { x0: this.x - this.fp[0] / 2, x1: this.x + this.fp[0] / 2, y: yy, z0: 0, z1: h };
  }
  takeHit(att, info) {
    if (this.broken) return false;
    this.hp -= 1;
    if (this.hp > 0) return true;
    this.broken = true; this.t = 0;
    att.freeze = Math.max(att.freeze || 0, 60);
    spark(this.x, this.y, 16, false);
    M.Audio.play(info.se || 'hit');
    M.world.onPropBroken(this);
    return true;
  }
  update(dt) {
    this.t += dt;
    if (this.broken && (this.frame || this.kind === 'barricade') && this.kind !== 'chest') { const k = Math.floor(this.t / 70); this.alpha = k % 2 ? 0 : 1; if (k >= 6) this.remove = true; }
    if (this.kind === 'chest' && this.broken) this.openI = Math.min(2, Math.floor(this.t / 100));
  }
  draw() {
    const sx = this.x - M.world.camX;
    if (sx < -100 || sx > M.W + 100 || this.hidden) return;
    if (this.kind === 'chest') {
      M.drawAnim('chest_' + this.chestType, this.broken ? this.openI : 0, sx, this.y, true, this.chestFade);
    } else if (this.kind === 'state_prop') {
      // 破損は短い演出だけ（追加ヒット不要）→ 残骸を残す
      const st = !this.broken ? 'intact' : this.t < 140 ? 'damaged' : 'rubble';
      M.drawFrame(this.art + '_' + st, sx, this.y, this.origin, !!this.mirror);
    } else if (this.kind === 'deco') {
      M.drawFrame(this.art, sx, this.y, this.origin, false);
    } else if (this.kind === 'hatch') {
      M.drawFrame(this.broken ? 'lab_hatch_01' : 'lab_hatch_00', sx, this.y, this.origin, false);
    } else if (this.kind === 'cylinder') {
      M.drawFrame('lab_cylinder_0' + this.frameIdx(), sx, this.y, this.origin, false);
    } else if (this.kind === 'secret_wall') {
      // 部屋の奥壁に描き込まれた壁パネル（壊すと部屋の背景が開いた版に切り替わる）
    } else if (this.alpha > 0 && this.frame) {
      M.drawFrame(this.frame, sx, this.y, this.origin, false);
    }
  }
  frameIdx() { return { intact: 0, warning: 1, breaking: 2, spent: 3 }[this.cstate || 'intact']; }
}
M.Prop = Prop;

class Item {
  constructor(o) { Object.assign(this, o); this.t = 0; this.z = 12; this.vz = 80; }
  update(dt) {
    this.t += dt;
    if (this.z > 0 || this.vz > 0) { this.vz -= 500 * dt / 1000; this.z = Math.max(0, this.z + this.vz * dt / 1000); this.x += (this.vx || 0) * dt / 1000; if (this.z === 0) this.vz = 0; }
    this.y = M.clamp(this.y, M.world.walkY[0], M.world.walkY[1]);
    if (this.x < M.world.camX - 40) this.remove = true;   // アイテムは時間では消えず、スクロールで消える
  }
  draw() {
    const f = M.ATLAS.frames[this.frame];
    if (!f) return;
    M.ctx.fillStyle = 'rgba(0,0,0,0.25)'; M.ctx.fillRect(Math.round(this.x - M.world.camX) - 6, Math.round(this.y) - 1, 12, 2);
    if (this.def.kind === 'weapon') return this.drawWeapon(f);
    M.drawFrame(this.frame, this.x - M.world.camX, this.y - this.z, [f[7] >> 1, f[8]], false);
  }
  // 落ちている武器（DROP_WEAPON_MARKER v002）: 見えている大きさを武器ごとの上限へ（縦横比そのまま・滑らかに拡大）、
  // 淡い光 → 白い細い輪郭 → 武器 → ゆっくりした白い明滅 → 上下に揺れる赤い▽。お金・食べ物には付けない
  drawWeapon(f) {
    const ctx = M.ctx, P = DROP_MARK.weapon_profiles[this.def.id] || { max_visible_extent_px: 36, halo_max_alpha: 0.38 }, B = DROP_MARK.weapon_icon_brightness;
    const [, , , tw, th] = f;
    const s = P.max_visible_extent_px / Math.max(tw, th);
    const k = 0.5 - 0.5 * Math.cos((this.t % B.pulse_period_ms) / B.pulse_period_ms * Math.PI * 2);
    const sx = Math.round(this.x - M.world.camX), foot = Math.round(this.y - this.z);
    const dw = tw * s, dh = th * s, x0 = sx - dw / 2, y0 = foot - dh;
    const sil = silhouette(this.frame);
    ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    const halo = Math.min(P.halo_max_alpha, B.halo_alpha_min + (B.halo_alpha_max - B.halo_alpha_min) * k);
    ctx.globalAlpha = halo * 0.5;
    for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2], [-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]]) ctx.drawImage(sil, x0 + dx, y0 + dy, dw, dh);
    ctx.globalAlpha = 0.9;
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) ctx.drawImage(sil, x0 + dx, y0 + dy, dw, dh);
    ctx.globalAlpha = 1;
    M.drawFrameX(this.frame, x0, y0, { ax: f[5], ay: f[6], scale: s, smooth: true });
    ctx.globalAlpha = B.white_tint_alpha_min + (B.white_tint_alpha_max - B.white_tint_alpha_min) * k;
    ctx.drawImage(sil, x0, y0, dw, dh);
    ctx.restore();
    const A = DROP_MARK.arrow_motion, bob = Math.round(-A.height_px * (0.5 - 0.5 * Math.cos((this.t % A.period_ms) / A.period_ms * Math.PI * 2)));
    M.drawFrame('drop_weapon_arrow', sx, Math.round(y0) - A.bottom_gap_px + bob, [8, 16], false);
  }
}
// 武器の▽・光の初期値（MIKA_DROP_WEAPON_MARKER_v002/marker.json）
const DROP_MARK = {
  weapon_profiles: { katana: { max_visible_extent_px: 36, halo_max_alpha: 0.42 }, war_axe: { max_visible_extent_px: 39, halo_max_alpha: 0.34 }, machinegun: { max_visible_extent_px: 38, halo_max_alpha: 0.36 },
    rocket_launcher: { max_visible_extent_px: 40, halo_max_alpha: 0.34 }, yoichi_bow: { max_visible_extent_px: 36, halo_max_alpha: 0.44 }, flamethrower: { max_visible_extent_px: 38, halo_max_alpha: 0.36 },
    gungnir: { max_visible_extent_px: 38, halo_max_alpha: 0.46 }, battle_hammer: { max_visible_extent_px: 40, halo_max_alpha: 0.34 }, rocket_punch: { max_visible_extent_px: 38, halo_max_alpha: 0.36 },
    wave_cannon: { max_visible_extent_px: 40, halo_max_alpha: 0.34 } },
  weapon_icon_brightness: { white_tint_alpha_min: 0.06, white_tint_alpha_max: 0.21, halo_alpha_min: 0.25, halo_alpha_max: 0.41, pulse_period_ms: 840 },
  arrow_motion: { height_px: 3, period_ms: 840, bottom_gap_px: 5 },
};
T.dropMarker = DROP_MARK;
// コマの白いシルエット（輪郭・光・明滅用）。一度作って使い回す
const SIL = {};
function silhouette(name) {
  if (SIL[name]) return SIL[name];
  const f = M.ATLAS.frames[name], c = document.createElement('canvas');
  c.width = f[3]; c.height = f[4];
  const g = c.getContext('2d');
  g.drawImage(M.atlasPage(f[0]), f[1], f[2], f[3], f[4], 0, 0, f[3], f[4]);
  g.globalCompositeOperation = 'source-in'; g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
  return (SIL[name] = c);
}
M.Item = Item;
})();
