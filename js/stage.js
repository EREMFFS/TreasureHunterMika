// stage.js — マップ・区間進行・敵の出現・TIME・HUD・登場/クリア演出・マップ移動（1〜3面）
'use strict';
(function () {
const M = window.MIKA, T = M.TUNING, REF = M.REF, I = M.Input;
const MAPS = REF.stageMaps.maps;
const { clamp, rand, sign } = M;
// 2026-10-12 v106 物を壊した音（材質ごと）。載っていない物は break（その他）
const BREAK_SE = { chest: 'chest_open', barricade: 'break_wood', st4_bench: 'break_wood', st4b_bench: 'break_wood',
  vending_blue: 'break_metal2', vending_red: 'break_metal2', st4_vending: 'break_metal2', st5c_vending: 'break_metal2', st5e_vending: 'break_metal2',
  fallen_sign: 'break_metal', s2_cabinet: 'break_metal', s2_terminal: 'break_metal', hatch: 'break_metal' };
function breakSE(p) { return BREAK_SE[p.kind === 'state_prop' ? p.art : p.kind] || 'break'; }
const GO_SYNC = { period: 560, on: 300, count: 3 };   // 2026-10-12 v103 SE_GO の3回の鳴りに合わせた GO の点滅
const OVER_SE_MS = 700;   // 2026-10-12 v101 GAME OVER の音はミカの断末魔の後に（鳴り終わってから暗転してやり直し）
const LANE = { upper: 0.15, middle: 0.5, lower: 0.85 };
// 2026-10-11 進入禁止のポール＋ロープ（MIKA_NO_ENTRY_PARTS_v042）。行けない奥の床との境界に並べる見た目だけのパーツ（当たり判定なし）
M.BG.barrier_pole = { file: 'assets/bg_barrier_pole.webp', size: [18, 42] };
M.BG.barrier_rope = { file: 'assets/bg_barrier_rope.webp', size: [96, 20] };

// 地名のタイプライター表示（MIKA_MAP_NAMES v001 の map_title.js を移植）。黒い帯なし、縁と影つき
class MapTitle {
  constructor(name, extraDelay = 0) {
    const c = M.REF.mapNames.intro;
    this.s = { delay: c.delay_ms + extraDelay, step: c.per_character_ms, hold: c.hold_ms, fade: c.fade_ms, x: c.position_proposal.x, y: c.position_proposal.baseline_y };
    this.chars = Array.from(name || ''); this.t = 0; this.active = this.chars.length > 0;
  }
  update(dt) {
    if (!this.active) return;
    this.t += dt;
    const s = this.s;
    // 2026-10-10 タイプライター音: 1文字出るごとに 01・02 を交互に（空白は鳴らさない）
    const n = Math.max(0, Math.min(this.chars.length, Math.floor((this.t - s.delay) / s.step)));
    while ((this.shown || 0) < n) {
      const ch = this.chars[this.shown || 0]; this.shown = (this.shown || 0) + 1;
      if (ch.trim() && ch !== '　') { this.tick = (this.tick || 0) + 1; M.Audio.play(this.tick % 2 ? 'map_msg01' : 'map_msg02'); }
    }
    if (this.t >= s.delay + this.chars.length * s.step + s.hold + s.fade) this.active = false;
  }
  draw() {
    if (!this.active) return;
    const s = this.s, n = Math.max(0, Math.min(this.chars.length, Math.floor((this.t - s.delay) / s.step)));
    if (!n) return;
    const fadeStart = s.delay + this.chars.length * s.step + s.hold;
    const a = this.t <= fadeStart ? 1 : Math.max(0, 1 - (this.t - fadeStart) / s.fade);
    M.ctx.globalAlpha = a;
    M.jpText(this.chars.slice(0, n).join(''), s.x, s.y, { color: '#fff5c5', edge: '#101729' });
    M.ctx.globalAlpha = 1;
  }
}

// ステージを通した状態（区間クリア・残りTIME・壊した物・開けた宝箱・使った隠し入口・武器源）
M.newRun = function (stage, score) {
  return { stage, score, sectionTimes: {}, mapTime: {}, mapFinal: {}, cleared: {}, timeLeft: {}, broken: {}, portalsUsed: {}, fixedDone: {}, cyl: {},
    weaponPlaced: {}, visited: {}, mika: null, robot: null, lastName: null, parents: {} };
};

// 進行状態の写し（隠し部屋の親ワールドとやり直し地点そのものは含めない）
function snapRun(run) {
  return JSON.parse(JSON.stringify(run, (k, v) => (k === 'parents' || k === 'checkpoint' ? undefined : v)));
}
// ゲームオーバー → そのエリア（入った時の状態）からやり直し。エリア内で稼いだ点数は消え、やり直すたびに +1 点（コンティニューの記録）
M.restartArea = function (w) {
  const cp = w.run.checkpoint;
  if (!cp) return M.setScene(new M.Title());
  cp.deaths++;
  const run = JSON.parse(JSON.stringify(cp.snap));
  run.parents = {}; run.checkpoint = cp;
  run.score = cp.snap.score + cp.deaths;
  run.continues = (w.run.continues || 0) + 1;
  run.mika = { hp: T.mika.maxHp, weapon: run.mika && run.mika.weapon ? run.mika.weapon : null };   // ミカは満タン（武器は入った時のもの）
  run.robot = null;                                                                                // ロボも直った状態
  M.run = run;
  M.setScene(new World(cp.mapId, { run, entry: cp.entry, onDone: w.onDone, onGameOver: w.onGameOver }));
};
class World {
  constructor(mapId, opts = {}) {
    M.world = this;
    this.mapId = mapId;
    this.map = MAPS[mapId];
    this.run = opts.run || M.run;
    this.stage = this.map.stage;
    this.PL = M.PLACEMENTS[this.stage] || { sections: [], waves: [], fixed_enemies: [] };
    this.kind = this.map.kind;
    this.walkY = this.map.walk;
    this.width = this.map.width;
    this.camX = 0; this.shake = 0; this.timeScale = 1;
    this.enemies = []; this.props = []; this.items = []; this.projectiles = []; this.effects = []; this.debugBoxes = [];
    this.lockInput = true;
    this.fxTime = 0; this.rangedLock = 0;
    this.onDone = opts.onDone || (() => {});
    this.onGameOver = opts.onGameOver || (() => {});
    this.fade = { a: 1, dir: -1 };
    this.lastTarget = null; this.lastTargetT = 0; this.lastTargetR = null; this.lastTargetRT = 0;
    // TIME はマップ（1A・1B…、3Aの森は3段まとめて）ごと。2026-10-08 ユーザー指定: 基本は切れず、残りがタイムアタックの点数になる
    let tg = mapId; while (MAPS[tg] && MAPS[tg].parent) tg = MAPS[tg].parent;   // 隠し部屋（奥の部屋も）は本線マップのTIMEを表示
    this.tgroup = this.map.tgroup || (/^3F/.test(tg) ? '3A' : tg);   // 2026-10-11 6面: 6B〜6Fは1つの制限時間（map.tgroup）
    this.time = this.run.mapTime[this.tgroup] != null ? this.run.mapTime[this.tgroup] : (this.map.time_initial || T.mapTime.initial);
    this.timeAcc = 0; this.timerRunning = false;
    // ゲームオーバー時のやり直し地点: 本線のエリア（1A・1B…／3Aの森は3段まとめて）に入った時の状態を丸ごと覚える
    if (this.kind === 'main' && (!this.run.checkpoint || this.run.checkpoint.tgroup !== this.tgroup)) {
      this.run.checkpoint = { tgroup: this.tgroup, mapId, entry: opts.entry === 'stage_start' ? 'stage_start' : 'map', deaths: 0, snap: snapRun(this.run) };
    }
    this.sections = this.PL.sections.filter((s) => s.map === mapId);
    this.secIdx = -1;
    this.queue = [];
    this.bosses = [];
    // 地名: 主マップへ入った時だけ（隠し部屋・戻り・同じ名前の森の移動では出さない）
    const nm = this.map.name;
    this.mapTitle = new MapTitle(this.kind !== 'room' && nm && nm !== this.run.lastName ? nm : '', this.map.arrival_se && this.entry === 'map' ? 900 : 0);   // エレベーターの停止音の後に地名
    if (this.kind !== 'room' && nm) this.run.lastName = nm;

    // 小物と宝箱（壊した物・開けた宝箱は戻っても復活しない）
    this.stateKey = this.map.state_key || mapId;   // 2026-10-11 v051: 6Bは5Iの逆走。壊した物・開けた宝箱は5Iと共通
    for (const o of this.map.props) {
      if (this.run.broken[this.propKey(o)] && o.kind !== 'state_prop') continue;
      const p = new M.Prop(o);
      if (this.run.broken[this.propKey(o)]) { p.broken = true; p.t = 9999; }
      this.props.push(p);
    }
    const sp = this.map.specials || {};
    if (sp.hatch) { const h = new M.Prop({ id: sp.hatch.id, kind: 'hatch', x: sp.hatch.x, y: sp.hatch.y, origin: sp.hatch.origin, footprint: [40, 10], hp: 1 }); h.hitY = 160; if (this.run.broken[mapId + ':' + h.id]) h.broken = true; this.props.push(h); }
    if (sp.cylinders) for (const c of sp.cylinders) {
      const p = new M.Prop({ id: c.id, kind: 'cylinder', x: c.world[0], y: c.world[1], origin: c.origin, footprint: [44, 10], hp: 99, spec: c });
      p.cstate = (this.run.cyl[c.id] || {}).state || 'intact'; p.hitY = c.world[1];
      p.canBeHit = () => p.cstate === 'intact' || p.cstate === 'warning';
      p.takeHit = (att) => { if (p.cstate === 'intact' || p.cstate === 'warning') { p.cstate = 'breaking'; p.age = 0; M.spark(p.x, p.y, 40); M.Audio.play('glass'); att.freeze = Math.max(att.freeze || 0, 50); } return true; };
      this.props.push(p);
    }
    // B_H1 の右壁（叩くと開く）
    for (const p of this.props) if (p.kind === 'secret_wall') { p.hitY = this.walkY[0] + 2; p.fp = [40, 10]; }
    this.roomOpen = this.run.broken[mapId + ':opened'] || false;

    // ミカとロボ
    const start = opts.arrive || this.map.start;
    this.mika = new M.Mika(start[0], start[1]);
    this.robot = new M.Robot(start[0] - 50, clamp(start[1] + T.robot.followOffsetY, this.walkY[0], this.walkY[1]));
    this.applyCarry();
    this.entry = opts.entry || 'map';
    this.arriveScene = opts.arriveScene;

    if (this.kind === 'elevator') this.elev = new M.Elevator(this);
    // 開始区間（3Aの小道で途中の画面へ着いた時はその画面から）
    let first = 0;
    if (opts.startSection) first = Math.max(0, this.sections.findIndex((s) => s.section_id === opts.startSection));
    else if (opts.arriveScene) first = Math.max(0, this.sections.findIndex((s) => s.kind !== 'travel' && s.screen === opts.arriveScene));
    if (this.sections.length) {
      this.camX = this.kind === 'elevator' ? 0 : this.stopX(this.sections[first]);
    }
    if (this.kind === 'room') this.camX = 0;
    if (this.kind === 'room' && this.map.specials && this.map.specials.encounter) this.encounter = { spec: this.map.specials.encounter, t: 0, n: 0, cool: 0 };
    this.rtl = this.map.travel === 'right_to_left';   // 2026-10-10 5H: 右から入って左へ進む
    const hook0 = M.mapHooks && M.mapHooks[this.map.fx];
    if (hook0 && hook0.init) hook0.init(this);
    if (this.entry === 'map' || this.entry === 'stage_start') {
      // 画面左から歩いて登場（FF2風）
      this.mika.x = this.rtl ? this.camX + M.W - T.mika.entranceFromX : this.camX + T.mika.entranceFromX; this.robot.x = this.mika.x + (this.rtl ? 50 : -50);
      this.entranceTo = this.camX + (this.map.start[0] || T.mika.entranceToX);
      this.mika.y = this.map.start[1];
    } else {
      // 小道・隠し部屋から: その場に現れる
      this.mika.x = start[0]; this.mika.y = clamp(start[1], this.walkY[0], this.walkY[1]); this.mika.setState('idle', 'idle');
      this.robot.x = clamp(start[0] - 44, this.camX + 16, this.camX + M.W - 16); this.robot.setState('idle', 'robot_idle', { loop: true });
      this.mika.invuln = 600;
      this.lockInput = false;
    }
    // 2026-10-11 v048: 4Aの屋根から飛び込んで来た時は歩いて登場せず、天井（画面の上）から短く降りて着地する（js/stage4.js の 4B フック）
    if (opts.roofDrop) {
      const m = this.mika, r = this.robot;
      m.x = this.camX + this.map.start[0]; m.y = this.map.start[1]; m.face = 1; m.z = 150; m.setState('scripted', 'jump');
      r.x = m.x - 44; r.y = clamp(m.y + T.robot.followOffsetY, this.walkY[0], this.walkY[1]); r.face = 1; r.z = 150; r.setState('scripted', 'robot_move', { loop: true });
      this.roofDrop = { t: 0 }; this.cutscene = true; this.lockInput = true;
      this.fade = { a: 1, dir: -1, ms: 220 };
    }
    if (this.sections.length) this.beginSection(first, this.entry === 'map' || this.entry === 'stage_start');
    if (this.entry !== 'map' && this.entry !== 'stage_start') this.timerRunning = !!this.sec && !this.secCleared;

    // 到着の音（4C: 電車が駅に停止）
    if (this.map.arrival_se_on_start && this.entry === 'stage_start') M.Audio.play(this.map.arrival_se_on_start);
    if (this.map.arrival_se && this.entry === 'map') M.Audio.play(this.map.arrival_se);   // 5面: エレベーターで着いた階   // 4Cから始めた時だけ（4Bからは到着演出がある）
    // BGM（隠し部屋は親マップの曲を続ける）
    M.Audio.bgmLevel(1);   // 2026-10-12 v132 念のため: 前のマップでBGMを下げたまま（4Bのアナウンス・6面の放送・エレベーターなど）でも、新しいマップでは必ず元の音量に
    const song = this.map.music;
    if (song) {
      if (opts.firstEntry) M.Audio.playMusic('game_start', { loop: false, onEnd: () => { if (M.world && M.world.map.music === song && !M.world.bossIntro && !M.world.clearSeq) M.Audio.playMusic(song); } });
      else if (!(M.Audio.musicPlaying('game_start') && song === 'stage1')) M.Audio.playMusic(song);
    }
    this.song = song;
    this.fairies = [];
  }
  // 壊した物・開けた宝箱の記録の鍵。6Bは5Iと共通（state_key）だが、2026-10-12 v120 ユーザー指定で6面の宝箱は5面とは別（全部復活）
  propKey(o) { return (this.stage === 6 && o.kind === 'chest' ? 'esc6:' + this.mapId : this.stateKey) + ':' + o.id; }
  // ステージ内で持ち越す: HP・武器・ロボの状態（武器はマップ移動で捨てる＝weapon_balance.json）
  applyCarry() {
    const c = this.run.mika, r = this.run.robot;
    if (c) { this.mika.hp = c.hp; this.mika.weapon = c.weapon ? Object.assign({}, c.weapon) : null; }
    if (r) { this.robot.hp = r.hp; if (r.broken) { this.robot.setState('broken', 'robot_broken', { hold: true }); this.robot.killsSinceBroken = r.kills || 0; this.robot.repairT = r.repairT || 0; } }
  }
  saveCarry(keepWeapon) {
    this.run.mika = { hp: this.mika.hp, weapon: keepWeapon && this.mika.weapon ? Object.assign({}, this.mika.weapon) : null };
    this.run.robot = { hp: this.robot.hp, broken: this.robot.state === 'broken', kills: this.robot.killsSinceBroken, repairT: this.robot.repairT || 0 };
  }

  // ---------------------------------------------------------------- 区間
  stopX(sec) { return sec && sec.screen ? (sec.screen - 1) * M.W : 0; }
  reachedStop() { return this.rtl ? this.camX <= this.nextStop : this.camX >= this.nextStop; }
  get sec() { return this.sections[this.secIdx]; }
  get secCleared() { return this.sec && this.run.cleared[this.sec.section_id]; }

  beginSection(i, atStart) {
    const sec = this.sections[i];
    this.killedHere = false;   // ロボの「全滅」の声は、この区間で倒した時だけ
    this.secIdx = i;
    const done = this.run.cleared[sec.section_id];
    this.queue = [];
    const nextSec = this.sections[i + 1];
    const toBoss = sec.kind === 'travel' && nextSec && nextSec.kind === 'boss';   // 2026-10-09 ユーザー指定: ボス部屋への移動中は雑魚を出さない
    if (!done && sec.kind !== 'boss' && !toBoss) {
      this.queue = this.PL.waves.filter((w) => w.section_id === sec.section_id).sort((a, b) => a.order - b.order)
        .flatMap((w) => Array.from({ length: w.quantity == null ? 1 : w.quantity }, () => Object.assign({}, w)));
      this.trimQueue();
      this.applyWeaponSources(sec);
      // 移動区間には武器を持って落とす雑魚を1体（すでにいれば足さない）
      if (sec.kind === 'travel' && T.weaponSupply.travelArmed && this.queue.length && !this.queue.some((r) => r.drop_weapon && r.weapon_id && r.weapon_id !== 'none')) {
        this.armRow(this.queue[0]);
      }
      for (const r of this.queue) this.armOrNot(r);
      this.extraArm(sec);
    }
    this.queueTotal = this.queue.length;
    this.spawned = 0;
    this.maxAlive = sec.wave_max_alive != null ? sec.wave_max_alive : this.PL.defaults.wave_max_alive;
    this.spawnCool = 400; this.lastGroup = 0;
    this.timerRunning = !atStart && !done;
    this.travelStartCam = this.camX;
    this.go = null;
    this.waveOpen = done || sec.wave_start !== 'after_fixed_defeated';
    if (sec.kind === 'travel') this.nextStop = this.stopX(this.sections[i + 1] || sec);
    if (!done) this.placeFixed(sec);
    for (const e of this.enemies) if (e.fixed && e.sectionId === sec.section_id) e.dormant = false;
    if (this.elev) this.elev.onBeginSection(sec);
    if (sec.kind === 'boss' && !done) this.beginBoss(sec);
  }
  // 2026-10-09 ユーザー指定: 1画面の雑魚の数を約2/3に。武器を持つ・武器源の行は残し、それ以外を均等に間引く
  trimQueue() {
    const k = T.stage.enemyCountRate == null ? 1 : T.stage.enemyCountRate, q = this.queue, n = q.length;
    const minN = (T.stage.minEnemiesByStage || {})[this.stage] || 1;
    // 2026-10-10 ユーザー指定: 2面以降は1区間に最低2体（1体しか出ない所をなくす）。配置表が1体なら同じ敵をもう1体（武器なし）
    if (n > 0 && n < minN) { while (q.length < minN) q.push(Object.assign({}, q.find((r) => !r.weapon_source && !(r.weapon_id && r.weapon_id !== 'none')) || q[0], { weapon_id: 'none', drop_weapon: false, weapon_source: null, order: q.length + 1 })); return; }
    const keep = Math.max(1, minN, Math.round(n * k));
    if (keep >= n) return;
    const must = (r) => r.weapon_source || (r.drop_weapon && r.weapon_id && r.weapon_id !== 'none');
    let drop = n - keep;
    const cand = q.map((r, i) => i).filter((i) => !must(q[i]));
    const out = new Set();
    for (let j = 0; j < drop && cand.length; j++) out.add(cand[Math.min(cand.length - 1, Math.floor((j + 0.5) * cand.length / drop))]);
    this.queue = q.filter((r, i) => !out.has(i));
  }
  // 2026-10-09 ユーザー指定: 武器の出現を約半分に（倒した雑魚が武器を落とす確率）。素手の時の救済と武器源は別で必ず落とす
  // 武器持ちの行: 面ごとの割合で武器を持たせる。持たせたら倒した時に必ず落とす（武器源は必ず持つ）
  armOrNot(r) {
    if (!r.weapon_id || r.weapon_id === 'none') return r;
    const S = T.weaponSupply, k = S.armedRateByStage && S.armedRateByStage[this.stage] != null ? S.armedRateByStage[this.stage] : 1;
    if (!r.weapon_source && Math.random() >= k) { r.weapon_id = 'none'; r.drop_weapon = false; } else r.drop_weapon = true;
    return r;
  }
  // 武器源: 指定した敵だけが落とす。3Aは小道で飛ばされても、最初に入った候補区間で一度だけ補完
  applyWeaponSources(sec) {
    const run = this.run;
    for (const src of this.PL.weapon_sources || []) {
      if (!src.fallback_sections) continue;
      const rows = this.queue.filter((r) => r.weapon_source === src.id);
      if (run.weaponPlaced[src.id]) { for (const r of rows) { r.weapon_id = 'none'; r.drop_weapon = false; } continue; }
      if (!src.fallback_sections.includes(sec.section_id)) continue;
      if (!rows.length) {
        const r = this.queue.find((q) => ['goblin', 'hobgoblin', 'death_goblin'].includes(q.enemy_id) && (!q.weapon_id || q.weapon_id === 'none'));
        if (!r) continue;
        r.weapon_id = src.weapon; r.drop_weapon = true; r.weapon_source = src.id;
      }
      run.weaponPlaced[src.id] = sec.section_id;
    }
  }

  // 固定敵: アンカー物体＋陣形から配置（座標が空欄のときの自動配置案）
  placeFixed(sec) {
    const rows = (this.PL.fixed_enemies || []).filter((f) => f.section_id === sec.section_id && f.formation !== 'cylinder');
    if (!rows.length || this.run.fixedDone[sec.section_id]) return;
    if (this.enemies.some((e) => e.fixed && e.sectionId === sec.section_id)) return;
    this.run.fixedDone[sec.section_id] = true;
    rows.forEach((f, k) => {
      const ids = String(f.anchor_id || '').split('+');
      const anchors = this.map.props.filter((o) => ids.includes(o.id));
      const ax = anchors.length ? anchors.reduce((a, o) => a + o.x, 0) / anchors.length : this.stopX(sec) + 280;
      const ay = anchors.length ? anchors.reduce((a, o) => a + o.y, 0) / anchors.length : (this.walkY[0] + this.walkY[1]) / 2;
      const [w0, w1] = this.walkY, slot = (f.slot || k + 1) - 1;
      let x = f.x, y = f.y;
      if (x == null || y == null) {
        if (f.formation === 'around_chest_group') { const o = [[-34, -10], [34, -10], [-30, 12], [30, 12]][slot % 4]; x = ax + o[0]; y = ay + o[1]; }
        else if (f.formation === 'vertical_line_behind_barricade') { x = ax + 36; y = w0 + 6 + (w1 - w0 - 12) * (slot / 2); }
        else { x = ax + 30 + (slot % 2) * 16; y = w0 + 6 + (w1 - w0 - 12) * (slot / 3); }
      }
      y = clamp(y, w0, w1);
      const def = M.MON[f.enemy_id] || M.MON.goblin;
      const e = new M.Enemy(def, x, y, { slot: slot + 10, fixed: true, weapon: f.weapon_id, appearance: f.appearance, hold: f.formation === 'vertical_line_behind_barricade' });
      e.sectionId = sec.section_id; e.dropWeapon = !!(f.weapon_id && f.weapon_id !== 'none');   // 武器を持った敵は必ず落とす
      e.dormant = this.sec.section_id !== sec.section_id;
      e.face = -1;
      this.enemies.push(e);
    });
  }

  // 2026-10-12 v110 面ごとの武器の追加（tuning weaponSupply.extraArmed）。すでに武器持ちがいる区間には足さない
  extraArm(sec) {
    const X = (T.weaponSupply.extraArmed || {})[this.stage];
    if (!X || !X.kinds.includes(sec.kind) || Math.random() >= X.chance) return;
    if (this.queue.some((r) => r.weapon_id && r.weapon_id !== 'none')) return;
    const goblins = this.queue.filter((r) => ['goblin', 'hobgoblin', 'death_goblin', 'mega_goblin'].includes(r.enemy_id));
    const row = goblins[Math.floor(Math.random() * goblins.length)];
    if (!row) return;
    row.weapon_id = X.pool[Math.floor(Math.random() * X.pool.length)]; row.drop_weapon = true;
  }
  // 補給役にする: 武器を持たせて、倒したら落とす（2面などはメガゴブリン）
  armRow(row) {
    const S = T.weaponSupply, pool = S.pools[this.stage] || S.pools[1];
    row.weapon_id = pool[Math.floor(Math.random() * pool.length)];
    row.drop_weapon = true; row.supply = true;
    if (S.megaStages.includes(this.stage)) row.enemy_id = 'mega_goblin';
    else if (!['goblin', 'hobgoblin', 'death_goblin'].includes(row.enemy_id)) row.enemy_id = this.stage >= 3 ? 'hobgoblin' : 'goblin';
    return row;
  }
  weaponAvailable() {
    return this.items.some((it) => !it.remove && it.def.kind === 'weapon') ||
      this.enemies.some((e) => !e.dead && e.state !== 'dying' && e.dropWeapon && e.weapon);
  }
  spawnFromQueue() {
    const row = this.queue.shift();
    // ミカが素手の時は、武器を持った雑魚を出す
    if (T.weaponSupply.unarmedAssist && !this.mika.weapon && !this.weaponAvailable() && !(row.weapon_id && row.weapon_id !== 'none')) this.armRow(row);
    const def = M.MON[row.enemy_id] || M.MON.goblin;
    const [w0, w1] = this.walkY;
    const y = row.feet_y != null ? clamp(row.feet_y, w0, w1) : w0 + (w1 - w0) * (LANE[row.lane] != null ? LANE[row.lane] : Math.random());   // 5A: 足元yの指定
    let e;
    const o = { slot: this.spawned, weapon: row.weapon_id, appearance: row.appearance };
    if (row.spawn_side === 'top') {
      e = new M.Enemy(def, this.camX + rand(70, M.W - 70), y, Object.assign(o, { drop: T.stage.dropZ }));
    } else if (this.elev && this.sec.kind === 'elevator_stop') {
      const d = this.map.specials.elevator.door_spawn[row.spawn_side === 'left' ? 0 : 1];
      e = new M.Enemy(def, d[0], d[1], Object.assign(o, { enterTo: d[0] + (row.spawn_side === 'left' ? 48 : -48), enterY: y }));
    } else {
      const nxt = this.sections[this.secIdx + 1];
      const intoBoss = this.sec.kind === 'travel' && nxt && nxt.kind === 'boss' && this.camX + M.W + 30 > this.stopX(nxt);
      const left = (this.rtl ? row.spawn_side !== 'left' : row.spawn_side === 'left') || intoBoss;   // ボス部屋の中から雑魚を出さない。右から左へ進むマップでは前＝左
      const x = left ? this.camX - 30 : this.camX + M.W + 30;
      const enterTo = row.settle_x != null ? clamp(row.settle_x, this.camX + 20, this.camX + M.W - 20) : left ? this.camX + rand(30, 70) : this.camX + M.W - rand(30, 70);   // 5A: 止まる位置の指定
      e = new M.Enemy(def, x, y, Object.assign(o, { enterTo }));
    }
    e.sectionId = this.sec.section_id; e.dropWeapon = row.drop_weapon;
    this.enemies.push(e);
    this.spawned++;
    return row;
  }

  waveAlive() { return this.enemies.filter((e) => !e.fixed && !e.boss && !e.isAdd && !e.dead && e.state !== 'dying' && e.sectionId === this.sec.section_id).length; }
  fixedAlive(id) {
    const n = this.enemies.filter((e) => e.fixed && !e.dead && e.state !== 'dying' && e.sectionId === id).length;
    const cyl = this.props.filter((p) => p.kind === 'cylinder' && p.spec.section_id === id && p.cstate !== 'spent').length;   // 槽の予約1体も含める
    return n + cyl;
  }
  // 2026-10-12 v119: 壁に鎮座している（まだ目覚めていない）ダンダルモンは数えない。5D は v088 で画面3に移したので、
  //   画面1の雑魚を全滅させても「生きている敵」が1体残り、区間が終わらず画面の端から先へ進めなかった
  hostilesAlive() { return this.enemies.filter((e) => !e.dead && e.state !== 'dying' && !e.friendly && !e.seated).length; }

  updateSection(dt) {
    const sec = this.sec;
    if (!sec || this.clearSeq || this.exiting || this.mapCleared) return;
    if (sec.kind === 'boss') return this.updateBossSection(dt);
    if (!this.waveOpen && this.fixedAlive(sec.section_id) === 0) this.waveOpen = true;
    // 出現: 同じ群れは続けて、次の群れは残りが spawn_when_alive_le 以下になってから。固定＋通常はおおむね6体以内
    if (this.waveOpen && this.queue.length && this.timerRunning && (!this.elev || this.elev.canSpawn())) {
      this.spawnCool -= dt;
      const row = this.queue[0], alive = this.waveAlive();
      const le = row.spawn_when_alive_le != null ? row.spawn_when_alive_le : this.maxAlive - 1;
      const total = this.hostilesAlive();
      const minAlive = (T.stage.minEnemiesByStage || {})[this.stage] || 1;   // 2面以降: 同時に最低2体いるように、次の群れを待たずに出す
      let allow = this.spawnCool <= 0 && alive < this.maxAlive && total < (this.PL.defaults.soft_total_cap_with_fixed || 6) &&
        (row.group === this.lastGroup || alive <= le || alive < minAlive);
      if (sec.kind === 'travel') allow = allow && (Math.abs(this.camX - this.travelStartCam) >= (this.spawned + 1) * T.stage.travelSpawnEveryPx * 0.8 || this.reachedStop() || (this.spawned > 0 && alive < minAlive));
      if (allow) {
        const r = this.spawnFromQueue();
        this.spawnCool = this.queue.length && this.queue[0].group === r.group ? T.stage.groupSpawnGapMs : T.enemyCommon.spawnIntervalMs;
        this.lastGroup = r.group;
      }
    }
    if (sec.kind === 'travel') {
      // カメラは一気に飛ばさず、決まった速さで追いつく（区間が切り替わった瞬間にミカが右寄りにいても滑らかに）
      const nxt = this.sections[this.secIdx + 1], v = T.stage.cameraMaxSpeed * dt / 1000;
      if (this.rtl) {
        const want = this.mika.x - (M.W - T.stage.cameraLead);
        if (want < this.camX) this.camX = Math.max(this.nextStop, this.camX - Math.min(this.camX - want, v));
        if (nxt && this.camX < this.stopX(nxt) + M.W - 40 && !this.run.cleared[nxt.section_id]) this.placeFixed(nxt);
      } else {
        const want = this.mika.x - T.stage.cameraLead;
        if (want > this.camX) this.camX = Math.min(this.nextStop, this.camX + Math.min(want - this.camX, v));
        if (nxt && this.camX + M.W > this.stopX(nxt) + 40 && !this.run.cleared[nxt.section_id]) this.placeFixed(nxt);
      }
    }
    const done = this.waveOpen && this.queue.length === 0 && this.hostilesAlive() === 0 && this.fixedAlive(sec.section_id) === 0 &&
      (sec.kind !== 'travel' || this.reachedStop());
    if (done) this.completeSection();
  }

  completeSection() {
    const sec = this.sec, id = sec.section_id;
    if (!this.run.cleared[id]) {
      this.run.cleared[id] = true;
      if (this.run.sectionTimes[id] === undefined) this.run.sectionTimes[id] = this.time;   // 二重保存しない
    }
    this.run.timeLeft[id] = this.time;
    this.timerRunning = false;
    // 2026-10-11 ロボの声: 移動区間以外（戦う場面・部屋・2Bの停車など）で雑魚を全滅させた時。ボスは別の演出なので除く
    if (sec.kind !== 'travel' && sec.kind !== 'boss' && this.killedHere) { this.killedHere = false; this.roboSay('room', { delay: 500 }); }
    if (this.elev) return this.elev.onSectionDone(sec);
    if (this.secIdx >= this.sections.length - 1) { this.onMapCleared(); return; }
    this.beginSection(this.secIdx + 1, false);
    if (this.sec.kind === 'travel' && !this.secCleared) { this.go = { t: 0, cam: this.camX, snd: true }; M.Audio.play('go'); }
    else if (this.sec.kind === 'travel') this.go = { t: 0, cam: this.camX };
  }
  // マップの最後の区間が終わった: 出口を開ける（GO）
  onMapCleared() {
    if (this.mapCleared) return;   // 一度だけ（毎フレーム GO の音が鳴り続けていた不具合の修正）
    this.mapCleared = true;
    if (this.kind === 'room' && this.killedHere) { this.killedHere = false; this.roboSay('room', { delay: 500 }); }   // 区間のない部屋の全滅
    const ex = this.map.exit;
    if (!ex || !ex.to) return;
    this.finishMapTime();
    // 4B: 全滅したら到着演出（GOは出さない）
    // 5H（仮）: 5Iが未制作のため、全滅でそのまま面クリア
    if (ex.mode === 'stage_clear') return this.startClear(null);
    if (ex.mode === 'arrival') { const h = M.mapHooks && M.mapHooks[this.map.fx]; if (h && h.startArrival) return h.startArrival(this); }
    this.go = { t: 0, cam: this.camX, exit: true, snd: true };
    M.Audio.play('go');
  }

  // ---------------------------------------------------------------- 出口・隠し部屋・小道
  updatePortals() {
    if (this.exiting || this.clearSeq || this.lockInput || this.over) return;
    const m = this.mika;
    if (!['idle', 'walk'].includes(m.state)) return;
    const ex = this.map.exit;
    if (this.mapCleared && ex && ex.to) {
      if ((ex.mode === 'right_edge' || ex.mode === 'right_door') && m.x >= Math.min(ex.x, this.camX + M.W - 14)) return this.leave(ex.to, { walkout: true, direction: 1, walkoutY: ex.y });
      if (ex.mode === 'roof_jump' && m.x >= Math.min(ex.x - 24, this.camX + M.W - 40)) { const h = M.mapHooks && M.mapHooks[this.map.fx]; if (h && h.startRoofJump) return h.startRoofJump(this); }   // 2026-10-11 v048 4A→4B
      if ((ex.mode === 'left_edge' || ex.mode === 'left_door') && m.x <= Math.max(ex.x, this.camX + 14)) return this.leave(ex.to, { walkout: true, direction: -1, walkoutY: ex.y });   // 2026-10-11 v039 左へ出る（5F・5G・5H）
      const inUp = ex.rect ? (m.x >= ex.rect[0] && m.x <= ex.rect[0] + ex.rect[2] && m.y >= ex.rect[1] && m.y <= ex.rect[1] + ex.rect[3]) : (Math.abs(m.x - ex.x) <= (ex.w || 24) && Math.abs(m.y - ex.y) <= 14);   // 5A: 足元が乗り込み範囲（rect）の中
      if (ex.mode === 'up' && inUp && I.down.up) {
        if (!MAPS[ex.to] && !this.map.elevator) { this.lockInput = true; return this.startClear(null); }
        return this.leave(ex.to, { into: [ex.x, ex.rect ? ex.rect[1] + 6 : this.walkY[0]] });
      }
    }
    if (!I.pressed.up) return;
    for (const p of this.map.portals) {
      const half = p.half || [18, 12];
      if (Math.abs(m.x - p.x) > half[0] || Math.abs(m.y - Math.max(p.y, this.walkY[0])) > half[1] + 2) continue;
      if (!this.portalUsable(p)) continue;
      return this.usePortal(p);
    }
  }
  // 青い上向き△（MIKA_BLUE_ENTRY_MARKER v002）
  //   本線マップ（A・B・C）: 最初の隠し入口（左から順）1か所だけ。入れる状態の間ずっと点滅（距離で出し入れしない）
  //   妖精の森の奥へ進む道（route）: 全部、最初から
  entryMarkers() {
    // 2026-10-11 5面以降: 部屋は一度だけ入れる。入った扉の印は消え、次の（左から）まだ入っていない扉に印を出す
    if (this.kind === 'main' && this.stage >= 5) {
      // 2026-10-12 ユーザー指定: 印はエリアで一つ目（左から最初）の部屋だけ。入った後に二つ目へ印を移さない
      const rooms = this.map.portals.filter((p) => MAPS[p.to] && MAPS[p.to].kind === 'room' && p.reuse !== 'return_to_parent').sort((a, b) => a.x - b.x);
      const near = this.map.marker_near;   // 2026-10-11 v053 5I: 扉に近づいた時だけ矢印を出す
      return rooms.slice(0, 1).filter((p) => this.entryOpen(p) && (!near || Math.abs(this.mika.x - p.x) <= near));
    }
    // 2026-10-12 ユーザー指定: 隠し部屋の中の、さらに奥の隠し部屋への扉には絶対に印を出さない（戻る扉だけ）
    if (this.kind === 'room' && this.stage >= 5) return this.map.portals.filter((p) => p.reuse === 'return_to_parent');
    if (this._markers) return this._markers.filter((p) => !(p.reuse === 'one_visit' && this.run.portalsUsed[p.id]));
    const list = [];
    if (this.kind === 'main') {
      const rooms = this.map.portals.filter((p) => MAPS[p.to] && MAPS[p.to].kind === 'room' && p.reuse !== 'return_to_parent').sort((a, b) => a.x - b.x);
      if (rooms.length) list.push(rooms[0]);
      for (const p of this.map.portals) if (p.reuse === 'route' && !list.includes(p)) list.push(p);
    }
    // 隠し部屋の出口（戻る場所）にも常に出す。背景に扉が描かれていない部屋（妖精の森など）で出口が分からないため
    if (this.kind === 'room') for (const p of this.map.portals) if (p.reuse === 'return_to_parent') list.push(p);
    this._markers = list;
    return list.filter((p) => !(p.reuse === 'one_visit' && this.run.portalsUsed[p.id]));   // 1回だけの部屋（4B・4C）は入った後は印を消す
  }
  entryOpen(p) {
    if (p.reuse === 'route') return true;
    if (p.reuse === 'one_visit' && this.run.portalsUsed[p.id]) return false;
    if (p.requires_break && !this.run.broken[this.mapId + ':' + p.requires_break]) return false;
    if (p.requires_break_wall && !this.roomOpen) return false;
    return true;
  }
  drawEntryMarkers() {
    if (this.exiting || !M.ANIMS.entry_up_blue) return;
    const a = M.ANIMS.entry_up_blue, i = Math.floor(this.fxTime / 130) % a.frames.length;
    for (const p of this.entryMarkers()) {
      const sx = Math.round(p.x - this.camX);
      if (sx < -20 || sx > M.W + 20 || !this.entryOpen(p)) continue;
      M.drawAnim('entry_up_blue', i, sx, this.walkY[0] + T.entryMarker.floorOffset, true);
    }
  }
  // 隠し部屋の敵（部屋に入って少し後に出る。倒した数は保存して、再入室で復活させない）
  updateEncounter(dt) {
    const E = this.encounter, key = 'enc:' + this.mapId;
    E.t += dt;
    if (E.t < E.spec.delay_ms) return;
    const killed = this.run.broken[key] || 0;
    const alive = this.enemies.filter((e) => e.encounter && !e.dead && e.state !== 'dying').length;
    // 倒した数を数える
    const dead = this.enemies.filter((e) => e.encounter && (e.dead || e.state === 'dying') && !e.counted);
    for (const e of dead) { e.counted = true; this.run.broken[key] = (this.run.broken[key] || 0) + 1; }
    const left = E.spec.group.length - (this.run.broken[key] || 0) - alive;
    if (left <= 0 || alive >= (E.spec.max_alive || 3) || (E.cool -= dt) > 0) return;
    const id = E.spec.group[E.spec.group.length - left], def = M.MON[id] || M.MON.goblin;
    const [w0, w1] = this.walkY, y = w0 + (w1 - w0) * rand(0.2, 0.8);
    const e = new M.Enemy(def, M.W + 30, y, { slot: 30 + E.n, enterTo: M.W - rand(40, 90) });
    e.encounter = true; e.dropWeapon = false; e.sectionId = '_room';
    this.enemies.push(e); E.n++; E.cool = 500;
  }
  portalUsable(p) {
    if (p.reuse === 'return_to_parent') return true;   // 隠し部屋の敵を残したままでも戻れる
    // マヨイの森の道（route）: 看板は最初から出し、敵を全滅させなくても進める（2026-10-08）
    if (p.reuse === 'route') return true;
    // 隠し部屋へは敵が残っていてもいつでも入れる（2026-10-08 ユーザー指定）。入る前の本線の状態（敵・位置・区間・TIME）はそのまま保存され、戻ると続きから
    const toRoom = MAPS[p.to] && MAPS[p.to].kind === 'room';
    // それ以外（区間の移動など）は戦闘中は入れない
    if (!toRoom && (this.hostilesAlive() > 0 || (this.queue.length && !(this.sec && this.sec.kind === 'travel')))) return false;
    if (p.reuse === 'one_visit' && this.run.portalsUsed[p.id]) return false;
    if (p.requires_break && !this.run.broken[this.mapId + ':' + p.requires_break]) return false;
    if (p.requires_break_wall && !this.roomOpen) return false;
    if (p.requires_scene && !toRoom) {
      const sec = this.sections.find((s) => s.kind !== 'travel' && s.screen === p.requires_scene);
      if (sec && !this.run.cleared[sec.section_id]) return false;
    }
    return true;
  }
  usePortal(p) {
    const target = MAPS[p.to];
    if (!target) return;
    if (p.reuse === 'return_to_parent') return this.returnToParent();
    if (target.kind === 'room') {
      this.run.portalsUsed[p.id] = true;
      if (p.id.endsWith('_nested') && !this.roomOpen) { this.roomOpen = true; this.run.broken[this.mapId + ':opened'] = true; }
      this.run.parents[p.to] = { world: this, x: p.return_xy ? p.return_xy[0] : p.x, y: p.return_xy ? p.return_xy[1] : Math.max(p.y, this.walkY[0]) + 4 };
      this.run.timeLeft[this.sec ? this.sec.section_id : '_'] = this.time;
      M.Audio.play('secret_door');   // 2026-10-12 v101 部屋に入る
      return this.transition(() => {
        this.saveCarry(true);
        M.setScene(new World(p.to, { run: this.run, entry: 'room', arrive: p.room_xy || target.start, onDone: this.onDone, onGameOver: this.onGameOver }));
      }, { into: [p.x, this.walkY[0]], music: false });
    }
    // 3Aの小道: 別の段（または同じ段の先）へ。敵・宝箱・TIMEは保存したまま
    return this.transition(() => {
      this.saveCarry(true);
      M.setScene(new World(p.to, { run: this.run, entry: 'route', arrive: [p.arrive[0], p.arrive[1]], arriveScene: p.arrive_scene, onDone: this.onDone, onGameOver: this.onGameOver }));
    }, { into: [p.x, this.walkY[0]] });
  }
  returnToParent() {
    const par = this.run.parents[this.mapId];
    if (!par) return;
    M.Audio.play('secret_door');   // 2026-10-12 v101 部屋から出る
    this.transition(() => {
      this.saveCarry(true);
      const w = par.world;
      M.world = w;
      w.resumeFromRoom(par.x, par.y);
      M.setScene(w);
    }, { into: [this.mika.x, this.walkY[0]], music: false });
  }
  resumeFromRoom(x, y) {
    this.applyCarry();
    const m = this.mika, r = this.robot;
    m.x = x; m.y = clamp(y, this.walkY[0], this.walkY[1]); m.setState('idle', 'idle'); m.invuln = 600; m.z = 0;
    r.x = clamp(x - 40, this.camX + 16, this.camX + M.W - 16); r.y = clamp(m.y + 6, this.walkY[0], this.walkY[1]);
    if (r.state !== 'broken') r.setState('idle', 'robot_idle', { loop: true });
    this.fade = { a: 1, dir: -1 }; this.exiting = null; this.lockInput = false;
    this.timerRunning = !!this.sec && !this.secCleared;
    this.items = this.items.filter((it) => !it.remove);
  }
  // 暗転してから次へ。into=[x,y] ならミカが奥へ歩いて入る
  transition(then, o = {}) {
    if (this.exiting) return;
    this.exiting = { then, t: 0 };
    this.lockInput = true; this.timerRunning = false;
    const m = this.mika;
    if (o.walkout) { const dir = o.direction === -1 ? -1 : 1; m.walkoutDirection = dir; m.walkoutY = o.walkoutY != null ? o.walkoutY : null; m.face = dir; m.setState('walkout', 'walk'); this.robot.face = dir; this.robot.setState('move', 'robot_move', { loop: true }); this.exiting.walkout = true; this.exiting.direction = dir; }
    else if (o.into) m.goTo(o.into[0], o.into[1], null);
    // 2026-10-09 ユーザー指定: マップ移動は暗転とBGMのフェードアウトを2秒かけて。隠し部屋の出入りは親の曲を続けるので暗転だけ
    const ms = o.fadeMs || T.stage.mapFadeOutMs || T.stage.fadeMs;
    if (o.music !== false) M.Audio.fadeOutMusic(ms);
    this.fade = { a: 0, dir: 1, ms };
  }
  leave(to, o = {}) {
    const target = MAPS[to];
    if (this.kind === 'room' || (target && target.kind === 'room')) o = Object.assign({ music: false }, o);
    // 2026-10-11 5面: 外壁エレベーター（js/elevator.js）。暗転→上昇の場面→次の階へ。BGMは止めずに続ける
    const EL = this.map.elevator;
    if (EL && this.map.exit && to === this.map.exit.to) {
      return this.transition(() => {
        this.saveCarry(false);
        const next = () => {
          if (MAPS[to]) M.setScene(new World(to, { run: this.run, entry: 'map', onDone: this.onDone, onGameOver: this.onGameOver }));
          else this.onDone({ score: this.run.score });   // 5I（展望台）が未制作の間: 高速エレベーターの後は TO BE CONTINUED へ
        };
        M.setScene(new M.ElevatorScene(EL.route, { mirrored: EL.mirrored, done: next }));
      }, Object.assign({ music: false, fadeMs: 1200 }, o));
    }
    this.transition(() => {
      const sameArea = target && target.stage === this.stage && this.map.key.startsWith('F') && target.key.startsWith('F');
      this.saveCarry(sameArea);     // 武器はマップ移動で捨てる（weapon_balance.json discard_on_map_transition）
      M.setScene(new World(to, { run: this.run, entry: 'map', onDone: this.onDone, onGameOver: this.onGameOver }));
    }, o);
  }

  // ---------------------------------------------------------------- ボス
  beginBoss(sec) {
    this.queue = [];
    const B = this.PL.boss && this.PL.boss.section === sec.section_id ? this.PL.boss : null;
    const minis = [].concat(this.PL.miniboss || [], this.PL.minibosses || []);   // 5面は中ボスが2か所（5Aメカ2体・5Dダンダルモン）
    const mini = minis.find((m) => m.section === sec.section_id) || null;
    this.bossSpec = B || mini;
    this.bossStarted = false;
    this.bossPending = true;   // ミカが区間に入って登場演出が始まるまで
  }
  updateBossSection(dt) {
    const sec = this.sec;
    if (this.bossPending) {
      if (!this.timerRunning && !this.lockInput) this.timerRunning = true;
      if (this.mika.state === 'entrance' || this.lockInput) return;
      this.bossPending = false;
      M.startBoss(this, this.bossSpec, sec);
      return;
    }
    if (this.bossCtl) this.bossCtl.update(dt);
  }
  isFinalSection() { const s = this.sec; return s && s.kind === 'boss' && this.PL.boss && this.PL.boss.section === s.section_id; }

  // ---------------------------------------------------------------- イベント
  onEntranceDone() {
    this.lockInput = false; this.timerRunning = !!this.sec && !this.secCleared;
    if (this.entry === 'stage_start') M.Audio.voice('stage_start');
    else if (this.entry === 'map' && this.kind !== 'room') M.Audio.voice(this.stage === 6 ? 'zone6_start' : 'zone_start');   // 2026-10-11 面の途中のマップに入った時（6面は脱出用の声）
    if (T.prototype.debugBoss) this.startBossIntroDebug();
  }
  startBossIntroDebug() {
    T.prototype.debugBoss = false;
    const last = this.sections.findIndex((s) => s.kind === 'boss');
    if (last < 0) return;
    this.enemies = []; this.camX = this.stopX(this.sections[last]);
    this.mika.x = this.camX + 80; this.robot.x = this.camX + 40;
    this.beginSection(last, false);
  }
  onEnemyHit(e, att, info) {
    // ミカの声: SMASH／雑魚へのとどめ（ロボの攻撃では言わない）
    const byMika = att === this.mika || att.owner === this.mika || (att.team === 'player' && !att.robotShot && !info.robot);
    // 2026-10-11 ロボの攻撃が当たった相手はロボのHPの下に出す（ミカの相手はミカの下）
    const byRobot = !byMika && (att === this.robot || att.owner === this.robot || att.robotShot || info.robot);
    if (byRobot) { this.lastTargetR = e; this.lastTargetRT = 2500; } else { this.lastTarget = e; this.lastTargetT = 2500; }
    if (byMika && info.smash) M.Audio.voice('smash');
    else if (byMika && e.hp <= 0 && !e.boss) M.Audio.voice('todome');
    // 区間の最後の1体を倒した瞬間: 短いスローと揺れ（ボスより軽く）
    if (e.hp <= 0 && !e.boss && !this.clearSeq && !this.miniSlow && this.sec && this.sec.kind !== 'boss' && this.waveOpen && !this.queue.length &&
        !this.enemies.some((o) => o !== e && !o.dead && o.state !== 'dying' && o.hp > 0 && !o.friendly) &&
        !this.props.some((p) => p.kind === 'cylinder' && p.spec.section_id === this.sec.section_id && p.cstate !== 'spent')) {
      this.miniSlow = { t: T.stage.lastKillSlowMs };
      this.shake = Math.max(this.shake, T.stage.lastKillShake);
    }
  }
  onEnemyDying(e) {
    if (!e.boss) this.killedHere = true;   // 全滅でロボがしゃべる条件（この場面で雑魚を倒した）
    if (e.noScore) return;
    const sc = e.def.score || 0;
    this.run.score += sc;   // 撃破時に一度だけ加算
    this.robot.onKill();
    if (sc) this.effects.push(new M.Effect({ kind: 'label', text: String(sc), x: e.x, y: e.y, z: 40, life: 700, color: '#ffe066' }));
  }
  onEnemyRemoved(e) {}
  onTaunt() { for (const e of this.enemies) if (!e.dead && !e.boss) e.taunted = true; }
  onPlayerHit() {}
  // ---------------------------------------------------------------- ロボの声（2026-10-11 ROBO_*）
  //   1本ずつ順番に鳴らす（鳴っている間は次を待つ）。壊れた時の声以外は、ロボが動いている時だけ
  roboAlive() { const r = this.robot; return r && r.hp > 0 && r.state !== 'broken'; }
  roboSay(cat, o = {}) { (this.roboQ = this.roboQ || []).push({ cat, wait: o.delay || 0, age: 0, urgent: !!o.urgent, then: o.then }); }
  updateRoboVoice(dt) {
    const q = this.roboQ; if (!q || !q.length) return;
    const it = q[0]; it.wait -= dt; it.age += dt;
    if (it.wait > 0) return;
    const busy = this.roboV && !this.roboV.ended;
    if (busy && !it.urgent) { if (it.age > 6000 && !it.fn) q.shift(); return; }   // 長く待たされた声は捨てる
    q.shift();
    if (it.fn) { it.fn(); return; }
    if (it.cat !== 'hp0' && !this.roboAlive()) return;
    if (busy) M.Audio.fadeVoice(this.roboV);
    const keys = (M.AUDIO.roboVoice || {})[it.cat] || [];
    if (!keys.length) return;
    this.roboPrev = this.roboPrev || {};
    let i = Math.floor(Math.random() * keys.length);
    if (keys.length > 1 && i === this.roboPrev[it.cat]) i = (i + 1 + Math.floor(Math.random() * (keys.length - 1))) % keys.length;   // 直前と同じ声を避ける
    this.roboPrev[it.cat] = i;
    this.roboV = M.Audio.play(keys[i]) || { ended: true };
    if (it.then) q.unshift({ fn: it.then, wait: 200, age: 0 });   // ロボの声が終わってから（会話の続き）
  }
  onRobotBroken() { this.roboSay('hp0', { urgent: true, then: () => M.Audio.voice('robo_down') }); }   // ロボの声 → それを聞いてミカ
  onRobotLowHp() { this.roboSay('hp25'); }
  onRobotRevived() { M.Audio.play('robo_repair'); this.roboSay('fukkatu', { delay: 1100 }); }   // 2026-10-12 v101 直る機械音 → ロボの声
  onMikaDefeated() {
    if (this.robot.state === 'broken' || this.robot.hp <= 0) this.gameOver();
    else this.roboSay('mikahp0', { delay: 900 });   // ミカの断末魔の後に
  }
  onRescueStart() { this.roboSay('kaifuku'); }
  onRescueDone() {
    const m = this.mika;
    m.hp = Math.round(m.maxHp * T.robot.rescueHpRatio);
    m.setState('rescued', 'getup');
    M.Audio.voice('robo_revive');
    if (this.time <= 0) { this.time = T.mapTime.rescueRefill; this.run.mapTime[this.tgroup] = this.time; }
  }
  onPropBroken(p) {
    M.Audio.play(breakSE(p));   // 2026-10-12 v106 材質ごとの音
    this.run.broken[this.propKey(p)] = true;
    if (p.kind === 'chest') return this.dropChest(p);
    if (p.kind === 'hatch') { this.effects.push(new M.Effect({ kind: 'label', text: 'UP', x: p.x, y: p.y + 10, z: 60, life: 900, color: '#9ff' })); return; }
    if (p.kind === 'secret_wall') { M.Audio.play('secret_door'); this.roomOpen = true; this.run.broken[this.mapId + ':opened'] = true; return; }
    this.run.score += p.score || 100;
    if (Math.random() < (p.drop_chance != null ? p.drop_chance : 0.2)) {
      const c = new M.Prop({ id: p.id + '_chest', kind: 'chest', x: p.x, y: clamp(p.y, this.walkY[0], this.walkY[1]), hp: 1, loot_table: p.loot_table || 1 });
      this.props.push(c);
    }
  }
  // 宝箱の中身: chests.json の抽選 → loot_asset_lookup.json で日本語名をIDと画像へ変換
  lootDef(name, id, tierEntry) {
    const L = REF.loot, items = REF.treasure.items;
    const look = name ? (L[name] || L[name.replace('よいちの弓', 'よいちのゆみ')]) : Object.values(L).find((v) => v.id === id);
    const iid = look ? look.id : id;
    const base = items.find((x) => x.id === iid) || {};
    const HEAL = { potion: 0.25, high_potion: 0.5, elixir: 1 };
    const isW = !!M.WEAPONS[iid];
    return {
      id: iid, name: name || base.name || iid, kind: isW ? 'weapon' : look ? look.kind : 'item',
      file: (look && look.file) || base.file || (isW ? M.WEAPONS[iid].icon + '.png' : null),
      score: base.score != null ? base.score : tierEntry ? tierEntry.score : 0,
      heal: base.heal_fraction || HEAL[iid] || 0,
    };
  }
  dropChest(c) {
    const drops = [];
    if (c.loot_item) drops.push(this.lootDef(null, c.loot_item, null));
    if (c.loot_table) {
      const tier = REF.chests.tiers.find((t) => t.id === REF.map.loot_table_mapping[c.loot_table]);
      if (tier) for (let d = 0; d < (tier.draws || 1); d++) {
        let r = Math.random() * tier.weight_total, pick = tier.weighted_items[0];
        for (const wi of tier.weighted_items) { r -= wi.weight; if (r < 0) { pick = wi; break; } }
        drops.push(this.lootDef(pick.name, null, pick));
      }
    }
    drops.forEach((it, k) => {
      const frame = it.file ? it.file.replace('.png', '') : null;
      if (!frame || !M.ATLAS.frames[frame]) { console.warn('拾い物の画像がありません:', it.name); return; }
      this.items.push(new M.Item({ def: it, frame, x: c.x + (k - (drops.length - 1) / 2) * 16, y: c.y + 1, vx: (k - 0.5) * 30 }));
    });
  }
  dropWeaponItem(id, x, y) {
    const W = M.WEAPONS[id]; if (!W) return;
    // 画面の外で落ちた武器は画面内へ（拾えなくならないように）
    x = clamp(x, this.camX + 16, this.camX + M.W - 16);
    this.items.push(new M.Item({ def: { id, kind: 'weapon', name: W.name, score: 0 }, frame: W.icon, x, y: clamp(y, this.walkY[0], this.walkY[1]), vx: 0 }));
  }
  itemAt(m) {
    return this.items.find((it) => !it.remove && it.z === 0 && Math.abs(it.x - m.x) < 16 && Math.abs(it.y - m.y) < 8);
  }
  collect(it) {
    if (it.remove) return;
    it.remove = true;
    const d = it.def, m = this.mika;
    // 2026-10-11 エンディングのリザルト（獲得トレジャー一覧）用に、拾った物を数える（ゲームを始めてから。99まで）
    if (M.game) { const c = (M.game.items = M.game.items || {}); c[d.id] = Math.min(99, (c[d.id] || 0) + 1); }
    if (d.kind === 'weapon') {
      m.pickWeapon(d.id);
      if (((M.AUDIO.voice || {}).long_weapon || {}).weapons && M.AUDIO.voice.long_weapon.weapons.includes(d.id)) M.Audio.voice('long_weapon');
      this.effects.push(new M.Effect({ kind: 'label', text: d.id.replace(/_/g, ' '), x: m.x, y: m.y, z: 56, life: 900, color: '#9ff' }));
      M.Audio.play('pickup'); return;
    }
    if (d.heal) {
      m.hp = Math.min(m.maxHp, m.hp + Math.round(m.maxHp * d.heal));
      this.effects.push(new M.Effect({ x: m.x, y: m.y + 0.5, z: 0, anim: new M.Anim('healing_sparkles'), life: 400 }));
    }
    this.run.score += d.score || 0;
    if (d.score) this.effects.push(new M.Effect({ kind: 'label', text: String(d.score), x: it.x, y: it.y, z: 20, life: 700, color: '#9ff' }));
    M.Audio.play(d.heal ? 'heal' : 'coin');
    M.Audio.voice(d.heal ? 'potion' : 'item');
  }
  hittables() { return this.enemies.concat(this.props.filter((p) => p.canBeHit())); }

  gameOver() {
    if (this.over) return;
    this.over = { t: 0 };
    this.timerRunning = false;
    M.Audio.fadeOutMusic(600);   // 2026-10-12 v101 GAME OVER の音を聞かせる
  }

  // ---------------------------------------------------------------- クリア演出
  // ボス撃破スロー（一度だけ）→ ボスの倒れ演出 → STAGE CLEAR とクリア曲（再生位置5.000秒でキラーン）→ TIME BONUS → 曲の終わりを待ってフェード
  // マップを出る時の残りTIMEを記録（ステージクリアで 残り×500点。一度だけ）
  finishMapTime() { if (this.kind !== 'room' && this.run.mapFinal[this.tgroup] === undefined) this.run.mapFinal[this.tgroup] = this.time; }
  clockOn() {
    return this.kind !== 'room' && !this.lockInput && !this.exiting && !this.clearSeq && !this.over && !this.cutscene &&
      this.run.mapFinal[this.tgroup] === undefined && !(this.bossIntro && this.bossIntro.busy);
  }
  startClear(victim, o = {}) {
    if (this.clearSeq) return;
    this.finishMapTime();
    if (this.sec && this.run.sectionTimes[this.sec.section_id] === undefined) this.run.sectionTimes[this.sec.section_id] = this.time;
    if (this.sec) this.run.cleared[this.sec.section_id] = true;
    this.clearSeq = { phase: victim ? 'slowmo' : 'pose', t: 0, victim, boss: o.boss, wait: o.wait };
    this.timerRunning = false;
    this.lockInput = true;
    this.holdAttacks = true;
    if (victim) this.timeScale = T.stage.clearSlowmo;
    this.queue = [];
    // 残った取り巻きは得点なしで退場（攻撃しない）
    for (const e of this.enemies) if (!e.boss && !e.dead && e.state !== 'dying' && !e.friendly) e.vanish = true;
  }
  bossDeathDone() { if (this.clearSeq && this.clearSeq.phase === 'bossdeath') { this.clearSeq.phase = this.clearSeq.wait ? 'wait' : this.clearSeq.boss ? 'afterboss' : 'pose'; this.clearSeq.t = 0; } }
  clearReady() { if (this.clearSeq && ['wait', 'bossdeath'].includes(this.clearSeq.phase)) { this.clearSeq.phase = 'pose'; this.clearSeq.t = 0; } }
  updateClear(dt) {
    const c = this.clearSeq;
    if (!c) return;
    c.t += dt;
    if (c.phase === 'slowmo') {
      if (c.t >= T.stage.bossSlowmoMs) { this.timeScale = 1; c.phase = 'bossdeath'; c.t = 0; if (!c.victim || !c.victim.boss) this.bossDeathDone(); }
      return;
    }
    // 2026-10-09 ユーザー指定: ボスが倒れきってから約2秒おいてクリアのポーズと曲
    if (c.phase === 'afterboss') { if (c.t >= (T.stage.bossClearDelayMs || 0)) { c.phase = 'pose'; c.t = 0; } return; }
    if (c.phase === 'bossdeath' || c.phase === 'wait') { if (c.t > 40000) { c.phase = 'pose'; c.t = 0; } return; }   // 保険
    if (c.phase === 'pose') {
      if (!c.started) {
        c.started = true;
        const m = this.mika;
        if (!['knock', 'down', 'getup', 'defeated', 'walkout', 'auto'].includes(m.state)) { m.z = 0; m.endWeaponHold(); m.setState('clear', 'clear', { hold: true }); }
        // クリア曲（実際の長さを読み、鳴り終わるまで待つ）
        c.jingleMs = M.Audio.duration('stage_clear') || T.stage.clearJingleMs;
        c.music = M.Audio.playMusic('stage_clear', { loop: false });
        M.Audio.voice('stage_clear');
        c.clock = 0;   // 音が使えない時の代わりの時計（ゲームの時計＝ポーズで止まる）
      }
      if (['idle', 'walk'].includes(this.mika.state) && !c.offscreen) this.mika.setState('clear', 'clear', { hold: true });
      if (c.t >= T.stage.clearTallyDelayMs) {
        c.phase = 'tally'; c.tallyT = 0;
        c.bonusTotal = Object.values(this.run.mapFinal).reduce((a, b) => a + b, 0) * T.mapTime.bonusPerSecond;
        c.bonusShown = 0;
      }
      return;
    }
    if (c.phase === 'tally') {
      c.tallyT += dt;
      if (!c.added) {
        c.bonusShown = Math.min(c.bonusTotal, Math.round(c.bonusTotal * c.tallyT / T.stage.clearTallyMs / 100) * 100);
        if (((c.tallyT / 50) | 0) % 2 && c.bonusShown < c.bonusTotal) M.Audio.play('time_tick');
        if (c.tallyT >= T.stage.clearTallyMs) { c.bonusShown = c.bonusTotal; c.added = true; this.run.score += c.bonusTotal; }   // ボーナスは一度だけ加算
      } else {
        // 曲の終了（実際の再生）と集計の完了を両方待つ
        const ended = c.music ? (c.music.ended || !M.Audio.musicPlaying('stage_clear')) : c.clock >= c.jingleMs;
        if (ended) { c.endT = (c.endT || 0) + dt; if (c.endT >= T.stage.clearHoldMs) { c.phase = 'fade'; this.fade = { a: 0, dir: 1 }; } }
      }
      return;
    }
    if (c.phase === 'fade' && this.fade.a >= 1 && !c.finished) {
      c.finished = true;
      this.onDone({ score: this.run.score });
    }
  }
  // クリア曲の再生位置（ms）。音が鳴らない環境ではゲームの時計
  clearPos() {
    const c = this.clearSeq; if (!c || !c.started) return -1;
    const p = M.Audio.musicPos('stage_clear');
    return p >= 0 ? p : (c.music && c.music.ended ? 1e9 : c.clock);
  }

  // ---------------------------------------------------------------- 更新
  update(rawDt) {
    this.debugBoxes = [];
    if (this.fade) {
      this.fade.a = clamp(this.fade.a + this.fade.dir * rawDt / (this.fade.ms || T.stage.fadeMs), 0, 1);
      if (this.fade.dir < 0 && this.fade.a <= 0) this.fade = { a: 0, dir: 0 };
    }
    if (this.exiting) {
      this.exiting.t += rawDt;
      if (this.exiting.walkout) { const d = this.exiting.direction || 1; this.robot.x += d * 110 * rawDt / 1000; this.robot.face = d; this.robot.anim.update(rawDt); }
      if (this.fade.a >= 1 && !this.exiting.fired) { this.exiting.fired = true; this.exiting.then(); return; }
    }
    if (this.go) { this.go.t += rawDt; if (!this.go.exit && !this.go.hint && !(this.go.snd && this.go.t < GO_SYNC.period * GO_SYNC.count) && ((this.rtl ? this.camX < this.go.cam - 24 : this.camX > this.go.cam + 24) || (this.sec && this.sec.kind !== 'travel'))) this.go = null; }
    // 2026-10-12 ユーザー指定: マヨイの森の正解のマップ（3F3）では、右へ進めば広場に出られることを「GO→」で示す
    //   敵がいない間はずっと点滅。敵が出たら消し、広場（ボス区間）に着いたら出さない
    if (this.map.specials && this.map.specials.go_hint) {
      const calm = !this.cutscene && !this.lockInput && this.mika.state !== 'entrance' && this.sec && this.sec.kind !== 'boss' && !this.enemies.some((e) => !e.dead && e.state !== 'dying' && !e.friendly && !e.dormant);
      if (calm && !this.go) this.go = { t: 0, cam: this.camX, hint: true };
      else if (!calm && this.go && this.go.hint) this.go = null;
    }
    this.mapTitle.update(rawDt);
    if (M.Tutor) M.Tutor.update(rawDt, this);   // 2026-10-11 簡易チュートリアル
    this.fxTime += rawDt;
    if (this.rangedLock > 0) this.rangedLock -= rawDt;
    M.Audio.update(rawDt);
    if (this.clearSeq && this.clearSeq.started) this.clearSeq.clock += rawDt;
    if (this.over) {
      this.over.t += rawDt;
      if (this.over.t >= OVER_SE_MS && !this.over.se) { this.over.se = true; M.Audio.play('gameover'); }   // 2026-10-12 v101 ミカの断末魔の後に
      if (this.over.t > OVER_SE_MS + 4100 && !this.over.fading) { this.over.fading = true; this.fade = { a: 0, dir: 1 }; }
      if (this.over.fading && this.fade.a >= 1 && !this.over.done) { this.over.done = true; this.onGameOver(); }
    }
    this.updateClear(rawDt);
    if (this.miniSlow) {
      if (this.clearSeq) this.miniSlow = null;
      else { this.miniSlow.t -= rawDt; this.timeScale = this.miniSlow.t > 0 ? T.stage.lastKillSlow : 1; if (this.miniSlow.t <= 0) this.miniSlow = null; }
    }
    const dt = rawDt * this.timeScale;
    if (this.stage === 4) M.clock4 = (M.clock4 || 0) + rawDt;
    if (this.clockOn()) {
      this.timeAcc += rawDt;
      const tick = this.tickMs || T.mapTime.tickMs;   // 2026-10-11 6面の脱出は T.escape.tickMs（カウントを速くできる）
      while (this.timeAcc >= tick) {
        this.timeAcc -= tick;
        this.time = Math.max(0, this.time - 1);
        this.run.mapTime[this.tgroup] = this.time;
        if (!this.s6 && (this.time === 30 || (this.time <= 10 && this.time > 0))) M.Audio.play('timer');   // 2026-10-12 v107 残りわずかの音（脱出 6B〜6F は声があるので鳴らさない）
        if (this.time === 0) this.timeUp();
      }
    }
    if (this.lastTargetT > 0) this.lastTargetT -= rawDt;
    if (this.lastTargetRT > 0) this.lastTargetRT -= rawDt;
    this.updateRoboVoice(rawDt);
    // 2026-10-11 ユーザー指定: 暗転して部屋・次のマップへ移る間は、敵も弾も止めてミカは攻撃を受けない
    const leaving = !!this.exiting;
    const intro = (this.bossIntro && this.bossIntro.busy) || this.cutscene || leaving;
    if (this.bossIntro) this.bossIntro.update(rawDt);
    if (this.elev) this.elev.update(dt);
    if (intro) {
      this.mika.anim.update(dt);
      if (this.mika.state === 'auto' || this.mika.state === 'walkout') this.mika.update(dt);
      // ボス登場演出の間、ロボはミカの後ろへついて行く（攻撃はしない）
      const robotWalk = (this.cutscene && this.robot.state === 'auto') || (this.bossIntro && this.bossIntro.busy && ['idle', 'move'].includes(this.robot.state));
      if (robotWalk) this.robot.update(dt); else this.robot.anim.update(dt);
      if (!leaving) for (const e of this.enemies) if (e.boss || e.friendly) e.update(dt);
      else for (const e of this.enemies) if (e.state === 'dying') e.update(dt);   // 倒れている途中の敵だけは進める
    } else {
      this.mika.update(dt);
      this.robot.update(dt);
      for (const e of this.enemies) {
        if (e.vanish && e.state !== 'dying' && !e.dead) { e.noScore = true; e.state = 'dying'; e.st2 = 0; e.fam = Object.assign({}, e.fam, { death: 'blink' }); }
        if (!e.dormant) e.update(dt); else e.anim.update(dt);
      }
    }
    if (this.encounter) this.updateEncounter(rawDt);
    // 鳴り続ける環境音（4面の電車の走行音）。マップを出ると自動で止まる
    if (this.map.ambient_se && !this.ambientOff && !(M.game && M.game.paused)) {
      if (!this.ambV || this.ambV.ended) this.ambV = M.Audio.play(this.map.ambient_se, { loop: true });
      M.Audio.touchLoop(this.ambV);
    }
    const hook = M.mapHooks && M.mapHooks[this.map.fx];
    if (hook && hook.update) hook.update(this, dt, intro);
    if (!leaving) for (const p of this.projectiles) p.update(dt);
    for (const p of this.props) p.update(dt);
    for (const it of this.items) {
      it.update(dt);
      // 落ちてくる間だけ画面内へ寄せる。2026-10-12 v119 ユーザー指定: 一度地面に落ちた武器は寄せない
      //   （画面の左端に引っかかってついて来るとズルができるので、スクロールで画面の外へ流して消す）
      if (it.def.kind === 'weapon' && !it.remove && !it.landed) {
        it.x = clamp(it.x, this.camX + 16, this.camX + M.W - 16);
        if (it.z === 0 && it.vz === 0) it.landed = true;
      }
    }
    for (const f of this.effects) f.update(dt);
    if (this.smashFx) this.smashFx.update(dt);   // 2026-10-11 v034 SMASH!画像
    this.updateCylinders(dt);
    if (this.extraUpdate) this.extraUpdate(dt);
    for (const e of this.enemies) if (e.dormant && Math.abs(e.x - this.mika.x) < 120) e.dormant = false;
    if (this.kind === 'room' && !this.roomRevealT) this.roomRevealT = 0;
    this.updateSection(dt);
    if (this.clearSeq && this.bossCtl) this.bossCtl.update(dt);   // 撃破後の演出（クイーンの命乞いなど）
    this.updatePortals();
    this.enemies = this.enemies.filter((e) => !e.remove);
    this.projectiles = this.projectiles.filter((p) => !p.remove);
    this.props = this.props.filter((p) => !p.remove);
    this.items = this.items.filter((p) => !p.remove);
    this.effects = this.effects.filter((p) => !p.remove);
    if (this.shake > 0) this.shake = Math.max(0, this.shake - rawDt / 120);
  }
  // 2Cの脱出槽: 近づく／叩く → 予兆・ヒビ → 割れる → 敵を一度だけ出す → 壊れた槽が残る
  updateCylinders(dt) {
    for (const p of this.props) {
      if (p.kind !== 'cylinder') continue;
      const c = p.spec, st = this.run.cyl[c.id] || (this.run.cyl[c.id] = { state: p.cstate });
      if (p.cstate === 'spent') { st.state = 'spent'; continue; }
      const active = this.sec && this.sec.section_id === c.section_id && !this.lockInput;
      if (p.cstate === 'intact' && active && Math.abs(this.mika.x - p.x) <= c.trigger_radius_x) { p.cstate = 'warning'; p.age = 0; }
      if (p.cstate === 'intact') continue;
      p.age = (p.age || 0) + dt;
      if (p.cstate === 'warning' && p.age >= c.warning_ms) { p.age -= c.warning_ms; p.cstate = 'breaking'; M.Audio.play('glass'); }
      if (p.cstate === 'breaking') {
        if (p.age >= c.spawn_at_break_ms && !st.spawned) {
          st.spawned = true;
          const def = M.MON[c.enemy_id] || M.MON.mega_goblin;
          const e = new M.Enemy(def, p.x, clamp(p.y + 8, this.walkY[0], this.walkY[1]), { fixed: true, emerge: sign(this.mika.x - p.x) || -1 });
          e.sectionId = c.section_id; e.cool = c.landing_grace_ms + 300;
          this.enemies.push(e);
          this.shake = 1;
        }
        if (p.age >= c.break_ms) p.cstate = 'spent';
      }
      st.state = p.cstate;
    }
  }
  timeUp() {
    const m = this.mika;
    this.timerRunning = false;
    m.hp = 0; m.vx = 0; m.vz = 60; m.setState('knock', 'knockback');
  }

  // ---------------------------------------------------------------- 描画
  // 進入禁止のロープ: map.barriers = { y: ポール底のy, spans: [[x0, x1], ...] }（ワールド座標）。
  //   区間の長さを約96pxごとに均等割りして、ロープを先に・ポールを後に描く（v042 rope_barrier.js と同じ組み方）
  drawBarriers() {
    const B = this.map.barriers, pole = M.bg('barrier_pole'), rope = M.bg('barrier_rope');
    if (!B || !pole || !rope) return;
    const ctx = M.ctx, base = B.y, cam = Math.round(this.camX);
    for (const [x0, x1] of B.spans) {
      if (x1 - cam < -20 || x0 - cam > M.W + 20 || x1 - x0 < 32) continue;
      const n = Math.max(1, Math.round((x1 - x0) / 96)), xs = [];
      for (let i = 0; i <= n; i++) xs.push(Math.round(x0 + (x1 - x0) * i / n));
      for (let i = 0; i < n; i++) ctx.drawImage(rope, xs[i] - cam, base - 37, xs[i + 1] - xs[i], 20);
      for (const x of xs) ctx.drawImage(pole, x - cam - 9, base - 41);
    }
  }
  drawLayers(list) {
    const ctx = M.ctx;
    for (const l of list || []) {
      if (l.fx) { const f = M.layerFx && M.layerFx[l.fx]; if (f) f(this); continue; }   // 2026-10-11 絵ではなく演出を描く層（4Aの飛来物など）
      if (l.rect) { ctx.fillStyle = l.color; ctx.fillRect(Math.round(l.rect[0] - this.camX), l.rect[1], l.rect[2], l.rect[3]); continue; }
      const im = M.bg(l.bg); if (!im) continue;
      ctx.save();
      if (l.clip) { ctx.beginPath(); if (l.edges) { ctx.rect(0, l.clip[0], l.edges, l.clip[1] - l.clip[0]); ctx.rect(M.W - l.edges, l.clip[0], l.edges, l.clip[1] - l.clip[0]); } else ctx.rect(0, l.clip[0], M.W, l.clip[1] - l.clip[0]); ctx.clip(); }
      if (l.clipX) { ctx.beginPath(); ctx.rect(Math.round(l.clipX[0] - this.camX), 0, l.clipX[1] - l.clipX[0], M.H); ctx.clip(); }   // 5D/5G ガラス: 入口・出口の扉は覆わない
      ctx.globalAlpha = (l.opacity != null ? l.opacity : 1) + (l.pulse ? l.pulse * Math.sin(this.fxTime / 1000) : 0);
      const clk = l.clock === 'stage4' ? (M.clock4 || 0) : this.fxTime;   // 4面の空・雲は部屋を出入りしても流れが途切れない共通の時計
      let x = -Math.round(this.camX * l.factor + (l.drift ? clk * l.drift / 1000 : 0) + (l.extraScroll ? l.extraScroll(this) : 0));
      const sy = l.shake ? l.shake[Math.floor(clk / 1000 * (l.shakeHz || 8)) % l.shake.length] : 0;   // 列車の絵だけガタンゴトン（判定は動かない）
      if (l.loop) { x = ((x % im.width) + im.width) % im.width - im.width; ctx.drawImage(im, x, (l.y || 0) + sy); ctx.drawImage(im, x + im.width, (l.y || 0) + sy); }
      else ctx.drawImage(im, x, (l.y || 0) + sy);
      // 2026-10-11: 揺れで絵が上がった分、下端に空が見えるので黒で埋める
      if (sy < 0 && !l.y) { ctx.globalAlpha = 1; ctx.fillStyle = '#000'; ctx.fillRect(0, M.H + sy, M.W, -sy); }
      ctx.restore();
    }
  }
  draw() {
    const ctx = M.ctx;
    const shx = this.shake > 0 ? Math.round(rand(-this.shake, this.shake)) : 0;
    const shy = this.shake > 0 ? Math.round(rand(-this.shake, this.shake)) : 0;
    const ws = this.map.world_shake ? this.map.world_shake[Math.floor((M.clock4 || 0) / 1000 * (this.map.world_shake_hz || 8)) % this.map.world_shake.length] : 0;   // 4B: 車内ごと±1px（表示だけ）
    const offY = shy + ws + (this.elev ? this.elev.impactY() : 0) + (this.extraShakeY || 0);
    ctx.save(); ctx.translate(shx, offY);
    ctx.fillStyle = '#0d1020'; ctx.fillRect(-4, -4, M.W + 8, M.H + 8);
    const fx = this.map.fx;
    if (fx === 'stage1' && this.kind !== 'room') this.drawStage1Back();
    else if (this.elev) this.elev.drawBack();
    else if (this.kind === 'room' && this.map.layers.length < 2) ctx.drawImage(M.bg(this.roomOpen && this.map.open_bg ? this.map.open_bg : this.map.layers[0].bg), 0, 0);
    else if (this.hookDrawBack && this.hookDrawBack()) { /* 4B到着演出などが背景を描いた */ }
    else this.drawLayers(this.map.layers);
    if (fx === 'stage1' && this.kind !== 'room') this.drawFrontFx(REF.bgfx1.maps[this.map.key]);
    this.drawBarriers();
    M.drawAmbient && M.drawAmbient(this, 'back');
    // 足元yで奥行きソート（同じyは固定ID順）。ジャンプ高さ・大きな手では並べ替えない
    const behind = this.props.filter((p) => p.behind);
    for (const p of behind) p.draw();
    this.drawEntryMarkers();   // 入れる場所の青い△（床の手前・キャラより下）
    if (!this.hideActors) {   // 到着演出で汽車の外観を見せている間は車内の人や物を描かない
      const list = [].concat(this.props.filter((p) => !p.behind), this.items, this.enemies, [this.robot, this.mika], this.projectiles, this.extraActors || []);
      list.sort((a, b) => (a.y - b.y) || ((a.id || 0) - (b.id || 0)));
      for (const o of list) o.draw();
      for (const f of this.effects) f.draw();
    }
    const hookD = M.mapHooks && M.mapHooks[this.map.fx];
    if (hookD && hookD.drawFront) hookD.drawFront(this);
    this.drawLayers(this.map.front_layers);
    M.drawAmbient && M.drawAmbient(this, 'front');
    if (this.smashFx && !this.hideActors) this.smashFx.draw();   // SMASH!は手前ガラスより前・HUDより後ろ
    if (this.bossIntro) this.bossIntro.draw();
    if (T.prototype.showHitboxes) this.drawDebug();
    ctx.restore();
    // 2026-10-11: 画面ごと揺らした時に上下左右へはみ出して見える部分は黒で隠す（HUDより下）
    if (offY || shx) {
      ctx.fillStyle = '#000';
      if (offY > 0) ctx.fillRect(0, 0, M.W, Math.ceil(offY));
      if (offY < 0) ctx.fillRect(0, M.H + Math.floor(offY), M.W, -Math.floor(offY));
      if (shx > 0) ctx.fillRect(0, 0, shx, M.H);
      if (shx < 0) ctx.fillRect(M.W + shx, 0, -shx, M.H);
    }
    if (this.ending) this.ending.drawOverlay();   // 吹き出しは世界の後・HUDの前
    this.drawHud();
  }
  drawStage1Back() {
    const ctx = M.ctx, FX = REF.bgfx1.maps[this.map.key], theme = REF.map.maps[this.map.key].theme;
    if (FX) {
      for (const [name, key] of [['far', theme === 'sunset' ? 'far_sunset' : 'far_day'], ['mid', theme === 'sunset' ? 'mid_sunset' : 'mid_day']]) {
        const l = FX[name]; if (!l) continue;
        ctx.globalAlpha = l.opacity; ctx.drawImage(M.bg(key), -Math.floor(this.camX * l.factor), l.y || 0); ctx.globalAlpha = 1;
        if (name === 'far' && this.mapId === '1A' && M.layerFx.skytrain) M.layerFx.skytrain(this);   // 2026-10-12 v105 空の奥を空中列車が横切る（遠くの街・建物より奥）
      }
      const sm = M.ANIMS.bgfx_smoke;
      FX.smoke.forEach(([x, y], k) => {
        const sx = x - this.camX; if (sx < -20 || sx > M.W + 20) return;
        ctx.globalAlpha = REF.bgfx1.effects.smoke.opacity;
        M.drawAnim('bgfx_smoke', Math.floor((this.fxTime + k * 130) / sm.dur[0]) % 4, sx, y, true);
        ctx.globalAlpha = 1;
      });
    }
    ctx.drawImage(M.bg('map_' + this.map.key), -Math.round(this.camX), 0);
  }
  drawFrontFx(FX) {
    if (!FX) return;
    const ctx = M.ctx, t = this.fxTime;
    FX.lights.forEach(([wx, y], j) => {
      const x = Math.round(wx - this.camX); if (x < -27 || x > M.W + 27) return;
      const a = 0.035 + 0.045 * (0.5 + 0.5 * Math.sin(t / 190 + j * 1.7));
      const g = ctx.createRadialGradient(x, y, 0, x, y, 26);
      g.addColorStop(0, `rgba(255,200,85,${a})`); g.addColorStop(1, 'rgba(255,200,85,0)');
      ctx.fillStyle = g; ctx.fillRect(x - 26, y - 26, 52, 52);
    });
    let visible = 0;
    for (const [x, y, period, phase] of FX.sparks) {
      const sx = x - this.camX; if (sx < -24 || sx > M.W + 24) continue;
      const age = (t + phase) % period;
      if (age < 200 && visible < 2) {
        ctx.globalAlpha = REF.bgfx1.effects.electric.opacity;
        M.drawAnim('bgfx_electric', age < 40 ? 0 : age < 90 ? 1 : age < 140 ? 2 : 3, sx, y, true);
        ctx.globalAlpha = 1; visible++;
      }
    }
  }
  drawDebug() {
    const ctx = M.ctx;
    const hb = (h, col) => { ctx.strokeStyle = col; ctx.strokeRect(Math.round(h.x0 - this.camX) + 0.5, Math.round(h.y - h.z1) + 0.5, Math.round(h.x1 - h.x0), Math.round(h.z1 - h.z0)); };
    for (const a of [this.mika, this.robot, ...this.enemies, ...this.props]) if (a.hurtbox) hb(a.hurtbox(), '#0f0');
    for (const d of this.debugBoxes) hb(d.box, d.color);
    for (const p of this.map.portals) { ctx.strokeStyle = '#f0f'; ctx.strokeRect(Math.round(p.x - this.camX - 18) + 0.5, Math.max(p.y, this.walkY[0]) - 12 + 0.5, 36, 24); }
    M.text(`${this.mapId} ${this.sec ? this.sec.section_id : ''} Q${this.queue.length} A${this.sec ? this.waveAlive() : 0} F${this.enemies.filter((e) => e.fixed && !e.dead).length} ${this.mika.state}`, 4, 200, { color: '#8f8' });
  }

  // HPゲージ: 背景に直接重ね、黄（残り）／赤（減った分）
  drawBar(x, y, w, h, ratio, right) {
    const ctx = M.ctx;
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(x + 2, y + 2, w, h);
    ctx.fillStyle = '#1a1020'; ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = '#c4271d'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#8e1912'; ctx.fillRect(x, y + h - 2, w, 2);
    const fw = Math.round(w * clamp(ratio, 0, 1)), fx = right ? x + w - fw : x;
    ctx.fillStyle = '#ffd52e'; ctx.fillRect(fx, y, fw, h);
    ctx.fillStyle = '#fff3a8'; ctx.fillRect(fx, y + 1, fw, 2);
    ctx.fillStyle = '#e0a514'; ctx.fillRect(fx, y + h - 2, fw, 2);
  }
  // 2026-10-11 相手の顔・名前・HP。right=true はロボ側（右寄せ・顔は右端）
  drawTarget(e, right, fy) {
    const U = T.ui, ctx = M.ctx;
    const X = (x, w) => (right ? M.W - x - w : x);   // 左用の座標を右側へ映す
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(X(5, 26) + 3, fy + 2, 24, 24);
    ctx.fillStyle = '#1a1020'; ctx.fillRect(X(5, 26), fy - 1, 26, 26);
    const faceId = e.def.enemy_id, face = 'enemy_face_' + faceId;
    if (REF.faces.enemies[faceId] && M.ATLAS.frames[face]) M.drawFrame(face, X(6, 24), fy, [0, 0], false);
    else {
      // 顔アイコン未制作の敵（メガゴブリン・メガメガ・ツギラ）: 待機の絵を枠に収めて表示
      const a = M.ANIMS[e.fam.idle], fr = a && M.ATLAS.frames[a.frames[0]];
      if (fr) {
        const s = Math.min(22 / fr[3], 22 / fr[4], 1);
        ctx.save(); ctx.beginPath(); ctx.rect(X(6, 24), fy, 24, 24); ctx.clip();
        M.drawFrameX(a.frames[0], X(18, 0), fy + 12, { ax: fr[5] + fr[3] / 2, ay: fr[6] + fr[4] / 2, scale: s, smooth: true, flip: !!a.left });
        ctx.restore();
      } else M.text('?', X(18, 0), fy + 9, { color: '#9ab', align: 'center' });
    }
    M.text(e.name, right ? M.W - 36 : 36, fy + 1, { color: '#cfe', align: right ? 'right' : 'left' });
    this.drawBar(X(36, U.targetBarW), fy + 11, U.targetBarW, U.targetBarH, e.hp / e.maxHp, right);
  }
  drawHud() {
    const m = this.mika, r = this.robot, U = T.ui, ctx = M.ctx;
    const H = U.hpBarH, BW = U.hpBarW;
    M.text('MIKA', 6, 3);
    this.drawBar(6, 12, BW, H, m.hp / m.maxHp);
    M.text('ROBOT', M.W - 6, 3, { align: 'right' });
    this.drawBar(M.W - 6 - BW, 12, BW, H, r.hp / r.maxHp, true);
    if (r.state === 'broken') M.text('REPAIR ' + Math.max(0, Math.ceil((T.robot.repairMs - (r.repairT || 0)) / 1000)), M.W - 6, 29, { align: 'right', color: '#8dff9c' });
    M.text('G ' + String(this.run.score).padStart(7, '0'), M.W / 2, 3, { align: 'center', color: '#ffd84a' });
    if (this.kind !== 'room') {
      const tcol = this.time <= 30 && ((Date.now() / 250) | 0) % 2 ? '#ff5a4a' : '#fff';
      M.text('TIME', M.W / 2, 13, { align: 'center', color: '#cfe' });
      M.text(String(this.time).padStart(3, '0'), M.W / 2, 22, { align: 'center', color: tcol });
    }
    // 武器: アイコンと残り（回数・秒）
    if (false && m.weapon) {   // 2026-10-08 武器のアイコンと残りはミカの頭の上へ移動（mika.js）
      const W = M.WEAPONS[m.weapon.id], left = m.weaponLeft();
      const ix = 6 + BW + 6;
      M.drawFrame(W.icon, ix + 14, 26, [16, 16], false);
      M.text(W.seconds ? String(Math.ceil(left / 1000)) + 'S' : 'X' + left, ix + 2, 27, { color: '#9ff' });
    }
    // 攻撃が命中した相手の顔・名前・HP（ミカの相手は左＝ミカの下、ロボの相手は右＝ロボの下）
    const cs = this.clearSeq, hideBoss = (cs && ['pose', 'tally', 'fade'].includes(cs.phase)) || this.ending;
    const bosses = hideBoss ? [] : this.bosses.filter((b) => b.showBar && !(b.hp <= 0 && b.reported));
    const e = this.lastTarget;
    if (e && this.lastTargetT > 0 && !e.remove && !e.boss) this.drawTarget(e, false, 12 + H + 6);
    const er = this.lastTargetR;
    if (er && this.lastTargetRT > 0 && !er.remove && !er.boss) this.drawTarget(er, true, 12 + H + 6 + (r.state === 'broken' ? 9 : 0) + bosses.length * 30);
    // ボスの名前とゲージ（右側、ロボのゲージの下）
    bosses.forEach((b, k) => {
      const bw = T.ui.hpBarW, bx = M.W - 6 - bw, top = 12 + T.ui.hpBarH + 5 + k * 30 + (r.state === 'broken' ? 9 : 0);
      M.jpText(b.name, M.W - 6 - M.jpWidth(b.name), top + 16, { color: '#ffe9a6' });
      this.drawBar(bx, top + 20, bw, T.ui.bossBarH, b.hp / b.maxHp, true);
    });
    const UI = M.REF.uiManifest.assets;
    // 2026-10-12 v103 GO の音（ピピッ×3、0.56秒ごと）に合わせて最初の3回は点滅を揃える。その間は進んでも消さない
    const goOn = this.go && (this.go.snd && this.go.t < GO_SYNC.period * GO_SYNC.count ? this.go.t % GO_SYNC.period < GO_SYNC.on
      : (this.go.t % (UI.go.blink_ms[0] + UI.go.blink_ms[1])) < UI.go.blink_ms[0]);
    if (goOn) {
      const ex = this.map.exit;
      if (this.go.exit && ex && ex.mode === 'up') this.drawUpMarker(ex.x - this.camX, ex.y - 56);
      else if (this.rtl) {
        // 2026-10-11 左向きのGO: 絵全体を反転すると文字まで「!OG」になるので、矢印（右側26px）だけ反転して文字の前に置く
        const f = M.ATLAS.frames.go_arrow, [pg, sx, sy, w, h, ox, oy] = f, cut = 44, aw = w - cut;
        const L = M.W - (UI.go.display_center_proposal[0] - UI.go.origin[0] + ox) - w, top = UI.go.display_center_proposal[1] - UI.go.origin[1] + oy;
        const img = M.atlasPage(pg), c = M.ctx;
        c.save(); c.translate(L + aw, top); c.scale(-1, 1); c.drawImage(img, sx + cut, sy, aw, h, 0, 0, aw, h); c.restore();
        c.drawImage(img, sx, sy, cut, h, L + aw, top, cut, h);
      }
      else M.drawFrame('go_arrow', UI.go.display_center_proposal[0], UI.go.display_center_proposal[1], UI.go.origin, false);
    }
    this.mapTitle.draw();
    if (M.Tutor) M.Tutor.draw();
    const c = this.clearSeq;
    if (c && (c.phase === 'pose' || c.phase === 'tally' || c.phase === 'fade')) {
      this.drawStageClear(UI.clear);
      if (c.phase !== 'pose') {
        M.text('TIME BONUS', M.W / 2 - 90, 100, { color: '#fff' });
        M.text(String(c.bonusShown || 0), M.W / 2 + 90, 100, { color: '#ffd84a', align: 'right' });
        M.text('G ' + String(this.run.score).padStart(7, '0'), M.W / 2, 116, { color: '#ffd84a', align: 'center' });
      }
    }
    if (this.over) { M.text('GAME OVER', M.W / 2, 96, { scale: 2, color: '#ff5a4a', align: 'center' }); if (this.over.t > 900) M.text('RETRY THIS AREA', M.W / 2, 120, { color: '#ffd0c8', align: 'center' }); }
    if (this.mika.state === 'defeated' && this.robot.state.startsWith('rescue')) M.text('RESCUE...', M.W / 2, 60, { color: '#9ff', align: 'center' });
    if (this.fade && this.fade.a > 0) { ctx.fillStyle = `rgba(0,0,0,${this.fade.a})`; ctx.fillRect(0, 0, M.W, M.H); }
  }
  drawUpMarker(x, y) {
    const ctx = M.ctx; x = Math.round(x); y = Math.round(y);
    ctx.fillStyle = '#6a1a08';
    ctx.beginPath(); ctx.moveTo(x, y - 9); ctx.lineTo(x + 10, y + 2); ctx.lineTo(x + 4, y + 2); ctx.lineTo(x + 4, y + 10); ctx.lineTo(x - 4, y + 10); ctx.lineTo(x - 4, y + 2); ctx.lineTo(x - 10, y + 2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffe23a';
    ctx.beginPath(); ctx.moveTo(x, y - 7); ctx.lineTo(x + 7, y + 1); ctx.lineTo(x + 3, y + 1); ctx.lineTo(x + 3, y + 8); ctx.lineTo(x - 3, y + 8); ctx.lineTo(x - 3, y + 1); ctx.lineTo(x - 7, y + 1); ctx.closePath(); ctx.fill();
  }
  // STAGE CLEAR の文字と、クリア曲の再生位置5.000秒からの光（文字の形にマスク・背景は光らせない）
  drawStageClear(spec) {
    const ctx = M.ctx, cx = spec.display_center_proposal[0], cy = spec.display_center_proposal[1];
    M.drawFrame('stage_clear', cx, cy, spec.origin, false);
    const pos = this.clearPos(), at = M.AUDIO.clearShineAtMs, dur = M.AUDIO.clearShineMs;
    const c = this.clearSeq;
    if (pos >= at && !c.shineStarted) c.shineStarted = true;     // 5秒をまたいだフレームで一度だけ開始
    if (!c.shineStarted) return;
    const k = (pos - at) / dur;
    if (k < 0 || k > 1.5) return;
    const f = M.ATLAS.frames.stage_clear, cw = f[7], ch = f[8];
    const left = Math.round(cx - spec.origin[0]), top = Math.round(cy - spec.origin[1]);
    if (!this.shineCv) { this.shineCv = document.createElement('canvas'); this.shineCv.width = cw; this.shineCv.height = ch; }
    const g = this.shineCv.getContext('2d');
    g.clearRect(0, 0, cw, ch); g.globalCompositeOperation = 'source-over';
    if (k <= 1) {
      // 細い白〜淡い金の斜めの帯が左→右へ。文字の不透明部分だけに残す
      const bx = -30 + (cw + 60) * k;
      const grd = g.createLinearGradient(bx - 14, 0, bx + 14, 0);
      grd.addColorStop(0, 'rgba(255,240,170,0)'); grd.addColorStop(0.35, 'rgba(255,246,200,0.75)'); grd.addColorStop(0.5, 'rgba(255,255,255,1)');
      grd.addColorStop(0.65, 'rgba(255,246,200,0.75)'); grd.addColorStop(1, 'rgba(255,240,170,0)');
      g.save(); g.translate(bx, 0); g.transform(1, 0, -0.45, 1, 0, 0); g.translate(-bx, 0);
      g.fillStyle = grd; g.fillRect(bx - 14, -10, 28, ch + 20); g.restore();
      g.globalCompositeOperation = 'destination-in';
      M.drawFrameTo(g, 'stage_clear', 0, 0);
      g.globalCompositeOperation = 'source-over';
      ctx.drawImage(this.shineCv, left, top);
    }
    // 右端の小さな四方向の星（光が抜けた後に一度だけ）
    const sk = (pos - at - dur * 0.8) / 260;
    if (sk > 0 && sk < 1) {
      const a = Math.sin(sk * Math.PI), sx = left + cw - 10, sy = top + 6, len = Math.round(2 + 5 * a);
      ctx.globalAlpha = a; ctx.fillStyle = '#fffbe6';
      ctx.fillRect(sx - len, sy, len * 2 + 1, 1); ctx.fillRect(sx, sy - len, 1, len * 2 + 1);
      ctx.fillRect(sx - 1, sy - 1, 3, 3); ctx.globalAlpha = 1;
    }
  }
}
M.World = World;
})();
