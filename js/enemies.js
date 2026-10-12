// enemies.js — 雑魚敵（ゴブリン系・スケルトン・デスハウンド・オーガ・ギガース・メガゴブリン・メガメガ）と武器持ち
'use strict';
(function () {
const M = window.MIKA, T = M.TUNING;
const { clamp, rand, sign, approach } = M;
const W = () => M.world;

// ---------------------------------------------------------------- 敵の一覧（monster_catalog.csv ＋ 新しいメカ2体）
const MON = M.REF.monsters;
// メガゴブリン: 素手威力は未設定→仮5、点数未設定→仮200（balance_proposal.json）。メガメガ: 攻撃8・点数仮200
MON.mega_goblin = MON.mega_goblin || { enemy_id: 'mega_goblin', name: 'メガゴブリン', family: 'mega_goblin', base_hp: 20, base_attack: 5, score: 200, provisional: ['base_attack', 'score'] };
MON.megamega = MON.megamega || { enemy_id: 'megamega', name: 'メガメガ', family: 'megamega', base_hp: 24, base_attack: 8, score: 200, provisional: ['score'] };
// ツギラ（2026-10-09 MIKA_STAGE4AB_MISSING）: 四脚の青銅色機械獣。HP40・平手打ち10・口レーザー10・200点（元資料「モンスター2」）。4・5面
MON.tsugira = MON.tsugira || { enemy_id: 'tsugira', name: 'ツギラ', family: 'tsugira', base_hp: 40, base_attack: 10, score: 200 };
// 2026-10-11 カオーン（MIKA_KAON_MOTIONS_v045）: トゲタイヤに笑う顔。止まって目を見開く予兆→マッハの体当たり。HP20・攻撃5（元仕様）。得点は資料に無いので[仮]200
// 2026-10-11 アシーン（MIKA_ASHIIN_HEELS_MOTIONS_v047）: タイツとハイヒールの脚4本の風車。パタパタ追いかけて時々キック。HP25・攻撃5（元仕様）。得点は[仮]200
MON.ashiin = MON.ashiin || { enemy_id: 'ashiin', name: 'アシーン', family: 'ashiin', base_hp: 25, base_attack: 5, score: 200, score_status: '[仮]' };
MON.kaon = MON.kaon || { enemy_id: 'kaon', name: 'カオーン', family: 'kaon', base_hp: 20, base_attack: 5, score: 200, score_status: '[仮]' };
M.MON = MON;

// ---------------------------------------------------------------- 家系ごとの素材と判定
// weapons: 武器ID → その家系の攻撃アニメ。fire=発射コマ、active=攻撃判定コマ
const GOBLIN_WEAPONS = {
  katana: { anim: 'goblin_katana', active: [1], reach: [4, 44], band: [10, 46] },
  war_axe: { anim: 'goblin_war_axe', active: [3], reach: [4, 46], band: [0, 50] },
  gungnir: { anim: 'goblin_gungnir', active: [2], reach: [6, 84], band: [14, 40] },
  battle_hammer: { anim: 'goblin_battle_hammer', active: [2], reach: [8, 58], band: [0, 50] },
  machinegun: { anim: 'goblin_machinegun', fire: [1, 2], burst: 6 },
  rocket_launcher: { anim: 'goblin_rocket_launcher', fire: [1] },
  yoichi_bow: { anim: 'goblin_yoichi_bow', fire: [3] },
  flamethrower: { anim: 'goblin_flamethrower', fire: [2], hold: 2 },
  rocket_punch: { anim: 'goblin_rocket_punch', fire: [2], hold: 2 },
  wave_cannon: { anim: 'goblin_wave_cannon', fire: [2] },
};
const MEGA_WEAPONS = {
  katana: { anim: 'mega_goblin_katana', active: [2], reach: [4, 50], band: [10, 50] },
  war_axe: { anim: 'mega_goblin_axe', active: [2], reach: [4, 50], band: [0, 54] },
  gungnir: { anim: 'mega_goblin_spear', active: [2], reach: [6, 84], band: [14, 44] },
  battle_hammer: { anim: 'mega_goblin_hammer', active: [2], reach: [8, 60], band: [0, 54] },
  machinegun: { anim: 'mega_goblin_smg', fire: [1, 2], burst: 6 },
  rocket_launcher: { anim: 'mega_goblin_rocket', fire: [1] },
  yoichi_bow: { anim: 'mega_goblin_bow', fire: [2] },
  flamethrower: { anim: 'mega_goblin_flamethrower', fire: [1], hold: 2 },
  rocket_punch: { anim: 'mega_goblin_rocket_punch', fire: [1], hold: 2 },
  wave_cannon: { anim: 'mega_goblin_hadou_cannon', fire: [2] },
};
const FAMILY = {
  goblin: {
    idle: 'goblin_idle', walk: 'goblin_walk', attack: 'goblin_punch', active: [1],
    hurtPop: 'goblin_knee_hit', hurt: 'goblin_knee_hit_normal', grabbed: 'goblin_grabbed',
    air: 'goblin_airborne', down: 'goblin_downed', getup: 'goblin_getup',
    body: [22, 44], shadow: 18, attackReach: [6, 30], attackBand: [14, 40], grabbable: true, weapons: GOBLIN_WEAPONS, death: 'blink', armCut: 16,
  },
  goblin_helmet: {
    idle: 'goblin_helmet_idle', walk: 'goblin_helmet_walk', attack: 'goblin_punch', active: [1],
    hurtPop: 'goblin_helmet_knee_hit', hurt: 'goblin_helmet_knee_hit', grabbed: 'goblin_helmet_grabbed',
    air: 'goblin_helmet_airborne', down: 'goblin_helmet_downed', getup: 'goblin_helmet_getup',
    body: [22, 44], shadow: 18, attackReach: [6, 30], attackBand: [14, 40], grabbable: true,
    weapons: Object.assign({}, GOBLIN_WEAPONS, { katana: { anim: 'goblin_helmet_katana', active: [1], reach: [4, 44], band: [10, 46] } }), death: 'blink', armCut: 16,
  },
  skeleton: {
    idle: 'skeleton_idle', walk: 'skeleton_walk', attack: 'skeleton_sword', active: [2],
    hurt: 'skeleton_damage', hurtIdx: 0, heavyIdx: 1, air: 'skeleton_knockback', airIdx: 0, down: 'skeleton_knockback', downIdx: 1,
    getup: 'skeleton_getup', guard: 'skeleton_guard', guardStyle: 'block',
    body: [24, 48], shadow: 20, attackReach: [4, 40], attackBand: [10, 44], grabbable: false, death: 'blink',
  },
  deathhound: {
    idle: 'deathhound_idle', walk: 'deathhound_run', attack: 'deathhound_leap', active: [2, 3],
    hurt: 'deathhound_damage', hurtIdx: 0, heavyIdx: 1, air: 'deathhound_knockback', airIdx: 0, down: 'deathhound_knockback', downIdx: 1,
    getup: 'deathhound_getup', body: [40, 24], shadow: 30, attackReach: [-4, 26], attackBand: [0, 28], grabbable: false, death: 'blink',
  },
  // オーガ: 10%ガード、ガード開始後はそのコンボ終了まで被ダメージ1（敵一覧の原案）
  ogre: {
    idle: 'ogre_idle', walk: 'ogre_walk', attack: 'ogre_punch', active: [2],
    hurt: 'ogre_damage', hurtIdx: 0, heavyIdx: 1, air: 'ogre_knockback', airIdx: 0, down: 'ogre_knockback', downIdx: 1,
    getup: 'ogre_getup', guard: 'ogre_guard', guardStyle: 'chip', grabbed: 'ogre_damage', grabbedIdx: 0,
    body: [34, 70], shadow: 36, attackReach: [6, 46], attackBand: [10, 64], grabbable: true, death: 'blink', armCut: 24,
    weapons: { war_axe: { anim: 'ogre_war_axe', active: [4], reach: [6, 62], band: [0, 70] }, yoichi_bow: { anim: 'ogre_yoichi_bow', fire: [4] } },
  },
  // ギガース: 巨大・硬い・隙が大きい。予兆付きダッシュ体当たり
  gigas: {
    idle: 'gigas_idle', walk: 'gigas_walk', attack: 'gigas_punch', active: [2], charge: 'gigas_charge',
    hurt: 'gigas_damage', hurtIdx: 0, heavyIdx: 1, air: 'gigas_knockback', airIdx: 0, down: 'gigas_knockback', downIdx: 1,
    getup: 'gigas_getup', grabbed: 'gigas_damage', grabbedIdx: 0,
    body: [48, 92], shadow: 56, attackReach: [10, 64], attackBand: [10, 80], grabbable: true, death: 'blink', heavy: true,
  },
  // メガゴブリン: 機械。死亡は爆発→部品→ガラクタ→点滅→消失
  mega_goblin: {
    idle: 'mega_goblin_idle', walk: 'mega_goblin_walk', attack: 'mega_goblin_punch', active: [2],
    hurt: 'mega_goblin_hit', hurtAnim: true, air: 'mega_goblin_knockback', airSeq: true, down: 'mega_goblin_down', downAnim: true,
    getup: 'mega_goblin_getup', grabbed: 'mega_goblin_hit', grabbedIdx: 0,
    body: [24, 50], shadow: 22, attackReach: [6, 36], attackBand: [12, 44], grabbable: true, weapons: MEGA_WEAPONS, armCut: 22,
    death: 'mech', deathAnim: 'mega_goblin_death', deathFx: 'mega_explosion', deathFxZ: 36,
  },
  // メガメガ: 歩く→止まる→見回す→歩く。殴り（奥の腕）と掌からの射撃1発
  megamega: {
    idle: 'megamega_idle', walk: 'megamega_walk', attack: 'megamega_punch', active: [2], scan: 'megamega_scan', shoot: 'megamega_shoot',
    hurt: 'megamega_hit', hurtAnim: true, air: 'megamega_knockback', airSeq: true, down: 'megamega_down', downIdx: 0,
    getup: 'megamega_getup', grabbed: 'megamega_hit', grabbedIdx: 0,
    body: [40, 70], shadow: 40, attackReach: [8, 58], attackBand: [10, 70], grabbable: true,
    death: 'mech', deathAnim: 'megamega_death', deathFx: 'megamega_explosion', deathFxZ: 40,
  },
  // ツギラ: かさかさ高速で寄る→時々止まって様子見。近くの同じ軸は平手打ち、遠い同じ軸は目を見開いて口レーザー
  tsugira: {
    // 2026-10-11 MIKA_ENEMY_MOTIONS_v043: 走り6・平手打ち6（当たりは2・3コマ）・被弾（軽/重）・吹っ飛び→転倒→復帰・破壊6コマ。待機は元の絵のまま
    idle: 'tsugira_idle', walk: 'tsugira_run', attack: 'tsugira_slap', active: [2, 3],
    hurt: 'tsugira_hurt', hurtIdx: 0, heavyIdx: 1, air: 'tsugira_knockback', airSeq: true, down: 'tsugira_down', downIdx: 0, getup: 'tsugira_getup',
    grabbed: 'tsugira_hurt', grabbedIdx: 0,
    body: [56, 40], shadow: 50, attackReach: [4, 46], attackBand: [6, 40], grabbable: false, heavy: true,
    death: 'mech', deathAnim: 'tsugira_death', deathDurs: [400, 250, 250, 300, 350, 350], deathFx: 'mega_explosion', deathFxZ: 20, laser: true,
  },
  // アシーン: ゴブリンと同じく追いかけて蹴る。倒れる時は爆発せず、折りたたむように倒れる6コマ→点滅して消える
  ashiin: {
    idle: 'ashiin_idle', walk: 'ashiin_run', attack: 'ashiin_kick', active: [2, 3],
    hurt: 'ashiin_hurt', hurtIdx: 0, heavyIdx: 1, air: 'ashiin_knockback', airSeq: true, down: 'ashiin_down', downIdx: 0, getup: 'ashiin_getup',
    grabbed: 'ashiin_hurt', grabbedIdx: 0,
    body: [34, 46], shadow: 30, attackReach: [6, 38], attackBand: [8, 36], grabbable: true,
    death: 'blink', deathAnim: 'ashiin_death', deathMotion: true, deathMotionMs: 800,
    spin: true,   // 2026-10-11 v049: 移動中は脚4本をタイヤのように高速回転（描画だけ）
  },
  // カオーン: 普段は止まって相手の軸へゆっくり寄るだけ。予兆（目を見開く）→向きを決めて一直線に突進→急ブレーキ。突進中だけ攻撃（1回の突進で同じ相手に1回）
  kaon: {
    idle: 'kaon_idle', walk: 'kaon_idle', attack: 'kaon_charge', active: [],
    hurt: 'kaon_hurt', hurtIdx: 0, heavyIdx: 1, air: 'kaon_knockback', airSeq: true, down: 'kaon_down', downIdx: 0, getup: 'kaon_getup',
    grabbed: 'kaon_hurt', grabbedIdx: 0,
    body: [40, 44], shadow: 36, attackReach: [-14, 24], attackBand: [0, 46], grabbable: false,
    death: 'mech', deathAnim: 'kaon_death', deathDurs: [400, 250, 250, 300, 350, 350], deathFx: 'mega_explosion', deathFxZ: 20, kaon: true,
  },
};
M.FAMILY = FAMILY;
const RANGED = { gun: 1, rocket: 1, bow: 1, fist: 1, beam: 1 };
const SPIN_MOVE = new Set(['walk', 'approach', 'enter', 'walkcycle', 'hover', 'dodge']);
const SPIN = { tps: 9.5, pivot: [41, 47], outline: [[16, 53], [39, 24], [40, 24], [42, 25], [47, 30], [64, 54], [64, 55], [44, 69], [41, 69], [37, 68], [17, 54]] };   // 9.5回転/秒（実際の移動の速さで約0.7〜1.45倍）。回転軸と輪郭は v049 の値

// 敵の行動の数値（家系ごと。色違いは speedMul で少し速く）
const SPEED_MUL = { hobgoblin: 1.07, death_goblin: 1.13, dark_goblin: 1.2, ograst: 1.05, big_ogre: 1.08, ogyar: 1.12, hill_gigas: 1.04, yor_gigas: 1.06, papa_gigas: 1.1 };

class Enemy extends M.Actor {
  constructor(def, x, y, opts = {}) {
    super(x, y);
    const w = W();
    this.team = 'enemy';
    this.def = def;
    this.fam = FAMILY[def.family] || FAMILY.goblin;
    this.weapon = opts.weapon && opts.weapon !== 'none' ? opts.weapon : null;
    if (def.family === 'goblin' && opts.appearance === 'helmet') this.fam = FAMILY.goblin_helmet;
    if (this.weapon && !(this.fam.weapons && this.fam.weapons[this.weapon])) this.weapon = null;   // その家系に絵がない武器は持たせない
    this.wspec = this.weapon ? this.fam.weapons[this.weapon] : null;
    this.wkind = this.weapon ? M.WEAPONS[this.weapon].kind : null;
    this.wuses = this.weapon ? M.ENEMY_WEAPON[this.weapon].uses : 0;
    this.variant = M.hasVariant(def.enemy_id) ? def.enemy_id : null;   // 色違いは描画時パレット変換
    this.cfg = Object.assign({}, T.enemies[def.family] || T.enemies.goblin);
    this.cfg.speed *= SPEED_MUL[def.enemy_id] || 1;
    const stage = w.stage || 1;
    const baseHp = (T.enemyHp && T.enemyHp[def.enemy_id] != null) ? T.enemyHp[def.enemy_id] : (def.base_hp || 10);
    // 雑魚HP = 切り上げ(基本HP × 面の倍率)。一度だけ適用（ボスには掛けない）
    this.maxHp = Math.max(1, Math.ceil(baseHp * T.enemyCommon.hpScale * (T.stageHp[stage] || 1)));
    this.hp = this.maxHp;
    this.coolMul = T.stageCooldown[stage] || 1;
    this.atk = def.base_attack || this.cfg.attackDmg || 5;
    this.bodyW = this.fam.body[0]; this.bodyH = this.fam.body[1]; this.shadowW = this.fam.shadow;
    this.slot = opts.slot || 0; this.fixed = !!opts.fixed; this.hold = !!opts.hold;
    this.cool = rand(...T.enemyCommon.aggroDelayMs) * this.coolMul;
    this.hits = new Set();
    this.face = x < w.camX + M.W / 2 ? 1 : -1;
    this.id = Enemy.serial = (Enemy.serial || 0) + 1;
    this.enterTo = opts.enterTo; this.enterY = opts.enterY;
    if (opts.drop) { this.z = opts.drop; this.setState('drop', this.fam.air || this.fam.idle); }
    else if (opts.emerge) { this.z = 1; this.vz = 150; this.vx = opts.emerge * 50; this.setState('drop', this.fam.air || this.fam.idle); }
    else this.setState(opts.enterTo !== undefined ? 'enter' : 'idle', opts.enterTo !== undefined ? this.fam.walk : this.fam.idle, { loop: true });
    this.megaWalkT = rand(800, 1800);
  }
  get name() { return (this.def.enemy_id || 'enemy').replace(/_/g, ' '); }
  get isRanged() { return !!(this.wkind && RANGED[this.wkind]); }
  grabbable() { return this.fam.grabbable && this.z === 0 && ['idle', 'approach', 'enter', 'hover', 'walkcycle'].includes(this.state); }
  canBeHit(info) {
    if (this.dead || this.hp <= 0 || ['dying', 'grabbed', 'thrown', 'down', 'getup', 'drop'].includes(this.state)) return false;
    if (this.cfg.groundedLowOnly && this.z <= 0 && this.state !== 'attack' && info && !info.low && !info.ranged) return false;
    // 2026-10-11 アシーン: 攻撃が当たる瞬間にも、かなりの確率で身をかわして飛びのく（かわした直後は少しの間当たらない）
    const C = this.cfg.dodge;
    if (C && this.z <= 0) {
      const now = W().fxTime;
      if (this.evadeUntil && now < this.evadeUntil) return false;
      if (['idle', 'approach', 'hover', 'walkcycle', 'dodge', 'enter'].includes(this.state) && (this.evadeRoll || 0) < now) {
        this.evadeRoll = now + 200;   // 同じ攻撃で毎フレーム振り直さない
        if (Math.random() < C.evadeHit) {
          this.evadeUntil = now + 260;
          const m = W().mika, away = sign(this.x - m.x) || 1;
          this.setState('dodge', this.fam.walk, { loop: true }); this.vx = away * C.speed; this.vy = (Math.random() < 0.5 ? -1 : 1) * C.speed * 0.4; this.dodgeMs = C.ms;
          return false;
        }
      }
    }
    return true;
  }
  target() {
    const w = W(), m = w.mika, r = w.robot;
    const mOk = m && !['defeated', 'down', 'knock', 'getup', 'rescued', 'entrance', 'clear', 'walkout', 'exit'].includes(m.state);
    const rOk = r && r.targetable();
    if (this.taunted && mOk) return m;
    // ミカとロボの近い方を狙う。時々入れ替える（同じ相手へ集中しすぎない）
    this.tgtT = (this.tgtT || 0) - 16;
    if (this.tgt && this.tgtT > 0 && ((this.tgt === m && mOk) || (this.tgt === r && rOk))) return this.tgt;
    let t = null;
    if (mOk && rOk) t = Math.abs(r.x - this.x) + Math.abs(r.y - this.y) * 2 < Math.abs(m.x - this.x) + Math.abs(m.y - this.y) * 2 - 30 ? r : m;
    else t = mOk ? m : rOk ? r : null;
    this.tgt = t; this.tgtT = rand(2500, 4500);
    return t;
  }
  hitSE(info) {
    if (info.se) return info.se;
    if (info.ranged && info.weapon === 'machinegun') return 'hit_mg';    // 2026-10-12 v103
    if (info.ranged && info.weapon === 'yoichi_bow') return 'hit_arrow';
    if (info.weapon && M.WEAPONS[info.weapon] && M.WEAPONS[info.weapon].hitSE && !info.ranged) return 'weapon_hit';
    if (info.smash || info.move === 'uppercut') return 'hit_heavy';
    if (info.thrownBody || info.thrownLand) return 'throw_land';
    if (info.ranged) return info.type === 'launch' ? 'hit_mid' : 'bullet_hit';   // 弾は軽い音
    return info.type === 'launch' || info.type === 'down' || info.dmg >= 3 ? 'hit_mid' : 'hit';
  }
  takeHit(att, info) {
    const w = W();
    this.hold = false;   // 殴られたら持ち場を捨てて普通に動く
    this.dormant = false;   // 2026-10-10: 次の区間の固定敵（まだ動かない）を先に撃って倒すと、吹っ飛びの途中で止まっていた不具合の修正
    if (this.state === 'laser') { this.flash = 0; this.laserLen = 0; this.laserSE = false; }
    // スケルトン: 盾で防ぐ（ダメージなし）
    if (this.guarding > 0 && this.state === 'guard' && this.fam.guardStyle === 'block' && info.strike && !info.low && sign(att.x - this.x) === this.face) {
      M.spark(this.x + this.face * 8, this.y, this.z + 26); M.Audio.play('land'); att.freeze = 40; return true;
    }
    if (this.fam.guard && this.fam.guardStyle === 'chip' && info.strike && this.state !== 'attack' && this.z === 0 && !(this.guarding > 0) && Math.random() < (this.cfg.guardChance || 0) && sign(att.x - this.x) === this.face) {
      this.guarding = this.fam.guardStyle === 'chip' ? 700 : 500; this.setState('guard', this.fam.guard); this.vx = 0;
      if (this.fam.guardStyle === 'block') { M.spark(this.x + this.face * 8, this.y, this.z + 26); att.freeze = 40; M.Audio.play('land'); return true; }
    }
    // オーガのガード: そのコンボが終わるまで被ダメージ1・のけぞらない
    if (this.guarding > 0 && this.fam.guardStyle === 'chip' && !info.ranged) {
      this.hp = Math.max(0, this.hp - 1); this.guarding = 700;
      M.spark(this.x + this.face * 10, this.y, this.z + 40); att.freeze = 50; M.Audio.play('hit', { gain: 0.6 });
      w.onEnemyHit(this, att, info);
      if (this.hp > 0) return true;
    } else {
      this.hp = Math.max(0, this.hp - info.dmg);
      w.onEnemyHit(this, att, info);
    }
    const stop = info.finisher ? T.hitstop.finisherMs : info.ranged ? 30 : T.hitstop.normalMs;
    this.freeze = info.flame ? 0 : stop; if (!info.ranged) att.freeze = Math.max(att.freeze || 0, stop);
    M.spark(this.x - info.dir * this.bodyW * 0.3, this.y, this.z + this.bodyH * 0.6);
    if (info.smash) { M.spawnSmash(this.x, this.y, this.z + this.bodyH * 0.7); w.shake = T.hitstop.shakeFinisher; }
    if (!info.flame || ((this.flameSE = (this.flameSE || 0) + 1) % 3 === 1)) M.Audio.play(this.hitSE(info), { robot: info.robot });
    if (this.state === 'grabbed' && info.type === 'grab' && this.hp > 0) { this.hurtFlash = 160; return true; }
    if (this.state === 'grabbed') this.state = 'idle';
    if (this.flameHold) { this.flameHold.on = false; this.flameHold = null; }
    const heavy = this.fam.heavy && info.dmg < 6 && !info.smash && !info.thrownBody && info.type !== 'grab';
    if (info.thrownBody || ((info.type === 'launch' || this.hp <= 0 || this.z > 0) && !(heavy && this.hp > 0 && this.z === 0))) {
      const lv = info.smash ? [T.launch.smashVx, T.launch.smashVz] : [T.launch.vx, T.launch.vz];
      const k = this.fam.heavy ? 0.6 : 1;
      this.vx = info.dir * lv[0] * k; this.vy = 0; this.vz = lv[1] * k;
      this.face = -info.dir;
      this.setState('air', this.fam.air);
      this.knocked = true;
    } else if (info.type === 'down' && !heavy) {
      this.vx = info.dir * 40; this.vz = 60; this.face = -info.dir;
      this.setState('air', this.fam.air);
    } else {
      this.face = -info.dir; this.vx = info.dir * (heavy ? 10 : 30);
      this.setState('hurt', this.fam.hurtPop && info.strike ? this.fam.hurtPop : this.fam.hurt);
      if (this.fam.hurtIdx !== undefined) this.anim.i = info.dmg >= 3 ? this.fam.heavyIdx : this.fam.hurtIdx;
    }
    return true;
  }
  onGrabbed(by) { this.setState('grabbed', this.fam.grabbed); this.vx = this.vz = 0; this.grabbedBy = by; if (this.flameHold) { this.flameHold.on = false; this.flameHold = null; } }
  onReleased() { this.setState('idle', this.fam.idle, { loop: true }); this.cool = 300; }
  weight() {
    const TW = M.REF.throwWeights, id = this.def.enemy_id;
    const fam = (TW.proposed_inheritance || {})[id] || id;
    return (TW.confirmed[id] || TW.confirmed[fam] || {}).weight || TW.proposed_family_weights[id] || TW.proposed_family_weights[fam] || TW.proposed_family_weights[this.def.family] || 10;
  }
  onThrown(by, dir) {
    this.newAttack();
    this.hits.add(by);
    this.state = 'thrown'; this.st = 0; this.anim.set(this.fam.air);
    // 投げ距離 = D0 × 2 × 10 ÷ 重量（D0 は変更前のゴブリンの距離。滞空と弧は据え置き、横速度だけ変える）
    this.vx = dir * T.throwD0.vx * 2 * 10 / this.weight(); this.vz = T.throwD0.vz; this.face = -dir; this.thrower = by;
  }
  update(dt) {
    const bx = this.x, by = this.y;
    this.updateCore(dt);
    if (this.fam === FAMILY.tsugira) this.runSound(Math.hypot(this.x - bx, this.y - by));
    if (!this.fam.spin) return;
    if (!(M.game && M.game.paused)) this.spinUpdate(dt, this.x - bx, this.y - by);
  }
  // 2026-10-11 ツギラが走っている間の音（SE_TUGIRA_KAITEN。仮の使い方: 走っている間ループ）
  runSound(dist) {
    const w = W(), on = SPIN_MOVE.has(this.state) && dist > 0.05 && !this.dead && this.x > w.camX - 20 && this.x < w.camX + M.W + 20;
    if (on) { if (!this.runV || this.runV.ended) this.runV = M.Audio.play('tsugira_spin', { loop: true }); M.Audio.touchLoop(this.runV); this.runOff = 0; }
    else if (this.runV && !this.runV.ended && (this.runOff = (this.runOff || 0) + 1) > 6) { M.Audio.stopLoop(this.runV); this.runV = null; }
  }
  updateCore(dt) {
    if (this.guarding > 0) this.guarding -= dt;
    if (this.hurtFlash > 0) this.hurtFlash -= dt;
    if (this.freeze > 0) { this.freeze -= dt; return; }
    this.st += dt;
    const s = dt / 1000, w = W(), C = T.enemyCommon;
    const walk = w.walkY;
    switch (this.state) {
    case 'enter': {
      this.anim.update(dt);
      const tx = this.enterTo;
      this.face = sign(tx - this.x) || this.face;
      this.x = approach(this.x, tx, this.cfg.speed * 1.2 * s);
      if (this.enterY != null) this.y = approach(this.y, this.enterY, this.cfg.speedY * 1.5 * s);
      if (Math.abs(this.x - tx) < 1 && (this.enterY == null || Math.abs(this.y - this.enterY) < 1)) this.setState('idle', this.fam.idle, { loop: true });
      break;
    }
    case 'drop': {   // 上から降ってくる（エレベーター降下中）／槽から飛び出す
      this.airFrame();
      if (this.physicsAir(dt, 700)) { this.vx = 0; this.setState('idle', this.fam.idle, { loop: true }); this.cool = 450; w.shake = Math.max(w.shake, this.fam.heavy ? 1 : 0); M.Audio.play('land'); }
      break;
    }
    case 'idle': case 'approach': case 'hover': case 'walkcycle': this.think(dt, s); break;
    case 'attack': this.updateAttack(dt, s); break;
    case 'dodge': {   // 2026-10-11 アシーン: 素早く飛びのく
      this.anim.update(dt);
      const px = this.x;
      this.x += this.vx * s; this.y = clamp(this.y + this.vy * s, w.walkY[0], w.walkY[1]);
      this.keepX(px, w.camX + 12, w.camX + M.W - 12);   // 2026-10-12 v126: 画面外から一瞬で端へワープしない
      if (this.st >= this.dodgeMs) { this.setState('approach', this.fam.walk, { loop: true }); this.cool = Math.max(this.cool, 150); }
      break;
    }
    case 'charge': if (this.fam.kaon) this.updateKaon(dt, s); else this.updateCharge(dt, s); break;
    case 'laser': this.updateLaser(dt); break;
    case 'scan': this.anim.update(dt); if (this.anim.done) { this.setState('idle', this.fam.idle, { loop: true }); this.megaWalkT = rand(900, 1800); } break;
    case 'guard': this.anim.update(dt); if (this.guarding <= 0) this.setState('idle', this.fam.idle, { loop: true }); break;
    case 'hurt': {
      if (this.fam.hurtAnim) this.anim.update(dt);
      this.x += this.vx * s; this.vx = approach(this.vx, 0, 200 * s);
      if (this.st >= C.hurtMs) this.setState('idle', this.fam.idle, { loop: true }), (this.cool = rand(200, 600) * this.coolMul);
      break;
    }
    case 'air': {
      this.airFrame();
      const px = this.x;
      if (this.physicsAir(dt, 620)) {
        if (Math.abs(this.vx) > 60 && !this.bounced) { this.vz = 70; this.z = 0.1; this.vx *= 0.45; this.bounced = true; M.Audio.play('land'); break; }
        this.bounced = false; this.vx = 0;
        this.setState('down', this.fam.down, { hold: true });
        if (this.weight() >= 15) w.shake = Math.max(w.shake, this.weight() / 8);   // 重い敵が倒れると揺れる
        if (this.fam.downIdx !== undefined) this.anim.i = this.fam.downIdx;
        M.Audio.play('enemy_down');
      }
      this.keepX(px, w.camX - 20, w.camX + M.W + 20);
      break;
    }
    case 'thrown': {
      // 投げられた敵は他の敵を巻き込む
      this.airFrame();
      const box = { x0: this.x - 14, x1: this.x + 14, y: this.y, depth: 10, z0: this.z, z1: this.z + 30 };
      M.applyAttack(this, box, w.enemies.filter((e) => !e.boss), { dmg: T.moves.thrown_body.dmg, type: 'launch', dir: sign(this.vx), thrownBody: true, strike: false });
      const px = this.x;
      const landed = this.physicsAir(dt, 620);
      this.keepX(px, w.camX - 20, w.camX + M.W + 20);   // 2026-10-12 v126: 投げは画面の端（の少し外）で止まる。前は画面外まで飛んで、着地で端へワープしていた
      if (landed) {
        this.vx = sign(this.vx) * 40; this.z = 0.1; this.vz = 50;
        this.state = 'idle';
        this.takeHit(this.thrower, { dmg: T.moves.throw.dmg, type: 'launch', dir: sign(this.vx), strike: false, thrownLand: true });
        // 投げで叩きつけた: 大きくバウンドして画面を揺らす（重い敵ほど強く）
        const wt = this.weight();
        this.vx *= 0.5; this.vz = T.throwBounce.vz; this.bounced = true;
        w.shake = Math.max(w.shake, T.throwBounce.shake + (wt - 10) * T.throwBounce.shakePerWeight);
      }
      break;
    }
    case 'down': {
      if (this.fam.downAnim) this.anim.update(dt);
      if (this.st >= (this.hp <= 0 ? 350 : C.downedMs)) {
        if (this.hp <= 0) this.beginDying();
        else if (this.fam.getup) this.setState('getup', this.fam.getup);
        else { this.setState('getup', this.fam.down); this.anim.i = 0; }
      }
      break;
    }
    case 'getup': {
      if (this.fam.getup) this.anim.update(dt);
      if (this.fam.getup ? this.anim.done : this.st >= C.getupMs) { this.setState('idle', this.fam.idle, { loop: true }); this.cool = rand(300, 700) * this.coolMul; }
      break;
    }
    case 'grabbed': this.anim.i = this.fam.grabbedIdx || 0; break;
    case 'dying': this.updateDying(dt); break;
    }
    if (!['air', 'thrown', 'dying', 'drop', 'enter'].includes(this.state)) this.y = clamp(this.y, walk[0], walk[1]);
    // 機械の雑魚の足音: 歩きのコマが 0・2 に変わった時（画面内だけ）
    if (this.fam.death === 'mech' && this.anim.name === this.fam.walk) {
      if (this.anim.i !== this.stepI) { this.stepI = this.anim.i; if (this.anim.i % 2 === 0 && this.x > w.camX - 10 && this.x < w.camX + M.W + 10) M.Audio.play('machine_walk'); }
    } else this.stepI = -1;
  }
  // 2026-10-12 v126: 横の範囲制限。範囲の外へ出ていくのは止めるが、すでに外にいる時に一瞬で範囲内へ引き戻さない（アシーンが吹っ飛び後に変な位置へワープする不具合）
  keepX(px, lo, hi) { this.x = clamp(this.x, Math.min(px, lo), Math.max(px, hi)); }
  airFrame() {
    if (this.fam.airSeq) this.anim.i = this.vz > 60 ? 0 : this.vz > -20 ? 1 : 2;
    else if (this.fam.airIdx !== undefined) this.anim.i = this.fam.airIdx;
  }
  // 死亡: ゴブリン系は点滅して消える／メカは爆発→部品→ガラクタ→点滅→消失。得点とドロップは死亡開始時に一度だけ
  beginDying() {
    const w = W();
    this.state = 'dying'; this.st = 0; this.st2 = 0; this.blinkT = 0;
    if (this.fam.death === 'mech') {
      this.anim.set(this.fam.deathAnim, { durs: this.fam.deathDurs || [400, 250, 250, 1000], hold: true });   // ツギラは6コマ（合計1900ms）
      M.Audio.play('explosion');
      if (!this.noScore) M.Audio.play('death_machine');   // 機械の雑魚が壊れる音
      if (!this.noScore && this.fam === FAMILY.tsugira) M.Audio.play('edeath_tsugira');   // 2026-10-11 ツギラの断末魔
    } else {
      const DV = { goblin: 'edeath_goblin', goblin_helmet: 'edeath_goblin', skeleton: 'edeath_skeleton', deathhound: 'edeath_dog', ogre: 'edeath_ogre', gigas: 'edeath_gigas', ashiin: 'edeath_ashiin' };
      const fk = Object.keys(DV).find((k) => this.fam === FAMILY[k]);
      if (fk && !this.noScore) M.Audio.play(DV[fk]);   // 断末魔（ボス戦の後で消える取り巻きは鳴らさない）
      if (this.fam.deathMotion) this.anim.set(this.fam.deathAnim, { hold: true });   // アシーン: 倒れる動作を再生してから点滅
      else {
        this.anim.set(this.fam.down, { hold: true });
        if (this.fam.downIdx !== undefined) this.anim.i = this.fam.downIdx;
        if (this.fam.downAnim) this.anim.i = (M.ANIMS[this.fam.down] ? M.ANIMS[this.fam.down].frames.length : 1) - 1;
      }
    }
    w.onEnemyDying(this);
    if (this.dropWeapon && this.weapon && !this.dropped) { this.dropped = true; w.dropWeaponItem(this.weapon, this.x, this.y); }
  }
  updateDying(dt) {
    const w = W(), B = T.blink;
    this.st2 += dt;
    if (this.fam.death === 'mech') {
      this.anim.update(dt);
      if (this.anim.i >= 1 && !this.fxDone) {
        this.fxDone = true;
        w.effects.push(new M.Effect({ x: this.x, y: this.y + 0.6, z: this.fam.deathFxZ, anim: new M.Anim(this.fam.deathFx), life: 700 }));
        w.shake = Math.max(w.shake, 1);
      }
      if (this.st2 < 1900) return;
      const k = Math.floor((this.st2 - 1900) / 100);
      this.alpha = k % 2 ? 0 : 1;
      if (this.st2 >= 1900 + 1200) { this.remove = true; this.dead = true; w.onEnemyRemoved(this); }
      return;
    }
    let t2 = this.st2;
    if (this.fam.deathMotion) { this.anim.update(dt); t2 -= this.fam.deathMotionMs; if (t2 < 0) { this.alpha = 1; return; } }
    const k = Math.floor(t2 / B.intervalMs);
    this.alpha = k % 2 ? 0 : 1;
    if (k >= B.count * 2) { this.remove = true; this.dead = true; w.onEnemyRemoved(this); }
  }

  // ---------------------------------------------------------------- アシーンの高速回転（MIKA_ASHIIN_FAST_SPIN_v049 ashiin_spin.js を移植。描画だけで判定・速さは変えない）
  spinUpdate(dt, dx, dy) {
    const S = this.spinS = this.spinS || { angle: 0, omega: 0, on: false, dir: 1 };
    const t = Math.max(0, Math.min(100, dt)) / 1000; if (!t) return;
    const dist = Math.hypot(dx, dy), moving = SPIN_MOVE.has(this.state) && dist > 0.015;
    if (!moving && this.state !== 'idle' && this.state !== 'hover') { S.angle = 0; S.omega = 0; S.on = false; return; }   // キック・被弾・転倒・死亡はすぐ通常の絵へ
    if (moving) {
      if (Math.abs(dx) > 0.015) S.dir = dx > 0 ? 1 : -1;   // 右へ動けば時計回り、左へ動けば反時計回り（上下だけなら直前の向き）
      const target = S.dir * Math.PI * 2 * SPIN.tps * Math.min(1.45, Math.max(0.7, dist / t / 80));
      S.omega += (target - S.omega) * (1 - Math.exp(-t / 0.045));
      S.angle = (S.angle + S.omega * t) % (Math.PI * 2); S.on = true;
      // 2026-10-11 回転の音（SE_ASSIN_KAITEN）: 1回転ごとに1回。画面の中だけ
      S.rev = (S.rev || 0) + Math.abs(S.omega * t);
      if (S.rev >= Math.PI * 2) { S.rev -= Math.PI * 2; const w = W(); if (this.x > w.camX - 10 && this.x < w.camX + M.W + 10) M.Audio.play('ashiin_spin'); }
    } else if (S.on) {   // 止まったら約0.1秒で姿勢を戻す
      S.omega = 0; S.angle = Math.atan2(Math.sin(S.angle), Math.cos(S.angle)) * Math.exp(-t / 0.025);
      if (Math.abs(S.angle) < 0.02) { S.angle = 0; S.on = false; }
    }
  }
  drawSpin() {
    const S = this.spinS; if (!S || !S.on || this.alpha <= 0) return false;
    const [px, py] = SPIN.pivot, flip = this.face > 0 ? -1 : 1, c = Math.cos(S.angle), sn = Math.sin(S.angle);
    let bottom = -Infinity; for (const [x, y] of SPIN.outline) bottom = Math.max(bottom, sn * (x - px) * flip + c * (y - py));   // 回した後の一番下を足元に合わせる
    const ctx = M.ctx; ctx.save(); ctx.globalAlpha *= this.alpha;
    ctx.translate(Math.round(this.x - W().camX + (px - 40) * flip), Math.round(this.y - this.z - bottom));
    ctx.rotate(S.angle); ctx.scale(flip, 1); M.drawFrame('ashiin_run_0', -px, -py, [0, 0], false); ctx.restore();
    return true;
  }
  // ---------------------------------------------------------------- 考える
  // 2026-10-11 アシーン: ミカが近くで攻撃したら横へ飛びのく／時々ランダムに飛び回る
  tryDodge(dt, tgt) {
    const w = W(), m = w.mika, C = this.cfg.dodge, Dt = this.cfg.dart;
    this.dodgeCool = (this.dodgeCool || 0) - dt;
    this.dartT = (this.dartT == null ? rand(...Dt.everyMs) : this.dartT) - dt;
    const go = (vx, vy, ms) => { this.setState('dodge', this.fam.walk, { loop: true }); this.vx = vx; this.vy = vy; this.dodgeMs = ms; this.face = sign(tgt.x - this.x) || this.face; };
    const attacking = ['attack', 'weapon'].includes(m.state) || (m.state === 'jump' && m.move);
    if (attacking && this.dodgeCool <= 0 && Math.abs(this.x - m.x) < C.dist && Math.abs(this.y - m.y) < C.depth && Math.random() < C.chance) {
      this.dodgeCool = C.coolMs;
      const away = sign(this.x - m.x) || (Math.random() < 0.5 ? -1 : 1);
      go(away * C.speed, (this.y < (w.walkY[0] + w.walkY[1]) / 2 ? 1 : -1) * C.speed * 0.45, C.ms);
      return true;
    }
    if (this.dartT <= 0 && this.state !== 'attack') {
      this.dartT = rand(...Dt.everyMs);
      const a = rand(0, Math.PI * 2);
      go(Math.cos(a) * Dt.speed, Math.sin(a) * Dt.speed * 0.5, Dt.ms);
      return true;
    }
    return false;
  }
  think(dt, s) {
    const w = W(), tgt = this.target();
    this.anim.update(dt);
    if (!tgt || w.holdEnemies) { if (this.state !== 'idle') this.setState('idle', this.fam.idle, { loop: true }); return; }
    if (this.cool > 0) this.cool -= dt;
    // スケルトン: 歩きながら時々立ち止まって盾を構える（離れている時ほど構えやすく、接近すると構えにくい）
    if (this.fam.guardStyle === 'block') {
      this.guardCheckT = (this.guardCheckT || 0) - dt;
      if (this.guardCheckT <= 0) {
        this.guardCheckT = T.enemies.skeleton.guardCheckMs;
        const d = Math.abs(tgt.x - this.x), G = T.enemies.skeleton;
        const p = d > 100 ? G.guardFar : d > 60 ? G.guardMid : G.guardNear;
        if (Math.random() < p) { this.guarding = rand(...G.guardMs); this.setState('guard', this.fam.guard); this.face = sign(tgt.x - this.x) || this.face; this.vx = 0; return; }
      }
    }
    // 遠距離の敵: 同じ軸で距離を取って撃つ（同時に撃ち始めない）
    if (this.isRanged && this.wuses > 0) return this.thinkRanged(dt, s, tgt);
    // メガメガ: 歩く→止まる→見回す
    if (this.def.family === 'megamega' && this.walkCycle(dt, tgt)) return;
    if (this.fam.kaon) return this.thinkKaon(dt, s, tgt);
    if (this.cfg.dodge && this.tryDodge(dt, tgt)) return;   // 2026-10-11 アシーン: 逃げる・飛び回る
    // ツギラ: 時々止まって様子見。遠い同じ軸なら口レーザー
    if (this.fam.laser) {
      const TS = T.enemies.tsugira;
      if ((this.pauseT = (this.pauseT || 0) - dt) > 0) { if (this.state !== 'hover') this.setState('hover', this.fam.idle, { loop: true }); this.face = sign(tgt.x - this.x) || this.face; return; }
      if (Math.random() < TS.pauseChancePerSec * dt / 1000) { this.pauseT = rand(...TS.pauseMs); return; }
      const adx0 = Math.abs(tgt.x - this.x);
      if (Math.abs(tgt.y - this.y) <= 6 && adx0 > TS.laserMinDist && adx0 < TS.laserMaxDist && this.cool <= 0 && w.rangedLock <= 0 && !w.holdAttacks
          && this.x > w.camX + 20 && this.x < w.camX + M.W - 20 && Math.random() < TS.laserChancePerSec * dt / 1000) return this.beginLaser(tgt);
    }
    let reach = this.wspec && this.wspec.reach ? this.wspec.reach[1] - 6 : this.cfg.reach;
    if (this.wkind === 'flame') reach = 64;
    const attackers = w.enemies.filter((e) => e !== this && (e.state === 'attack' || e.state === 'charge' || e.engaged) && !e.dead && !e.isRanged).length;
    const side = this.slot % 2 ? -1 : 1;
    const mySide = sign(this.x - tgt.x) || side;
    this.engaged = attackers < T.enemyCommon.maxAttackers || this.taunted;
    const dist = this.engaged ? reach * 0.8 : 60 + (this.slot % 3) * 14;
    let tx = tgt.x + mySide * dist;
    // 画面の外から殴らない: 立ち位置が画面外なら反対側へ回り込む
    if (tx > w.camX + M.W - 16 || tx < w.camX + 16) tx = tgt.x - mySide * dist;
    tx = clamp(tx, w.camX + 16, w.camX + M.W - 16);
    const ty = this.engaged ? tgt.y : clamp(tgt.y + ((this.slot % 3) - 1) * 12, w.walkY[0], w.walkY[1]);
    const px = this.x;
    this.moveToward(tx, ty, s);
    this.face = sign(tgt.x - this.x) || this.face;
    this.keepX(px, w.camX - 20, w.camX + M.W + 20);
    const adx = Math.abs(tgt.x - this.x);
    const inLane = Math.abs(tgt.y - this.y) <= this.cfg.attackDepth;
    // ギガース: 離れた同じ軸なら予兆付きの体当たり
    if (this.fam.charge && this.cool <= 0 && Math.abs(tgt.y - this.y) <= 8 && adx > 90 && adx < 230 && Math.random() < 0.02) return this.beginCharge(tgt);
    if (this.engaged && inLane && adx <= reach && adx >= 4 && this.cool <= 0 && tgt.z < 20 && !w.holdAttacks && !(this.isAdd && w.holdAdds)) this.beginAttack(tgt);
  }
  // カオーン: その場で相手の軸（y）へゆっくり合わせ、離れすぎ・近すぎなら少しだけ間合いを取る。条件がそろえば突進
  thinkKaon(dt, s, tgt) {
    const w = W(), K = T.enemies.kaon, adx = Math.abs(tgt.x - this.x), dy = tgt.y - this.y;
    this.face = sign(tgt.x - this.x) || this.face;
    const side = sign(this.x - tgt.x) || 1;
    let tx = this.x;
    if (adx < K.keepDist[0]) tx = tgt.x + side * K.keepDist[0]; else if (adx > K.keepDist[1]) tx = tgt.x + side * K.keepDist[1];
    tx = clamp(tx, w.camX + 24, w.camX + M.W - 24);
    this.x += clamp(tx - this.x, -this.cfg.speed * s, this.cfg.speed * s);
    this.y += clamp(dy, -this.cfg.speedY * s, this.cfg.speedY * s);
    if (this.state !== 'hover') this.setState('hover', this.fam.idle, { loop: true });
    if (this.cool <= 0 && Math.abs(dy) <= K.alignY && adx >= K.minDist && adx <= K.maxDist && !w.holdAttacks && !(this.isAdd && w.holdAdds)
        && this.x > w.camX + 16 && this.x < w.camX + M.W - 16 && tgt.z < 30) this.beginKaon(tgt);
  }
  beginKaon(tgt) {
    this.newAttack(); this.face = sign(tgt.x - this.x) || this.face;
    this.setState('charge', 'kaon_warn'); this.chargePhase = 'warn'; this.chargeDist = 0;
  }
  updateKaon(dt, s) {
    const w = W(), K = T.enemies.kaon, tgt = this.target();
    this.anim.update(dt);
    if (this.chargePhase === 'warn') {   // 止まって目を見開く。向きは予兆の終わりで決める（突進中は曲がらない）
      if (tgt) this.face = sign(tgt.x - this.x) || this.face;
      if (this.st >= K.warnMs) { this.chargePhase = 'run'; this.st = 0; this.chargeDist = 0; this.anim.set('kaon_charge', { loop: true }); M.Audio.play('dash', { rate: 0.7 }); }
      return;
    }
    if (this.chargePhase === 'run') {
      const d = K.chargeSpeed * s; this.x += this.face * d; this.chargeDist += d;
      const box = this.attackBox({ reach: this.fam.attackReach, band: this.fam.attackBand, depth: K.hitDepth });
      M.applyAttack(this, box, [w.mika, w.robot], { dmg: this.atk, type: 'launch', dir: this.face, strike: true });   // this.hits は newAttack で空にしてあるので1回の突進で同じ相手に1回
      // 2026-10-11 残像（直前の位置を薄く2つ）
      this.trail = [this.x - this.face * 14, this.x - this.face * 28];
      if (this.chargeDist >= K.chargeDist || (this.face < 0 && this.x < w.camX + 14) || (this.face > 0 && this.x > w.camX + M.W - 14)) {
        this.chargePhase = 'brake'; this.st = 0; this.trail = null; this.anim.set('kaon_brake', { hold: true }); w.shake = Math.max(w.shake, 1);
      }
      return;
    }
    if (this.st >= K.brakeMs) { this.setState('idle', this.fam.idle, { loop: true }); this.cool = rand(...K.coolMs) * this.coolMul; }
  }
  moveToward(tx, ty, s, mul = 1) {
    const ddx = tx - this.x, ddy = ty - this.y;
    const sp = this.cfg.speed * (this.taunted ? 1.3 : 1) * mul, spy = this.cfg.speedY * mul;
    if (Math.abs(ddx) > 3 || Math.abs(ddy) > 2) {
      this.x += clamp(ddx, -sp * s, sp * s);
      this.y += clamp(ddy, -spy * s, spy * s);
      if (this.state !== 'approach') this.setState('approach', this.fam.walk, { loop: true });
      return true;
    }
    if (this.state !== 'hover') this.setState('hover', this.fam.idle, { loop: true });
    return false;
  }
  walkCycle(dt, tgt) {
    this.megaWalkT -= dt;
    if (this.megaWalkT <= 0 && this.state !== 'hover') {
      this.megaWalkT = 0;
      if (Math.abs(tgt.y - this.y) <= 8 && Math.abs(tgt.x - this.x) > 70 && this.cool <= 0 && W().rangedLock <= 0 && Math.random() < 0.45) { this.beginShoot(tgt); return true; }
      this.setState('scan', this.fam.scan); this.face = sign(tgt.x - this.x) || this.face; return true;
    }
    return false;
  }
  thinkRanged(dt, s, tgt) {
    const w = W();
    this.engaged = false;
    const keep = this.wkind === 'fist' ? 90 : 130;
    // 持ち場から画面外へ飛ばされたら、持ち場を捨てて画面内へ戻る（画面外で止まって進行が止まらないように）
    if (this.hold && (this.x > w.camX + M.W - 16 || this.x < w.camX + 16)) this.hold = false;
    // 2026-10-10: 持ち場（バリケードの後ろの縦一列）で相手と同じ軸にならないまま待ち続けない（固まって見える不具合の対策）
    if (this.hold) { this.holdWait = (this.holdWait || 0) + dt; if (this.holdWait > T.enemyCommon.holdGiveUpMs) this.hold = false; }
    const mySide = sign(this.x - tgt.x) || (this.slot % 2 ? -1 : 1);
    let tx = this.hold ? this.x : tgt.x + mySide * keep;
    if (!this.hold) tx = clamp(tx, w.camX + 24, w.camX + M.W - 24);
    const ty = this.hold ? clamp(this.y + clamp(tgt.y - this.y, -4, 4), this.y0 - 4, this.y0 + 4) : tgt.y;
    if (this.y0 == null) this.y0 = this.y;
    this.moveToward(tx, ty, s, this.hold ? 0.5 : 0.9);
    this.face = sign(tgt.x - this.x) || this.face;
    const aligned = Math.abs(tgt.y - this.y) <= 6 && Math.abs(tgt.x - this.x) > 40 && Math.abs(tgt.x - this.x) < 260;
    if (aligned && this.cool <= 0 && w.rangedLock <= 0 && !w.holdAttacks && !(this.isAdd && w.holdAdds) && this.x > w.camX + 8 && this.x < w.camX + M.W - 8) {
      w.rangedLock = T.enemyCommon.rangedGapMs;   // 次の射撃までずらす
      this.holdWait = 0;
      this.beginAttack(tgt);
    }
  }
  beginAttack(tgt) {
    this.newAttack();
    this.face = sign(tgt.x - this.x) || this.face;
    const sp = this.wspec && this.wuses > 0 ? this.wspec : null;
    this.curAtt = sp ? Object.assign({ weapon: this.weapon, kind: this.wkind }, sp) : { anim: this.fam.attack, active: this.fam.active, reach: this.fam.attackReach, band: this.fam.attackBand };
    this.setState('attack', this.curAtt.anim);
    this.fired = {}; this.burst = 0; this.leapTarget = tgt.x; this.vx = 0; this.fistBack = false;
    if (sp) this.wuses--;
  }
  // ツギラの口レーザー: 目を見開いて口を開く（予兆）→ 前へまっすぐ。1発で同じ相手には1回だけ当たる
  beginLaser(tgt) {
    this.newAttack(); this.face = sign(tgt.x - this.x) || this.face;
    this.setState('laser', 'tsugira_laser'); this.laserLen = 0; this.laserHit = new Set();
    W().rangedLock = T.enemyCommon.rangedGapMs;
  }
  updateLaser(dt) {
    const w = W(), TS = T.enemies.tsugira;
    this.flash = this.st < TS.laserWarnMs ? ((this.st / 70) | 0) % 2 : 0;
    // 2026-10-11 v043 口レーザーの本体: 予兆で目と口を開いて（0→1→2）、撃つ間は3→4
    this.anim.i = this.st < TS.laserWarnMs ? Math.min(2, Math.floor(this.st / Math.max(1, TS.laserWarnMs / 3))) : this.st < TS.laserWarnMs + TS.laserFireMs * 0.55 ? 3 : 4;
    if (this.st < TS.laserWarnMs) return;
    if (!this.laserSE) { this.laserSE = true; M.Audio.play('laser'); }   // 2026-10-11 汎用レーザー音（SE_LAZERBERAM）
    const t = this.st - TS.laserWarnMs;
    // 口から前へ伸びる（敵・画面端で止まる）
    const mx = this.x + this.face * TS.mouth[0], mz = TS.mouth[1];
    const reach = Math.min(TS.laserMaxLen, t / 1000 * TS.laserSpeed);
    let len = reach;
    for (const tg of [w.mika, w.robot]) {
      if (!tg || !tg.canBeHit || !tg.canBeHit()) continue;
      const d = (tg.x - mx) * this.face;
      if (d > 0 && d <= reach && Math.abs(tg.y - this.y) <= 6 && tg.z < mz + 6) {
        len = Math.min(len, d);
        if (!this.laserHit.has(tg)) {
          this.laserHit.add(tg);
          const att = { hits: new Set(), x: this.x, freeze: 0, kind: 'laser' };
          M.applyAttack(att, { x0: tg.x - 3, x1: tg.x + 3, y: tg.y, depth: 2, z0: mz - 2, z1: mz + 2 }, [tg], { dmg: this.atk, type: 'light', dir: this.face, strike: false, ranged: true });
        }
      }
    }
    const edge = this.face > 0 ? w.camX + M.W - mx : mx - w.camX;
    this.laserLen = Math.max(0, Math.min(len, edge));
    if (t > TS.laserFireMs) { this.laserSE = false; this.laserLen = 0; this.setState('idle', this.fam.idle, { loop: true }); this.cool = rand(...TS.laserCoolMs) * this.coolMul; }
  }
  beginShoot(tgt) {
    this.newAttack(); this.face = sign(tgt.x - this.x) || this.face;
    this.curAtt = { anim: this.fam.shoot, fire: [2], kind: 'palm' };
    this.setState('attack', this.fam.shoot); this.fired = {};
    W().rangedLock = T.enemyCommon.rangedGapMs;
  }
  beginCharge(tgt) {
    this.newAttack(); this.face = sign(tgt.x - this.x) || this.face;
    this.setState('charge', this.fam.charge); this.chargePhase = 'warn'; this.chargeDist = 0;
    this.anim.i = 0;
  }
  updateCharge(dt, s) {
    const a = this.anim, w = W();
    if (this.chargePhase === 'warn') {   // 予兆: 構えて点滅（約0.5秒）
      a.i = 0; this.flash = ((this.st / 70) | 0) % 2;
      if (this.st >= T.enemies.gigas.chargeWarnMs) { this.chargePhase = 'run'; this.st = 0; this.flash = 0; }
      return;
    }
    if (this.chargePhase === 'run') {
      a.i = 1 + (((this.st / 90) | 0) % 3);
      const d = T.enemies.gigas.chargeSpeed * s; this.x += this.face * d; this.chargeDist += d;
      const box = this.attackBox({ reach: [-10, 40], band: [0, 80], depth: 10 });
      M.applyAttack(this, box, [w.mika, w.robot], { dmg: this.atk, type: 'launch', dir: this.face, strike: true });
      if (this.chargeDist > T.enemies.gigas.chargeDist || this.x < w.camX + 10 || this.x > w.camX + M.W - 10) { this.chargePhase = 'recover'; this.st = 0; }
      return;
    }
    a.i = this.st < 250 ? 4 : 5;
    if (this.st >= T.enemies.gigas.chargeRecoverMs) { this.setState('idle', this.fam.idle, { loop: true }); this.cool = rand(1200, 2000) * this.coolMul; }
  }
  updateAttack(dt, s) {
    const a = this.anim, ca = this.curAtt || {}, w = W();
    // 炎・拳は撃っている間・戻るまで同じコマで止める
    if (ca.hold !== undefined && a.i === ca.hold && ((ca.kind === 'flame' && this.flameT > 0) || (ca.kind === 'fist' && !this.fistBack))) {
      if (ca.kind === 'flame') { this.flameT -= dt; if (this.flameT <= 0 && this.flameHold) { this.flameHold.on = false; this.flameHold = null; } }
      a.t = 0;
    } else a.update(dt);
    if (this.def.family === 'deathhound') {
      if (a.i >= 1 && a.i <= 3) {
        if (!this.leaping) { this.leaping = true; this.vx = this.face * 330; this.vz = 150; }
        this.physicsAir(dt, 900);
      } else if (this.leaping && a.i >= 4) { this.leaping = false; this.z = 0; this.vx = 0; }
    }
    // 近接の攻撃判定
    if (ca.active && ca.active.includes(a.i)) {
      const mv = { reach: ca.reach, band: ca.band, depth: this.cfg.attackDepth + 2 };
      const dmg = ca.weapon ? M.ENEMY_WEAPON[ca.weapon].dmg : this.atk;
      M.applyAttack(this, this.attackBox(mv), [w.mika, w.robot].filter(Boolean),
        { dmg, type: (['battle_hammer', 'war_axe'].includes(ca.weapon) || this.fam.heavy) ? 'launch' : 'light', dir: this.face, strike: true, weapon: ca.weapon });
      if ((ca.weapon === 'battle_hammer' || ca.weapon === 'war_axe') && !this.fired.fx) {
        this.fired.fx = true; w.shake = Math.max(w.shake, 1);
        w.effects.push(new M.Effect({ x: this.x + this.face * 40, y: this.y + 0.4, z: 0, anim: new M.Anim('hammer_impact'), life: 400, flip: this.face < 0 }));
      }
    }
    // 発射
    if (ca.fire && ca.fire.includes(a.i) && !this.fired[a.i]) {
      this.fired[a.i] = true;
      this.fireWeapon(ca);
    }
    if (a.done) {
      if (ca.burst && this.burst < ca.burst) { a.i = ca.fire[0]; a.done = false; a.t = 0; this.fired = {}; return; }
      this.leaping = false; this.z = 0;
      if (this.flameHold) { this.flameHold.on = false; this.flameHold = null; }
      this.setState('idle', this.fam.idle, { loop: true });
      this.cool = (rand(...T.enemyCommon.aggroDelayMs) + (ca.kind ? 900 : 300)) * this.coolMul;
      if (ca.weapon && this.wuses <= 0 && !this.dropWeapon) { this.weapon = null; this.wkind = null; this.wspec = null; }
      else if (ca.weapon && this.wuses <= 0) { this.wkind = null; this.wspec = null; }   // 撃ち尽くしたら素手。落とす指定があれば死亡時に落とす
    }
  }
  fireWeapon(ca) {
    const w = W(), mz = M.muzzleOf(ca.anim, this.anim.i, ca.kind === 'bow' ? 'projectile_spawn' : ca.kind === 'fist' ? 'socket_point' : 'muzzle_points');
    const x = this.x + this.face * mz[0], z = Math.max(8, mz[1]);
    const ED = M.ENEMY_WEAPON[ca.weapon] || {};
    switch (ca.kind) {
    case 'gun':
      this.burst++;
      w.projectiles.push(new M.Shot({ team: 'enemy', src: this, kind: 'bullet', x, y: this.y, z, vx: this.face * 260, dmg: ED.dmg || 2, anim: 'mg_bullet', range: 300, weapon: 'machinegun' }));
      w.effects.push(new M.Effect({ x, y: this.y + 0.3, z, anim: new M.Anim('muzzle_flash'), life: 60, flip: this.face < 0 }));
      M.Audio.play('gun');
      break;
    case 'rocket':
      w.projectiles.push(new M.Shot({ team: 'enemy', src: this, kind: 'rocket', x, y: this.y, z, vx: this.face * 190, dmg: ED.dmg, anim: 'rocket_projectile', w: 8, h: 6, range: 330, weapon: 'rocket_launcher' }));
      M.Audio.play('missile');
      break;
    case 'bow':
      w.projectiles.push(new M.Shot({ team: 'enemy', src: this, kind: 'arrow', x, y: this.y, z, vx: this.face * 250, dmg: ED.dmg, anim: 'yoichi_arrow', w: 10, h: 4, pierce: true, range: 340, weapon: 'yoichi_bow' }));
      M.Audio.play('throw');
      break;
    case 'flame':
      this.flameT = 900; this.flameHold = new M.FlameStream(this, 'enemy', mz, ED.dmg || 1);
      w.effects.push(this.flameHold);
      break;
    case 'fist':
      w.projectiles.push(new M.Shot({ team: 'enemy', src: this, kind: 'fist', owner: this, x, y: this.y, z, vx: this.face * 1, dmg: ED.dmg, anim: 'rocket_punch_projectile' }));
      break;
    case 'beam':
      w.effects.push(new M.Beam(this, 'enemy', mz, ED.dmg));
      break;
    case 'palm': {   // メガメガの掌: 発射コマに入った時に一度だけ1発（足元から[-44,-41]）
      const R = M.REF.mechRules.megamega_shoot.muzzle_offset_from_ground_proposal;
      w.projectiles.push(new M.Shot({ team: 'enemy', src: this, kind: 'bullet', x: this.x + this.face * -R[0], y: this.y, z: -R[1], vx: this.face * 230, dmg: this.atk, anim: 'mg_bullet', range: 300, w: 5, h: 5 }));
      M.Audio.play('gun');
      break;
    }
    }
  }
  draw() {
    if (this.alpha > 0) this.drawShadow();
    const fam = this.fam;
    let anim = this.anim.name, idx = this.anim.i;
    if (this.state === 'grabbed') { anim = this.hurtFlash > 0 && fam.hurtPop ? fam.hurtPop : fam.grabbed; idx = fam.grabbedIdx || 0; }
    if (this.state === 'thrown') { anim = fam.air; idx = fam.airSeq ? this.anim.i : fam.airIdx || 0; }
    // 武器を持っている時の待機は武器の構え（1コマ目）
    if (this.wspec && this.wuses > 0 && ['idle', 'hover'].includes(this.state) && M.ANIMS[this.wspec.anim]) { anim = this.wspec.anim; idx = 0; }
    // 2026-10-09 ユーザー指定: 武器を持ったまま歩く。武器を持った歩きの素材はないので、腰から下＝素手の歩き、腰から上＝武器の構え（1コマ目）を重ねる
    const wa = this.wspec && this.wuses > 0 && fam.armCut && anim === fam.walk && M.ANIMS[this.wspec.anim] && this.wspec.anim.startsWith(fam.walk.replace(/_walk$/, '')) ? this.wspec.anim : null;
    // カオーンの突進の残像（直前の姿勢を薄く2つ）
    if (this.trail && this.state === 'charge') this.trail.forEach((tx, k) => M.drawAnim(anim, idx, tx - W().camX, this.y - this.z, this.face > 0, this.alpha * (k ? 0.18 : 0.32), this.variant));
    if (this.flash) { M.ctx.save(); M.ctx.filter = 'brightness(1.8)'; }
    if (wa) {
      const ctx = M.ctx, sx = this.x - W().camX, sy = Math.round(this.y - this.z), cut = fam.armCut;
      ctx.save(); ctx.beginPath(); ctx.rect(sx - 160, sy - cut, 320, cut + 16); ctx.clip(); this.drawSprite(anim, idx); ctx.restore();
      ctx.save(); ctx.beginPath(); ctx.rect(sx - 160, sy - 260, 320, 260 - cut); ctx.clip(); this.drawSprite(wa, 0); ctx.restore();
    } else if (!(fam.spin && this.drawSpin())) this.drawSprite(anim, idx);
    if (this.flash) M.ctx.restore();
    // ツギラの口レーザー（96×10 の絵を口から前へ繰り返し）
    if (this.state === 'laser' && this.laserLen > 0) {
      const TS = T.enemies.tsugira, MD = TS.mouthDraw || TS.mouth, sx = Math.round(this.x - W().camX + this.face * MD[0]), sy = Math.round(this.y - this.z - MD[1]);   // 絵の口の位置から（当たりの高さは mouth のまま）
      const n = Math.ceil(this.laserLen / 96);
      M.ctx.save(); M.ctx.beginPath();
      M.ctx.rect(this.face > 0 ? sx : sx - this.laserLen, sy - 6, this.laserLen, 12); M.ctx.clip();
      for (let k = 0; k < n; k++) M.drawFrame('tsugira_laser', this.face > 0 ? sx + k * 96 : sx - (k + 1) * 96, sy - 5, [0, 0], false);
      M.ctx.restore();
    }
  }
}
M.Enemy = Enemy;
})();
