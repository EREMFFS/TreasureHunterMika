// mika.js — ミカ（素手の技・掴み・投げ・武器）
'use strict';
(function () {
const M = window.MIKA, T = M.TUNING, I = M.Input;
const AN = M.ANIMS;
const { clamp, sign, approach } = M;
const MV = T.moves, MK = T.mika;
const COMBO = ['punch', 'kick_right', 'kick_left', 'strong_punch', 'elbow', 'uppercut'];
const LIFT = { uppercut: [0, 12, 22, 26, 14, 0], somersault: [0, 22, 44, 30, 8, 0] };   // 2026-10-08 ムーンサルトを高く（約2倍） // animation.json preview_height_px
// 打撃音: 弱（パンチ・左右キック・膝）／中（強パンチ・肘・回転蹴り・足払い・ジャンプ蹴り・タックル・スライディング）／強（アッパー）
const HIT_SE = { punch: 'hit', kick_right: 'hit', kick_left: 'hit', grab_knee: 'hit', strong_punch: 'hit_mid', elbow: 'hit_mid', somersault: 'hit_mid',
  sweep: 'hit_mid', jump_kick: 'hit_mid', tackle: 'hit_mid', slide: 'hit_mid', uppercut: 'hit_heavy', grab_upper: 'hit_heavy' };

function spawnAttackFx(owner, move) {
  if (move === 'somersault') M.world.effects.push(new M.AttachedFx(owner, 'fx_somersault', [0, 0]));
  else if (move === 'jump_kick') M.world.effects.push(new M.AttachedFx(owner, 'fx_jump_kick', T.fxTips.jump_kick));
  else if (T.fxTips[move]) M.world.effects.push(new M.AttachedFx(owner, 'fx_melee', T.fxTips[move]));
}

// 武器ごとのミカのアニメ（地上・空中）と攻撃コマ
const WANIM = {
  katana:          { ground: ['katana_vertical', 'katana_horizontal'], air: 'katana_jump', active: 1, speed: 2.6 },   // 2026-10-08 刀を2倍速く
  machinegun:      { ground: 'machinegun_fire', ready: 'machinegun_ready', air: 'machinegun_jump_fire' },
  rocket_launcher: { ground: 'rocket_launcher', groundFrames: [0, 1], airFrames: [2, 3], fire: 1, airFire: 3 },
  war_axe:         { ground: 'war_axe', air: 'war_axe_jump', active: 3, airActive: 3, wave: 3, airWave: 4 },
  flamethrower:    { ground: 'flamethrower', groundFrames: [0, 1], airFrames: [2, 3], fire: 1, airFire: 3 },
  yoichi_bow:      { ground: 'yoichi_bow', air: 'yoichi_bow_jump', fire: 3, airFire: 2 },
  gungnir:         { ground: 'gungnir', air: 'gungnir_jump', active: 2, airActive: 2 },
  battle_hammer:   { ground: 'battle_hammer', air: 'battle_hammer_jump', active: 2, airActive: 2 },
  rocket_punch:    { ground: 'mika_rocket_punch', air: 'mika_rocket_punch_jump', fire: 2, airFire: 1, hold: 2 },
  wave_cannon:     { ground: 'mika_wave_cannon', air: 'mika_wave_cannon_jump', fire: 2, airFire: 1, charge: 1 },
};
M.WANIM = WANIM;

class Mika extends M.Actor {
  constructor(x, y) {
    super(x, y);
    this.team = 'player';
    this.maxHp = MK.maxHp; this.hp = this.maxHp;
    this.bodyW = 20; this.bodyH = 46; this.shadowW = 20;
    this.combo = 0; this.comboHit = false; this.comboTimer = 0;
    this.bufferA = 0; this.aHeld = 0; this.usedAirAttack = false;
    this.grabbed = null; this.grabWalk = 0; this.grabIdle = 0; this.knees = 0;
    this.hits = new Set();
    this.weapon = null;           // { id, uses, ms }  武器は1枠。拾うと置き換え
    this.setState('entrance', 'walk');
  }
  get controllable() { return !M.world.lockInput; }
  canBeHit() { return this.invuln <= 0 && !['knock', 'down', 'getup', 'defeated', 'rescued', 'entrance', 'clear', 'walkout', 'auto'].includes(this.state); }
  // 低い姿勢（スライディング・足払い）では当たり判定が低くなる＝クイーンの炎などを下でかわせる
  hurtbox() {
    let h = this.bodyH;
    if (this.state === 'attack' && (this.move === 'slide' || this.move === 'sweep')) h = 20;
    return { x0: this.x - this.bodyW / 2, x1: this.x + this.bodyW / 2, y: this.y, z0: this.z, z1: this.z + h };
  }

  takeHit(att, info) {
    // 2026-10-12 v119 雑魚（ボス・中ボス以外の敵。弾・ビーム・炎も撃った敵で判定）の攻撃は面ごとに上乗せ
    const src = att && (att.src || att.owner || att);
    if (src && M.Enemy && src instanceof M.Enemy && !src.boss && M.world) {
      const add = (T.zakoDmgBonusByStage || {})[M.world.stage] || 0;
      if (add) info = Object.assign({}, info, { dmg: info.dmg + add });
    }
    if (src && src.dmgMul) info = Object.assign({}, info, { dmg: info.dmg * src.dmgMul });   // 2026-10-12 v131 6Fのダークミカは攻撃力半分
    if (this.grabbed) this.releaseGrab(false);
    this.endWeaponHold();
    const hp0 = this.hp;
    this.hp = Math.max(M.debug && M.debug.god ? 1 : 0, this.hp - info.dmg);
    // 声: HPが20%を切った時（戻るまで一度）／殴られた（倒れた時の声は倒れきってから）
    if (this.hp > 0 && this.hp < this.maxHp * 0.2 && hp0 >= this.maxHp * 0.2) M.Audio.voice('hp20');
    else if (this.hp > 0) M.Audio.voice('yarare');
    if (!info.flame || ((this.flameSE = (this.flameSE || 0) + 1) % 4 === 1)) M.Audio.play(info.se === 'fg_attack_hit' ? info.se : 'hurt');   // 2026-10-12 v103 長老の杖は専用の音
    M.spark(this.x + (att.x > this.x ? 6 : -6), this.y, this.z + 30);
    this.face = att.x > this.x ? 1 : -1;
    if (!info.flame) att.freeze = this.freeze = T.hitstop.normalMs * 0.7;
    // 吹っ飛ぶのは: 吹っ飛ばし技（突進・ハンマー・斧・爆発・雷など）／短い間に続けて殴られた時（コンボ）／空中／HP0
    const now = M.world.fxTime;
    this.hitLog = (this.hitLog || []).filter((t) => now - t < MK.comboKnockMs); this.hitLog.push(now);
    if (this.hp <= 0 || info.type === 'launch' || this.z > 0 || this.hitLog.length >= MK.comboKnockHits) {
      this.hitLog = [];
      this.vx = -this.face * T.launch.vx * 0.8; this.vy = 0; this.vz = T.launch.vz * 0.7;
      this.setState('knock', 'knockback', { hold: true });
    } else {
      this.setState('hurt', 'damage_light');
      this.invuln = info.flame ? 120 : MK.hurtInvulnMs * 0.5;
    }
    M.world.onPlayerHit && M.world.onPlayerHit();
    return true;
  }

  enemiesAndProps() { return M.world.hittables(); }

  startAttack(name) {
    this.newAttack();
    this.move = name; this.wmove = null;
    this.comboHit = false;
    this.fxSpawned = false;
    this.setState('attack', name, { speed: T.actionSpeed[name] || 1 });
    this.bufferA = 0;
    M.Audio.play('swing');
  }

  update(dt) {
    if (this.invuln > 0) this.invuln -= dt;
    if (this.freeze > 0) { this.freeze -= dt; return; }
    this.st += dt;
    const ctrl = this.controllable;
    const dx = ctrl ? I.dirX() : 0, dy = ctrl ? I.dirY() : 0;
    if (ctrl && I.pressed.attack) this.bufferA = T.input.attackBufferMs;
    else if (this.bufferA > 0) this.bufferA -= dt;
    this.aHeld = ctrl && I.down.attack ? this.aHeld + dt : 0;
    if (this.comboTimer > 0) { this.comboTimer -= dt; if (this.comboTimer <= 0) this.combo = 0; }
    const s = dt / 1000;
    const walk = M.world.walkY;

    switch (this.state) {
    case 'entrance': {
      this.anim.update(dt);
      const dir = M.world.rtl ? -1 : 1;   // 右から左へ進むマップは右から登場
      this.face = dir;
      this.x += dir * MK.entranceSpeed * s;
      if (dir * (this.x - M.world.entranceTo) >= 0) { this.x = M.world.entranceTo; this.setState('idle', 'idle'); M.world.onEntranceDone(); }
      break;
    }
    case 'auto': {   // 演出で決めた場所まで歩く／走る（出口・退場）
      this.anim.update(dt);
      const g = this.autoGoal, sp = g.speed || MK.walkSpeed;
      const ddx = g.x - this.x, ddy = (g.y != null ? g.y : this.y) - this.y;
      if (Math.abs(ddx) > 1) this.face = sign(ddx);
      this.x += clamp(ddx, -sp * s, sp * s); this.y += clamp(ddy, -MK.walkSpeedY * s, MK.walkSpeedY * s);
      if (g.z != null) this.z = approach(this.z, g.z, 60 * s);
      if (Math.abs(ddx) <= 1 && Math.abs(ddy) <= 1) { const cb = g.done; this.autoGoal = null; this.setState('idle', 'idle'); this.z = 0; cb && cb(); }
      return;
    }
    case 'idle': case 'walk': {
      this.z = 0;
      if (ctrl && I.pressed.jump) { this.jump(dx * MK.airSpeed); break; }
      if (ctrl && I.dashTap) { this.face = I.dashTap === 'right' ? 1 : -1; this.setState('dash', 'dash'); M.Audio.play('dash'); break; }
      if (this.bufferA > 0) { this.chooseAttack(dx, dy); break; }
      if (!this.weapon && this.aHeld >= T.input.tauntHoldMs) { this.setState('taunt', 'taunt'); break; }
      if (dx || dy) {
        if (dx) this.face = dx;
        this.x += dx * MK.walkSpeed * s; this.y += dy * MK.walkSpeedY * s;
        if (this.state !== 'walk') this.setState('walk', 'walk');
        if (this.checkGrab(dx, dt)) break;
      } else {
        this.grabWalk = 0;
        if (this.state !== 'idle') this.setState('idle', 'idle');
      }
      this.anim.update(dt);
      break;
    }
    case 'dash': {
      this.anim.update(dt);
      const held = this.face > 0 ? I.down.right : I.down.left;
      if (!ctrl || !held) { this.setState('idle', 'idle'); break; }
      if (I.pressed.jump) { this.jump(this.face * MK.dashJumpSpeed); break; }
      if (this.bufferA > 0) {
        if (dy > 0) { this.startAttack('slide'); this.vx = this.face * MK.slideSpeed; }      // スライディングは武器を持っていても使える
        else if (this.weapon) this.startWeapon(false);
        else { this.startAttack('tackle'); this.vx = this.face * MK.tackleSpeed; }
        break;
      }
      this.x += this.face * MK.dashSpeed * s; this.y += dy * MK.walkSpeedY * s;
      if (this.checkGrab(this.face, dt * 2)) break;
      break;
    }
    case 'jump': {
      // 2026-10-11 v034 二段ジャンプ: 一度Bを離してから、頂点付近で押し直すと回転して二段目。SEと声は一段目と同じものを1回
      if (!I.down.jump) this.jumpReleased = true;
      const DJ = MK.doubleJump;
      if (ctrl && DJ && I.pressed.jump && this.jumpReleased && !this.usedDouble && !this.move && !this.wmove && this.vz <= DJ.apexUp && this.vz >= -DJ.apexDown) {
        this.usedDouble = true; this.spin = true; this.vz = DJ.vz; this.usedAirAttack = false; this.bufferA = 0;
        this.anim.set('double_jump');
        M.Audio.play('jump'); M.Audio.voice('jump');
      }
      if (this.move !== 'jump_kick' && !this.wmove) {
        const target = dx * MK.airSpeed;
        if (!(dx && sign(dx) === sign(this.vx) && Math.abs(this.vx) > MK.airSpeed))
          this.vx = approach(this.vx, target, MK.airSpeed * MK.airControl * 6 * s);
        if (dx) this.face = dx;
      }
      if (this.bufferA > 0 && !this.usedAirAttack) {
        this.usedAirAttack = true; this.bufferA = 0;
        if (this.weapon && WANIM[this.weapon.id].air !== undefined) { this.spin = false; this.startWeapon(true); }
        else {
          this.newAttack(); this.move = 'jump_kick'; this.fxSpawned = false; this.spin = false;
          this.anim.set('jump_kick', { speed: T.actionSpeed.jump_kick });
          this.kickEntryVx = this.vx;
          this.vx = this.vx / (MK.airSpeed / MK.legacyAirSpeed) * T.jumpKick.distanceScale * T.actionSpeed.jump_kick;
          M.Audio.play('swing');
        }
      }
      if (this.move === 'jump_kick') {
        this.anim.update(dt);
        if (this.anim.i === 1) {
          if (!this.fxSpawned) { this.fxSpawned = true; spawnAttackFx(this, 'jump_kick'); }
          this.hitCheck('jump_kick');
        }
        if (this.anim.done) { this.move = null; this.vx = this.kickEntryVx; this.anim.set('jump'); }
      }
      if (this.wmove) this.updateWeaponAir(dt);
      if (this.spin && !this.move && !this.wmove) { this.anim.update(dt); if (this.anim.done) { this.spin = false; this.anim.set('jump'); } }   // 回転が終われば通常の落下ポーズ
      if (!this.spin && !this.move && !this.wmove) { const v = MK.jumpPoseVz; this.anim.i = this.st < 50 ? 0 : this.vz > v ? 1 : this.vz > -v ? 2 : 3; }
      if (this.physicsAir(dt, MK.gravity)) {
        const wasW = this.wmove;
        this.move = null; this.vx = 0; this.spin = false;
        if (wasW) this.onWeaponLand();
        this.endWeaponHold();
        this.wmove = null;
        this.setState('land', 'jump'); this.anim.i = 4; M.Audio.play('land');
      }
      break;
    }
    case 'land': {
      if (this.st > 90) this.setState('idle', 'idle');
      break;
    }
    case 'attack': this.updateAttack(dt, dx, dy); break;
    case 'weapon': this.updateWeapon(dt, dx, dy); break;
    case 'taunt': {
      this.anim.update(dt);
      if (this.anim.done) { this.anim.done = false; this.anim.i = 1; this.anim.t = 0; }
      if (this.anim.i === 2) M.world.onTaunt && M.world.onTaunt(this);
      if (!I.down.attack) this.setState('idle', 'idle');
      break;
    }
    case 'grab': this.updateGrab(dt, dx, dy); break;
    case 'hurt': {
      this.anim.i = this.st < MK.lightHurtMs / 2 ? 0 : 1;
      if (this.st >= MK.lightHurtMs) this.setState('idle', 'idle');
      break;
    }
    case 'knock': {
      this.anim.i = this.vz > 40 ? 0 : this.vz > -40 ? 1 : 2;
      if (this.physicsAir(dt, MK.gravity)) {
        this.vx = 0; this.setState('down', 'knockback'); this.anim.i = 3; M.Audio.play('land');
        M.world.shake = 1;
      }
      break;
    }
    case 'down': {
      this.anim.i = 3;
      if (this.st >= MK.downedMs) {
        if (this.hp <= 0) { this.setState('defeated', 'defeated'); M.Audio.voice('death'); M.world.onMikaDefeated(); }
        else { this.setState('getup', 'getup'); M.Audio.voice('getup'); }
      }
      break;
    }
    case 'getup': {
      this.anim.update(dt);
      if (this.anim.done) { this.invuln = MK.hurtInvulnMs; this.setState('idle', 'idle'); }
      break;
    }
    case 'defeated': this.anim.update(dt); break;
    case 'rescued': {
      this.anim.update(dt);
      if (this.anim.done) { this.invuln = MK.hurtInvulnMs * 1.5; this.setState('idle', 'idle'); }
      break;
    }
    case 'clear': this.anim.update(dt); break;
    case 'walkout': {
      this.anim.update(dt); this.face = this.walkoutDirection === -1 ? -1 : 1; this.x += this.face * (this.walkoutSpeed || MK.walkSpeed) * s;   // 2026-10-11 v039 左へ出るマップでは左へ
      if (this.walkoutY != null) this.y = approach(this.y, this.walkoutY, MK.walkSpeedY * 1.5 * s);   // v040 5A: 乗り口の足元へ寄りながら出る
      break;
    }
    case 'pickup': {
      this.anim.update(dt);
      if (this.anim.i === 1 && this.pickTarget) { M.world.collect(this.pickTarget); this.pickTarget = null; }
      if (this.anim.done) this.setState('idle', 'idle');
      break;
    }
    }

    // 歩行範囲と画面端
    if (!['entrance', 'walkout', 'auto'].includes(this.state)) {
      this.y = clamp(this.y, walk[0], walk[1]);
      this.x = clamp(this.x, M.world.camX + 12, M.world.camX + M.W - 12);
    }
  }
  goTo(x, y, done, speed) { this.endWeaponHold(); this.grabbed && this.releaseGrab(false); this.autoGoal = { x, y, done, speed }; this.setState('auto', speed > MK.walkSpeed * 1.3 ? 'dash' : 'walk'); }

  jump(vx) {
    this.setState('jump', 'jump');
    this.vx = vx; this.vz = MK.jumpVelocity; this.usedAirAttack = false; this.move = null; this.wmove = null;
    this.usedDouble = false; this.jumpReleased = false; this.spin = false;   // 二段ジャンプ（着地まで1回）
    M.Audio.play('jump');
    M.Audio.voice('jump');
  }

  chooseAttack(dx, dy) {
    // 拾い物の上でAなら拾う
    const it = M.world.itemAt(this);
    if (it) { this.pickTarget = it; this.setState('pickup', 'pickup'); this.bufferA = 0; return; }
    if (this.weapon) { if (dx) this.face = dx; return this.startWeapon(false); }
    if (T.input.directionalAttack === 'hold') {
      if (dy < 0) { this.combo = 0; return this.startAttack('somersault'); }
      if (dy > 0) { this.combo = 0; return this.startAttack('sweep'); }
    }
    if (dx) this.face = dx;
    const step = this.comboTimer > 0 ? this.combo : 0;
    this.startAttack(COMBO[step]);
    this.combo = step;
  }

  hitCheck(move, zOff = 0) {
    const mv = MV[move];
    const info = { dmg: mv.dmg, type: mv.type, dir: this.face, low: !!mv.low, smash: !!mv.smash, finisher: !!mv.finisher, strike: true, move, se: HIT_SE[move] };
    const n = M.applyAttack(this, this.attackBox(mv, zOff), this.enemiesAndProps(), info);
    if (n) this.comboHit = true;
    return n;
  }

  updateAttack(dt) {
    const a = this.anim, m = this.move, spec = AN[m];
    const prev = a.i;
    a.update(dt);
    const act = spec.active_frames || (spec.active_frame !== undefined ? [spec.active_frame] : m === 'slide' ? [1] : []);
    const lift = LIFT[m] ? LIFT[m][a.i] || 0 : 0;
    this.z = lift;
    // 倍速で1フレームに当たりコマを飛び越えても、当たり判定は必ず一度出す
    const crossed = act.some((k) => k > prev && (k < a.i || (a.done && k <= a.i)));
    if (act.includes(a.i) || crossed) {
      if (!this.fxSpawned) { this.fxSpawned = true; spawnAttackFx(this, m); }
      this.hitCheck(m, 0);
    }
    const s = dt / 1000;
    if (m === 'slide') {
      // スライディング中に触れたアイテム（お金・宝・回復など。武器は除く）はそのまま拾う
      const w = M.world;
      for (const it of w.items) if (!it.remove && it.def.kind !== 'weapon' && it.z <= 4 && Math.abs(it.x - this.x) < 18 && Math.abs(it.y - this.y) < 9) w.collect(it);
    }
    if (m === 'slide' || m === 'tackle') {
      this.x += this.vx * s;
      // スライディングは前半は全速のまま滑り、後半で止まる（2026-10-08 速く・遠く）
      if (m !== 'slide' || this.st > MK.slideMs * 0.6) this.vx = approach(this.vx, 0, (m === 'slide' ? MK.slideSpeed / (MK.slideMs * 0.4 / 1000) : 300) * s);
      if (m === 'slide' && a.i === 1 && this.st < MK.slideMs) a.t = Math.min(a.t, 50);
    }
    const ci = COMBO.indexOf(m);
    const lastAct = act.length ? act[act.length - 1] : 0;
    if (ci >= 0 && ci < COMBO.length - 1 && this.comboHit && this.bufferA > 0 && a.i > lastAct) {
      this.combo = ci + 1; this.comboTimer = T.mika.comboGraceMs;
      return this.startAttack(COMBO[ci + 1]);
    }
    if (a.done) {
      this.z = 0;
      if (ci >= 0) {
        if (this.comboHit && ci < COMBO.length - 1) { this.combo = ci + 1; this.comboTimer = MK.comboGraceMs; }
        else { this.combo = 0; this.comboTimer = 0; }
      }
      this.setState('idle', 'idle');
    }
  }

  // ---------------------------------------------------------------- 武器
  pickWeapon(id) {
    const W = M.WEAPONS[id];
    this.endWeaponHold();
    this.weapon = { id, uses: W.uses || 0, ms: (W.seconds || 0) * 1000 };   // 前の武器は捨てて置き換え
    if (id === 'machinegun' && M.Tutor) M.Tutor.show('smg');   // 2026-10-11 初めて拾ったら操作説明
  }
  weaponLeft() { const w = this.weapon; if (!w) return 0; const W = M.WEAPONS[w.id]; return W.seconds ? w.ms : w.uses; }
  useWeapon(n = 1) {
    const w = this.weapon; if (!w) return;
    w.uses = Math.max(0, w.uses - n);
  }
  // 2026-10-11 ユーザー指定: 使用回数は「誰かにダメージが入った攻撃ターン」ごとに1減る（空振りは減らない）。
  // 斧は振り＋衝撃波で1ターン。どちらが何体に当たっても1回分。
  turnHit(turn) {
    if (!turn || turn.hit) return;
    turn.hit = true;
    if (this.weapon && this.weapon === turn.w) { this.useWeapon(1); if (this.state !== 'weapon') this.breakWeaponIfEmpty(); }
  }
  breakWeaponIfEmpty() {
    if (this.weapon && this.weaponLeft() <= 0) {
      M.world.effects.push(new M.Effect({ kind: 'label', text: 'BREAK', x: this.x, y: this.y, z: 50, life: 600, color: '#ff9a7a' }));
      this.weapon = null;
    }
  }
  endWeaponHold() {
    if (this.flame) { this.flame.on = false; this.flame = null; }
  }
  startWeapon(air) {
    const id = this.weapon.id, A = WANIM[id], W = M.WEAPONS[id];
    this.newAttack(); this.bufferA = 0; this.fired = {}; this.fistBack = false; this.wHit = false; this.wTurn = { hit: false, w: this.weapon };
    this.wmove = id; this.wAir = air; this.move = null;
    if (air) {
      if (A.airFrames) { this.anim.set(A.ground); this.anim.i = A.airFrames[0]; }
      else this.anim.set(A.air, { speed: A.speed || 1 });
      return;
    }
    let anim = A.ground;
    if (Array.isArray(anim)) { this.katanaAlt = !this.katanaAlt; anim = anim[this.katanaAlt ? 0 : 1]; }
    if (A.ready) anim = A.ready;
    this.setState('weapon', anim, { speed: A.speed || 1 });
    if (A.groundFrames) this.anim.i = A.groundFrames[0];
    this.wmove = id;
    if (W.kind === 'melee' || W.kind === 'axe' || W.kind === 'hammer') M.Audio.play('swing');
  }
  weaponHit(box, extra) {
    const id = this.wmove, W = M.WEAPONS[id];
    const info = Object.assign({ dmg: M.weaponDmg(id), type: W.type, dir: this.face, strike: true, weapon: id, se: 'weapon_hit' }, extra || {});
    const n = M.applyAttack(this, box, this.enemiesAndProps(), info);
    if (n && !this.wHit && W.kind !== 'gun' && W.kind !== 'flame') { this.wHit = true; if (W.kind === 'melee' || W.kind === 'axe' || W.kind === 'hammer') this.turnHit(this.wTurn); }
    return n;
  }
  meleeBox(id, air) {
    const W = M.WEAPONS[id];
    return this.attackBox({ reach: W.reach, band: air ? [W.band[0] - 10, W.band[1]] : W.band, depth: W.depth });
  }
  fireProjectile(kind, anim, idx) {
    const w = M.world, id = this.wmove, W = M.WEAPONS[id];
    const mz = M.muzzleOf(anim, idx, kind === 'bow' ? 'projectile_spawn' : kind === 'fist' ? 'socket_point' : 'muzzle_points');
    const x = this.x + this.face * mz[0], z = this.z + Math.max(8, mz[1]);
    if (kind === 'gun') {
      w.projectiles.push(new M.Shot({ team: 'player', kind: 'bullet', x, y: this.y, z, vx: this.face * 360, dmg: M.weaponDmg(id), anim: 'mg_bullet', range: 330, depth: 8, weapon: id }));
      w.effects.push(new M.Effect({ x, y: this.y + 0.3, z, anim: new M.Anim('muzzle_flash'), life: 60, flip: this.face < 0 }));
      M.Audio.play('gun');
    } else if (kind === 'rocket') {
      w.projectiles.push(new M.Shot({ team: 'player', kind: 'rocket', x, y: this.y, z, vx: this.face * 260, dmg: M.weaponDmg(id), anim: 'rocket_projectile', w: 8, h: 8, depth: 10, range: 380, weapon: id }));
      this.useWeapon(1); M.Audio.play('missile');
    } else if (kind === 'bow') {
      w.projectiles.push(new M.Shot({ team: 'player', kind: 'arrow', x, y: this.y, z, vx: this.face * 330, dmg: M.weaponDmg(id), anim: 'yoichi_arrow', w: 12, h: 6, depth: 9, pierce: true, range: 420, weapon: id }));
      this.useWeapon(1); M.Audio.play('swing');   // 2026-10-11 ユーザー指定: 弓を放つ音は刀を振る音と同じ
    } else if (kind === 'fist') {
      w.projectiles.push(new M.Shot({ team: 'player', kind: 'fist', owner: this, x, y: this.y, z, vx: this.face, dmg: M.weaponDmg(id), anim: 'rocket_punch_projectile' }));
      this.useWeapon(1); M.Audio.play('missile');
    } else if (kind === 'beam') {
      w.effects.push(new M.Beam(this, 'player', mz, M.weaponDmg(id))); this.useWeapon(1);
    }
  }
  updateWeapon(dt) {
    const id = this.wmove, A = WANIM[id], W = M.WEAPONS[id], a = this.anim, w = M.world;
    if (!this.weapon || !id) { this.setState('idle', 'idle'); return; }
    switch (W.kind) {
    case 'melee': case 'axe': case 'hammer': {
      const prev = a.i;
      a.update(dt);
      if (a.i === A.active || (prev < A.active && a.i > A.active)) {
        this.weaponHit(this.meleeBox(id), W.pierce ? { ranged: false } : null);
        if (W.kind === 'axe' && !this.fired.wave) { this.fired.wave = true; w.effects.push(new M.GroundWave(this, 'player', this.x + this.face * 40, this.y, this.face, W.waveDmg, this.wTurn)); w.shake = 1; }
        if (W.kind === 'hammer' && !this.fired.fx) {
          this.fired.fx = true; w.shake = 2;
          const ip = M.muzzleOf(a.name, a.i, 'impact_point');
          w.effects.push(new M.Effect({ x: this.x + this.face * ip[0], y: this.y + 0.4, z: 0, anim: new M.Anim('hammer_impact'), life: 400, flip: this.face < 0 }));
          const att = { hits: this.hits, x: this.x, freeze: 0 };
          M.applyAttack(att, { x0: this.x + this.face * ip[0] - 30, x1: this.x + this.face * ip[0] + 30, y: this.y, depth: 14, z0: 0, z1: 24 }, this.enemiesAndProps(), { dmg: M.weaponDmg(id), type: 'launch', dir: this.face, strike: true, weapon: id, se: 'weapon_hit' });
        }
      }
      // 刀: 攻撃判定が終わったら次の一振りへすぐつなげる（コンボ無限）
      if (id === 'katana' && this.bufferA > 0 && a.i > A.active && !M.world.itemAt(this)) { this.breakWeaponIfEmpty(); if (this.weapon) return this.startWeapon(false); }
      if (a.done) { this.setState('idle', 'idle'); this.breakWeaponIfEmpty(); }
      break;
    }
    case 'gun': {
      // Aを押している間だけ撃ち続ける。1発撃つごとに弾数が1減る（2026-10-11）
      if (a.name === A.ready) { a.update(dt); if (this.st > 70) this.anim.set(A.ground, { loop: true }); break; }
      a.update(dt);
      if (!I.down.attack || this.weapon.uses <= 0 || !this.controllable) { this.setState('idle', 'idle'); this.breakWeaponIfEmpty(); break; }
      this.shotT = (this.shotT || 0) - dt;
      if (this.shotT <= 0) { this.shotT = 80; this.fireProjectile('gun', a.name, a.i); this.useWeapon(1); }
      break;
    }
    case 'flame': {
      a.i = this.st < 100 ? A.groundFrames[0] : A.groundFrames[1];
      if (a.i === A.fire && !this.flame) { this.flame = new M.FlameStream(this, 'player', M.muzzleOf(a.name, a.i), M.weaponDmg(id), 78); w.effects.push(this.flame); }
      if (this.flame) this.weapon.ms -= dt;
      if ((!I.down.attack && this.st > 250) || this.weapon.ms <= 0 || !this.controllable) { this.endWeaponHold(); this.setState('idle', 'idle'); this.breakWeaponIfEmpty(); }
      break;
    }
    case 'rocket': {
      a.t += dt; a.i = a.t < 120 ? A.groundFrames[0] : A.groundFrames[1];
      if (a.i === A.fire && !this.fired.r) { this.fired.r = true; this.fireProjectile('rocket', a.name, a.i); }
      if (a.t > 420) { this.setState('idle', 'idle'); this.breakWeaponIfEmpty(); }
      break;
    }
    case 'bow': case 'beam': {
      if (W.kind === 'beam' && a.i === A.charge && a.t > 80 && this.st < 520) a.t = 80;   // 溜め
      else a.update(dt);
      if (a.i === A.fire && !this.fired.f) { this.fired.f = true; this.fireProjectile(W.kind, a.name, a.i); }
      if (a.done) { this.setState('idle', 'idle'); this.breakWeaponIfEmpty(); }
      break;
    }
    case 'fist': {
      if (a.i === A.hold && this.fired.f && !this.fistBack) a.t = 0; else a.update(dt);
      if (a.i === A.fire && !this.fired.f) { this.fired.f = true; this.fireProjectile('fist', a.name, a.i); }
      if (a.done) { this.setState('idle', 'idle'); this.breakWeaponIfEmpty(); }
      break;
    }
    }
  }
  // 空中の武器攻撃（ジャンプの物理はそのまま）
  updateWeaponAir(dt) {
    const id = this.wmove, A = WANIM[id], W = M.WEAPONS[id], a = this.anim;
    if (!this.weapon) { this.wmove = null; return; }
    switch (W.kind) {
    case 'melee': case 'axe': case 'hammer': {
      if (a.i < (A.airActive || A.active) + 1 || this.z < 6) a.update(dt);
      const act = A.airActive !== undefined ? A.airActive : A.active;
      if (a.i === act) this.weaponHit(this.meleeBox(id, true));
      if (a.i > act + 1 && this.z > 0) a.i = act + 1;   // 着地まで振り抜いた姿勢
      break;
    }
    case 'gun':
      a.update(dt); if (a.done) { a.done = false; a.i = 0; }
      if (I.down.attack && this.weapon.uses > 0) {
        this.shotT = (this.shotT || 0) - dt;
        if (this.shotT <= 0) { this.shotT = 90; this.fireProjectile('gun', a.name, a.i); this.useWeapon(1); }
      }
      break;
    case 'flame': case 'rocket': {
      a.t += dt; a.i = a.t < 110 ? A.airFrames[0] : A.airFrames[1];
      if (W.kind === 'rocket' && a.i === A.airFire && !this.fired.r) { this.fired.r = true; this.fireProjectile('rocket', a.name, a.i); }
      if (W.kind === 'flame') {
        if (a.i === A.airFire && !this.flame && I.down.attack) { this.flame = new M.FlameStream(this, 'player', M.muzzleOf(a.name, a.i), M.weaponDmg(id), 70); M.world.effects.push(this.flame); }
        if (this.flame) this.weapon.ms -= dt;
        if ((!I.down.attack || this.weapon.ms <= 0) && this.flame) this.endWeaponHold();
      }
      break;
    }
    case 'bow': case 'beam': case 'fist': {
      if (a.i < A.airFire + 1 || this.z < 6) a.update(dt);
      if (a.i === A.airFire && !this.fired.f) { this.fired.f = true; this.fireProjectile(W.kind, a.name, a.i); }
      break;
    }
    }
  }
  onWeaponLand() {
    const id = this.wmove, A = WANIM[id], W = M.WEAPONS[id];
    if (W && W.kind === 'axe' && !this.fired.wave2) { this.fired.wave2 = true; M.world.effects.push(new M.GroundWave(this, 'player', this.x + this.face * 30, this.y, this.face, W.waveDmg, this.wTurn)); }
    if (W && W.kind === 'hammer') M.world.shake = 2;
    this.breakWeaponIfEmpty();
  }

  // ---------------------------------------------------------------- 掴み
  checkGrab(dx, dt) {
    for (const e of M.world.enemies) {
      if (!e.grabbable || !e.grabbable()) continue;
      const ddx = e.x - this.x, reach = MK.grabRange + Math.max(0, e.bodyW / 2 - 11);
      if (sign(ddx) !== dx || Math.abs(ddx) > reach || Math.abs(e.y - this.y) > MK.grabDepth) continue;
      this.grabWalk += dt;
      if (this.grabWalk >= MK.grabWalkMs) { this.startGrab(e); return true; }
      return false;
    }
    this.grabWalk = 0;
    return false;
  }
  startGrab(e) {
    this.grabbed = e; this.grabWalk = 0; this.knees = 0; this.grabIdle = 0;
    this.face = sign(e.x - this.x) || this.face;
    e.onGrabbed(this);
    this.grabPhase = 'hold';
    this.setState('grab', 'grab', { hold: true });
    M.Audio.play('grab');
  }
  releaseGrab(anim = true) {
    const e = this.grabbed;
    this.grabbed = null;
    if (e && e.state === 'grabbed') e.onReleased();
    if (anim) this.setState('grab', 'grab_release'), (this.grabPhase = 'release');
  }
  placeGrabbed() {
    const e = this.grabbed;
    if (!e) return;
    e.x = this.x + this.face * (6 + Math.max(11, e.bodyW / 2)); e.y = this.y + 0.2; e.z = 0; e.face = -this.face;
  }
  updateGrab(dt, dx) {
    const a = this.anim;
    a.update(dt);
    const e = this.grabbed;
    switch (this.grabPhase) {
    case 'hold':
      if (!e || e.dead || e.state !== 'grabbed') { this.grabbed = null; this.setState('idle', 'idle'); return; }
      this.placeGrabbed();
      this.grabIdle += dt;
      if (this.bufferA > 0) {
        this.bufferA = 0; this.grabIdle = 0;
        if (dx && this.knees < 3) { this.grabPhase = 'throw'; this.throwDir = -this.face; a.set('throw'); M.Audio.play('throw'); return; }
        this.newAttack();
        if (this.knees < 3) { this.grabPhase = 'knee'; a.set('grab_knee'); this.knees++; }
        else { this.grabPhase = 'upper'; a.set('uppercut'); }
        M.Audio.play('swing');
        return;
      }
      if (this.grabIdle >= MK.grabReleaseMs) this.releaseGrab(true);
      break;
    case 'knee':
      this.placeGrabbed();
      if (a.i === 1 && e && !this.hits.has(e)) {
        this.hits.add(e);
        e.takeHit(this, { dmg: MV.grab_knee.dmg, type: 'grab', dir: this.face, strike: true, move: 'grab_knee', se: 'hit' });
        if (e.hp <= 0) { this.grabbed = null; }
      }
      if (a.done) {
        if (!this.grabbed) { this.setState('idle', 'idle'); return; }
        this.grabPhase = 'hold'; a.set('grab', { hold: true }); a.i = 2; a.done = true;
      }
      break;
    case 'upper': {
      this.z = (LIFT.uppercut[a.i] || 0);
      if (a.i >= 1 && e && !this.hits.has(e)) {
        this.hits.add(e); this.grabbed = null;
        e.state = 'idle';
        e.takeHit(this, { dmg: MV.grab_upper.dmg, type: 'launch', dir: this.face, strike: true, smash: true, finisher: true, move: 'uppercut', se: 'hit_heavy' });
      }
      if (a.done) { this.z = 0; this.setState('idle', 'idle'); }
      break;
    }
    case 'throw': {
      const path = [[14, 6], [4, 26], [-10, 30]];
      if (e && a.i < 2) { const p = path[a.i]; e.x = this.x + this.face * p[0]; e.z = p[1]; e.y = this.y + 0.2; }
      if (a.i >= (AN.throw.release_frame || 2) && e) {
        this.grabbed = null;
        e.onThrown(this, this.throwDir);
      }
      if (a.done) this.setState('idle', 'idle');
      break;
    }
    case 'release':
      if (a.done) this.setState('idle', 'idle');
      break;
    }
  }

  draw() {
    this.drawShadow();
    if (this.invuln > 0 && this.state !== 'getup' && ((this.invuln / 60) | 0) % 2) return;
    // 武器を持っている時の待機: 刀は構え、銃は構え（素材がある武器だけ）。歩きは通常の歩き
    let anim = this.anim.name, idx = this.anim.i;
    if (this.weapon && this.state === 'idle') {
      const id = this.weapon.id;
      if (id === 'katana') { anim = 'katana_idle'; idx = 0; }
      else if (id === 'machinegun') { anim = 'machinegun_ready'; idx = 0; }
    }
    if (this.coolPose) { anim = 'mika_cool_idle'; idx = 0; }   // 4B到着演出: 腕を組んで待つ
    M.drawAnim(anim, idx, this.x - M.world.camX, this.y - this.z, this.face > 0);
    // 武器の軌跡（WEAPON_CONTACT_FX v002）: 武器モーションの同じコマに、足元原点をそろえて重ねる
    if (this.state === 'weapon' && M.ANIMS['wfx_' + anim]) M.drawAnim('wfx_' + anim, idx, this.x - M.world.camX, this.y - this.z, this.face > 0);
    this.drawWeaponTag();
  }
  // 持っている武器のアイコンと残り（回数・秒）を頭の上に。残りが少ないと赤く点滅
  drawWeaponTag() {
    if (!this.weapon || M.world.clearSeq) return;
    const W = M.WEAPONS[this.weapon.id], left = this.weaponLeft();
    const low = W.seconds ? left < 2500 : left <= Math.max(1, Math.ceil((W.uses || 1) * 0.2));
    if (low && ((M.world.fxTime / 160) | 0) % 2) return;
    const sx = Math.round(this.x - M.world.camX), sy = Math.round(this.y - this.z - 60);
    const txt = W.seconds ? String(Math.ceil(left / 1000)) : String(left);
    const tw = txt.length * 6 + 2, w2 = 18 + tw;
    const x0 = sx - (w2 >> 1);
    M.drawFrame(W.icon, x0 + 8, sy, [16, 16], false);
    M.text(txt, x0 + 18, sy - 3, { color: low ? '#ff6a5a' : '#bff' });
  }
}
M.Mika = Mika;
})();
