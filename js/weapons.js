// weapons.js — 武器のデータと、弾・矢・ロケット・炎・拳・波動などの飛び道具（ミカと敵で共通）
'use strict';
(function () {
const M = window.MIKA, T = M.TUNING;
const { clamp, sign } = M;

// ---------------------------------------------------------------- 武器の数値
// 威力・回数は「敵一覧（MIKA_MONSTER_LIST 2026-10-07）の既に決まった武器値」→ 無いものは weapon_balance.json の順で採用
const WB = M.REF.weapons.weapons;
const WEAPONS = {
  katana:          { name: '刀', dmg: 2, uses: 50, kind: 'melee', icon: 'item_katana', reach: [4, 54], band: [8, 50], depth: 9, type: 'light', hitSE: 'weapon_hit' },
  machinegun:      { name: 'マシンガン', dmg: 1, uses: 60, kind: 'gun',   // 2026-10-11 残りは弾数（1発ごとに減る）。60発≒今までの5秒分
                    icon: 'item_machinegun', type: 'light' },
  rocket_launcher: { name: 'ロケットランチャー', dmg: 10, uses: 5, kind: 'rocket', icon: 'item_rocket_launcher', type: 'launch' },
  war_axe:         { name: '戦塵の斧', dmg: 8, waveDmg: 5, uses: 10, kind: 'axe', icon: 'item_war_axe', reach: [6, 50], band: [0, 56], depth: 10, type: 'launch', hitSE: 'weapon_hit' },
  flamethrower:    { name: '火炎放射器', dmg: 1, tickMs: 100, seconds: 10, kind: 'flame', icon: 'item_flamethrower', type: 'light' },
  yoichi_bow:      { name: 'よいちの弓', dmg: WB.yoichi_bow.damage, uses: WB.yoichi_bow.uses, kind: 'bow', icon: 'item_yoichi_bow', type: 'light' },
  gungnir:         { name: 'グングニルの槍', dmg: WB.gungnir.damage, uses: WB.gungnir.uses, kind: 'melee', icon: 'item_gungnir', reach: [6, 92], band: [14, 44], depth: 8, type: 'light', pierce: true, hitSE: 'weapon_hit' },
  battle_hammer:   { name: 'バトルハンマー', dmg: WB.battle_hammer.damage, uses: WB.battle_hammer.uses, kind: 'hammer', icon: 'item_battle_hammer', reach: [10, 64], band: [0, 50], depth: 12, type: 'launch', hitSE: 'weapon_hit' },
  rocket_punch:    { name: 'ロケットパンチ', dmg: WB.rocket_punch.damage, uses: WB.rocket_punch.uses, kind: 'fist', icon: 'item_rocket_punch', type: 'launch' },
  wave_cannon:     { name: '波動砲', dmg: 20, uses: 1, kind: 'beam', icon: 'item_wave_cannon', type: 'launch' },
};
// 敵が使う時の威力・回数（weapon_balance.json の enemy_damage / enemy_uses）
const ENEMY_WEAPON = {};
for (const k in WEAPONS) {
  const b = WB[k] || {};
  const num = (v, d) => (typeof v === 'number' ? v : d);
  ENEMY_WEAPON[k] = { dmg: num(b.enemy_damage, 5), uses: num(b.enemy_uses, 5) };
}
ENEMY_WEAPON.flamethrower = { dmg: 1, tickMs: 100, seconds: 5, uses: 99 };
// 2026-10-12 v119 ユーザー指定: 後半弱い武器の威力を上げる（ミカの武器だけ。敵の武器は変えない）
//   火炎放射器は常に +3、刀とマシンガンは 4面から +1（tuning weaponBonus）
M.weaponDmg = function (id) {
  const W = M.WEAPONS[id]; if (!W) return 1;
  const B = (M.TUNING.weaponBonus || {})[id], st = (M.world && M.world.stage) || 1;
  return W.dmg + (B ? (B.always || 0) + (B.fromStage && st >= B.fromStage ? B.add : 0) : 0);
};
M.WEAPONS = WEAPONS; M.ENEMY_WEAPON = ENEMY_WEAPON;

// ---------------------------------------------------------------- 当たり先
function targetsFor(team) {
  const w = M.world;
  if (team === 'enemy') return [w.mika, w.robot].filter(Boolean);
  return w.hittables();
}
M.targetsFor = targetsFor;

// ---------------------------------------------------------------- 飛び道具
// kind: bullet / arrow / rocket / fist / qfire / groundwave
class Shot {
  constructor(o) {
    Object.assign(this, { t: 0, z: 30, vx: 0, vy: 0, w: 4, h: 6, depth: 6, dmg: 1, type: 'light', pierce: false, range: 420 }, o);
    this.hits = new Set(); this.x0 = this.x; this.dir = sign(this.vx) || 1;
    if (this.anim) this.an = new M.Anim(this.anim, { loop: true });
  }
  get w_() { return M.world; }
  update(dt) {
    const s = dt / 1000, w = M.world;
    this.t += dt; if (this.an) this.an.update(dt);
    if (this.kind === 'fist') return this.updateFist(dt, s);
    this.x += this.vx * s; this.y += this.vy * s;
    if (this.vz) this.z += this.vz * s;
    if (this.zTo != null) this.z = M.approach(this.z, this.zTo, (this.zRate || 200) * s);
    const box = { x0: this.x - this.w, x1: this.x + this.w, y: this.y, depth: this.depth, z0: this.z - this.h, z1: this.z + this.h };
    const n = M.applyAttack(this, box, targetsFor(this.team), { dmg: this.dmg, type: this.type, dir: this.dir, ranged: true, strike: false, low: this.low, weapon: this.weapon, robot: this.robotShot });
    if (n && this.kind === 'rocket') return this.explode();
    if (n && !this.pierce) { this.remove = true; return; }
    const off = this.x < w.camX - 40 || this.x > w.camX + M.W + 40 || Math.abs(this.x - this.x0) > this.range;
    if (off || (this.life && this.t > this.life)) { if (this.kind === 'rocket') this.explode(); else this.remove = true; }
  }
  explode() {
    if (this.remove) return;
    this.remove = true;
    const w = M.world;
    for (const [dx, dy, delay] of [[-24, 2, 90], [0, 0, 0], [24, -2, 140]]) {
      w.effects.push(new M.Effect({ x: this.x + dx, y: this.y + dy + 0.5, z: 0, anim: new M.Anim('rocket_explosion'), life: 500, delay }));
    }
    M.Audio.play('bazooka_blast'); w.shake = 2;   // 2026-10-12 v112 バズーカ（ロケットランチャー）の弾の爆発音
    const box = { x0: this.x - 40, x1: this.x + 40, y: this.y, depth: 16, z0: 0, z1: 70 };
    const att = { hits: new Set(), x: this.x - this.dir, freeze: 0, src: this.src };   // v119 敵のバズーカの爆風も雑魚の攻撃として数える
    M.applyAttack(att, box, targetsFor(this.team), { dmg: this.dmg, type: 'launch', dir: this.dir, ranged: true, strike: false, weapon: this.weapon });
  }
  // ロケットパンチ: 往きと帰りの両方に当たる。帰ってきたら持ち主へ知らせる
  updateFist(dt, s) {
    const o = this.owner, sp = 260;
    if (!this.back) {
      this.x += this.dir * sp * s;
      if (Math.abs(this.x - this.x0) > 150) { this.back = true; this.hits = new Set(); }
    } else {
      const tx = o.x + o.face * 26, d = tx - this.x;
      this.x += clamp(d, -sp * 1.2 * s, sp * 1.2 * s); this.y += clamp(o.y - this.y, -80 * s, 80 * s);
      this.dir = sign(d) || this.dir;
      if (Math.abs(d) < 8 || o.dead || o.remove) { this.remove = true; o.fistBack = true; return; }
    }
    const box = { x0: this.x - 10, x1: this.x + 10, y: this.y, depth: 9, z0: this.z - 8, z1: this.z + 8 };
    M.applyAttack(this, box, targetsFor(this.team), { dmg: this.dmg, type: 'launch', dir: this.dir, ranged: true, strike: false, weapon: 'rocket_punch' });
  }
  draw() {
    const sx = this.x - M.world.camX, sy = this.y - this.z;
    if (this.kind === 'arrow' && M.ATLAS.frames.wfx_bow_tail) M.drawFrameX('wfx_bow_tail', sx - this.dir * 18, sy, { flip: this.dir < 0 });   // 矢の後ろの短い光跡（矢に追従）
    M.ctx.fillStyle = 'rgba(0,0,0,0.22)'; M.ctx.fillRect(Math.round(sx) - 3, Math.round(this.y) - 1, 6, 2);
    if (this.an) M.drawAnim(this.an.name, this.an.i, sx, sy, this.dir > 0);
    else if (this.frame) M.drawFrame(this.frame, sx, sy, this.origin || [16, 8], this.dir < 0);
  }
}
M.Shot = Shot;

// 炎の帯: 持ち主の銃口に付いて、0.1秒ごとに範囲内の相手へ1ダメージ（ダメージは持ち主ごとに1本だけ）
class FlameStream {
  constructor(owner, team, muzzle, dmg, len) {
    this.owner = owner; this.team = team; this.muzzle = muzzle; this.dmg = dmg; this.len = len || 74;
    this.t = 0; this.tick = 0; this.an = new M.Anim('flamethrower_flame', { loop: true }); this.on = true;
    this.y = owner.y + 0.4;
  }
  update(dt) {
    const o = this.owner;
    if (!this.on || o.dead || o.remove) { this.remove = true; M.Audio.stopLoop(this.snd); this.snd = null; return; }
    // 放射中の音（ループ）。敵の火炎は少し小さく
    if (!this.snd) this.snd = M.Audio.play('flame_loop', { loop: true, gain: this.team === 'player' ? 1 : 0.6 });
    M.Audio.touchLoop(this.snd);
    if (o.freeze > 0) return;
    this.t += dt; this.an.update(dt); this.y = o.y + 0.4;
    this.tick -= dt;
    if (this.tick <= 0) {
      this.tick = 100;
      const mx = o.x + o.face * this.muzzle[0], mz = o.z + this.muzzle[1];
      const box = { x0: o.face > 0 ? mx : mx - this.len, x1: o.face > 0 ? mx + this.len : mx, y: o.y, depth: 12, z0: mz - 14, z1: mz + 12 };
      const att = { hits: new Set(), x: o.x, freeze: 0 };
      M.applyAttack(att, box, targetsFor(this.team), { dmg: this.dmg, type: 'light', dir: o.face, ranged: true, strike: false, flame: true, weapon: 'flamethrower' });
    }
  }
  draw() {
    const o = this.owner;
    M.drawAnim('flamethrower_flame', this.an.i, o.x - M.world.camX + o.face * this.muzzle[0], o.y - o.z - this.muzzle[1], o.face > 0);
  }
}
M.FlameStream = FlameStream;

// 波動砲: 前方の同じ軸を一掃（一度だけ当てる）。絵は wave_cannon_fx（原点[0,32]）
class Beam {
  constructor(owner, team, muzzle, dmg) {
    this.owner = owner; this.team = team; this.dmg = dmg; this.t = 0; this.hit = false;
    this.face = owner.face; this.x = owner.x + owner.face * muzzle[0]; this.y = owner.y + 0.5; this.z = owner.z + muzzle[1];
    this.an = new M.Anim('wave_cannon_fx', { durs: [80, 90, 260, 200] });
  }
  update(dt) {
    this.t += dt; this.an.update(dt);
    if (!this.hit && this.an.i >= 1) {
      this.hit = true; M.world.shake = 3; M.Audio.play('explosion');
      const x0 = this.face > 0 ? this.x : this.x - 330, x1 = this.face > 0 ? this.x + 330 : this.x;
      const att = { hits: new Set(), x: this.owner.x, freeze: 0 };
      M.applyAttack(att, { x0, x1, y: this.y, depth: 26, z0: 0, z1: 80 }, targetsFor(this.team), { dmg: this.dmg, type: 'launch', dir: this.face, ranged: true, strike: false, weapon: 'wave_cannon' });
    }
    if (this.an.done) this.remove = true;
  }
  draw() { M.drawAnim('wave_cannon_fx', this.an.i, this.x - M.world.camX, this.y - this.z, this.face > 0); }
}
M.Beam = Beam;

// 斧の地割れ: 前方へ地面を走る（下段）。威力は waveDmg
class GroundWave {
  constructor(owner, team, x, y, dir, dmg, turn) {
    this.owner = owner; this.team = team; this.x = x; this.y = y + 0.3; this.z = 0; this.dir = dir; this.dmg = dmg; this.turn = turn || null;
    this.t = 0; this.hits = new Set(); this.an = new M.Anim('axe_groundwave', { durs: [60, 80, 80, 120] }); this.dist = 0;
  }
  update(dt) {
    const s = dt / 1000; this.t += dt; this.an.update(dt);
    if (this.an.done) { this.an.i = 1; this.an.done = false; this.an.t = 0; }
    this.x += this.dir * 200 * s; this.dist += 200 * s;
    const n = M.applyAttack(this, { x0: this.x - 14, x1: this.x + 14, y: this.y, depth: 10, z0: 0, z1: 20 }, targetsFor(this.team), { dmg: this.dmg, type: 'launch', dir: this.dir, ranged: true, strike: false, low: true, weapon: 'war_axe' });
    // 2026-10-11 ユーザー指定: 衝撃波は通り道の全員に当たってよい。当たったらその攻撃ターンの使用回数を1減らす（空振りは減らない）
    if (n && this.turn && this.owner.turnHit) this.owner.turnHit(this.turn);
    if (this.dist > 130) this.remove = true;
  }
  draw() { M.drawAnim('axe_groundwave', this.an.i, this.x - M.world.camX, this.y, this.dir > 0); }
}
M.GroundWave = GroundWave;

// 銃口の位置（素材の向きと原点から、足元からの [前方px, 高さpx] を返す）
M.muzzleOf = function (anim, idx, key) {
  const a = M.ANIMS[anim]; if (!a) return [20, 30];
  const pts = a[key || 'muzzle_points'];
  const p = Array.isArray(pts && pts[0]) ? pts[Math.min(idx, pts.length - 1)] : pts || a.projectile_spawn || a.socket_point || a.launch_point;
  if (!p) return [20, 30];
  const o = (a.origins && a.origins[idx]) || a.origin;
  const fwd = a.left ? o[0] - p[0] : p[0] - o[0];
  return [fwd, o[1] - p[1]];
};
})();
