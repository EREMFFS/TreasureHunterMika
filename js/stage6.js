// stage6.js — 5I 展望台・5J 宝物庫・6面 脱出・エンディング（2026-10-11 MIKA_STAGE6_RECOVERED_ASSETS_v050）
//   5I: ダークミカ2体（中ボス）→ 宝箱2つ → 最終兵器ウルトラマシーンS（ドクターS）→ 右の扉から5J
//   5J: 宝箱に喜ぶ → カタッ → 長老が出てくる → 長老ファイナルゴブリン戦 → 6A（同じ部屋）
//   6A: 自爆ボタン → HELP ME → 「しょうがない…ついてきな！」 → 脱出！
//   6B〜6F: 長老を連れて脱出（長老はミカの後ろをついて来る。敵がいる間はしゃがんで震える。カメラは長老を置いて行かない）
//           6B〜6Eの行き止まりで床を殴って穴を開け、下の階へ飛び降りる。6C・6D・6Eはダンダルモン、6Fはダークミカ4体
//   エンディング: 列車777で街を離れる → 街が大爆発 → スタッフロール → THE END → タイトル
//   セリフは data/story6.js。時間・威力は [仮]
'use strict';
(function () {
const M = window.MIKA, T = M.TUNING;
const { clamp, rand, sign, approach } = M;
const W = () => M.world;
const S6 = () => M.STORY6;
const Boss = M.bossBase();

// ================================================================== 小道具: 吹き出し・警報・チャイム
// who: 役者（x, y, z を持つ）か 'sys'（館内放送の帯）か 'title'（大きな文字）
function say(w, who, text, ms = 1800, o = {}) { (w.s6say = w.s6say || []).push(Object.assign({ who, text, t: 0, ms, head: 52 }, o)); }
function updateSay(w, dt) { if (w.s6say) w.s6say = w.s6say.filter((s) => (s.t += dt) < s.ms); }
function drawSay(w) {
  const ctx = M.ctx;
  for (const s of w.s6say || []) {
    const a = Math.min(1, s.t / 80, (s.ms - s.t) / 150);
    ctx.globalAlpha = Math.max(0, a);
    if (s.who === 'sys') {
      // 館内放送: 「。」で行を分けて中央に（画面からはみ出さない）
      const lines = s.text.split('。').filter((x) => x.trim()).map((x) => x + '。'), h = 6 + lines.length * 15;
      ctx.fillStyle = 'rgba(60,0,0,0.72)'; ctx.fillRect(0, 34, M.W, h);
      ctx.fillStyle = 'rgba(255,80,60,0.8)'; ctx.fillRect(0, 34, M.W, 1); ctx.fillRect(0, 33 + h, M.W, 1);
      lines.forEach((ln, i) => M.jpText(ln, Math.round(M.W / 2 - M.jpWidth(ln) / 2), 50 + i * 15, { color: '#ffe6d0', edge: '#3a0000' }));
    } else if (s.who === 'title') {
      const k = s.t < 160 ? 1.6 - 0.6 * (s.t / 160) : 1, sc = 3 * k, tw = M.jpWidth(s.text);
      ctx.save(); ctx.translate(M.W / 2, 104); ctx.scale(sc, sc);
      M.jpText(s.text, -tw / 2, 6, { color: '#ffdf4a', edge: '#6a1a08' });
      ctx.restore();
    } else {
      const o = s.who, tw = M.jpWidth(s.text), bw = tw + 10, bh = 17;
      const sx = Math.round(o.x - w.camX), top = Math.round(o.y - (o.z || 0) - s.head - bh - 6);
      const bx = clamp(sx - (bw >> 1), 4, M.W - bw - 4);
      ctx.fillStyle = '#1a1020'; ctx.fillRect(bx - 1, top - 1, bw + 2, bh + 2);
      ctx.fillStyle = s.color || '#fffaf0'; ctx.fillRect(bx, top, bw, bh);
      ctx.fillStyle = '#1a1020'; ctx.fillRect(clamp(sx - 2, bx + 3, bx + bw - 7), top + bh + 1, 4, 2); ctx.fillRect(clamp(sx - 1, bx + 4, bx + bw - 6), top + bh + 3, 2, 2);
      M.jpText(s.text, bx + 5, top + 14, { color: '#1a1020', edge: s.color || '#fffaf0' });
    }
    ctx.globalAlpha = 1;
  }
}
function boom(w, x, y, z, n = 1) {
  for (let i = 0; i < n; i++) w.effects.push(new M.Effect({ x: x + rand(-14, 14), y: y + 0.6, z: z + rand(0, 18), anim: new M.Anim('rocket_explosion'), life: 500 }));
  M.Audio.play('explosion');
}

// ================================================================== 文字で出すボス登場（肩書・名前の画像がないボス用）
//   BossIntro と同じ流れ: 曲を消す → ミカが左へ → ボスの登場 → 1文字ずつ「ダン！」 → 1.2秒 → 弾けて戦闘曲
const LOGO = { x: 32, y: 40 };
const GLYPH = { scale: [0.75, 0.8], y: [70, 108] };   // 2026-10-12 v069 絵の文字: 行ごとの倍率（肩書・本名）と中心y   // 2026-10-12 v066 ロゴの左上（中心 192,88）
class TextIntro {
  constructor(w, boss, names, music, onCombat, logo) {
    this.w = w; this.boss = boss; this.music = music; this.onCombat = onCombat;
    this.phase = 'fade'; this.t = 0; this.letters = []; this.parts = []; this.done = false; this.next = 0;
    this.lines = [Array.from(names.epithet), Array.from(names.name)];
    // 2026-10-12 v069: 一文字ずつの絵の文字（data/boss_logo_assets_v069.js）。あれば jpText の代わりに、同じ時間割・拡大で描く。
    //   文字列が素材と一致しない時は従来の文字（v066 の一枚絵ロゴは使わなくなった）
    const G = M.BOSS_LOGO_GLYPHS_V069 && M.BOSS_LOGO_GLYPHS_V069.bosses[logo];
    this.gl = G && ['epithet', 'name'].every((k, li) => G.lines[k].glyphs.map((g) => g.char).join('') === this.lines[li].join('')) ? G : null;
    this.logo = null; this.glKey = logo;
    this.sched = [];
    this.lines[0].forEach((c, i) => this.sched.push({ c, line: 0, i, at: i * 170 }));
    const base = this.lines[0].length * 170 + 280;
    this.lines[1].forEach((c, i) => this.sched.push({ c, line: 1, i, at: base + i * 120 }));
    this.burstAt = this.sched[this.sched.length - 1].at + 1200;
    w.lockInput = true; w.timerRunning = false;
    const m = w.mika;
    m.endWeaponHold();
    if (!['idle', 'walk'].includes(m.state) || m.z > 0) { m.z = 0; m.vx = 0; m.move = null; m.wmove = null; }
    m.setState('idle', 'idle');
    const tx = w.camX + (T.bossTuning.introMikaX || 64), ty = (w.walkY[0] + w.walkY[1]) / 2;
    this.arrived = Math.abs(m.x - tx) <= 2 && Math.abs(m.y - ty) <= 2;
    if (this.arrived) m.face = 1; else m.goTo(tx, ty, () => { m.face = 1; this.arrived = true; });
    M.Audio.fadeOutMusic(700);
  }
  get busy() { return !this.done; }
  scale(line) {   // 名前は画面に収まる大きさまで（最大3倍）
    if (!line) return 2;
    const wd = this.lines[1].reduce((a, c) => a + M.jpWidth(c), 0);
    return Math.max(1, Math.min(2.5, Math.floor((M.W - 40) / 1.15 / wd * 4) / 4));   // 出る瞬間の拡大（最大1.4倍）でもはみ出さない程度
  }
  // v069 絵の文字: 行の倍率・文字の中心x（字間 advance で並べる）
  gScale(line) { return GLYPH.scale[line]; }
  gX(l) {
    const gs = this.gl.lines[l.line ? 'name' : 'epithet'].glyphs, sc = this.gScale(l.line);
    const total = gs.reduce((a, g) => a + g.advance, 0) * sc, before = gs.slice(0, l.i).reduce((a, g) => a + g.advance, 0);
    return M.W / 2 - total / 2 + (before + gs[l.i].advance / 2) * sc;
  }
  glyphX(l) {
    const sc = this.scale(l.line), ch = this.lines[l.line];
    const total = ch.reduce((a, c) => a + M.jpWidth(c), 0) * sc;
    return M.W / 2 - total / 2 + ch.slice(0, l.i).reduce((a, c) => a + M.jpWidth(c), 0) * sc;
  }
  update(dt) {
    this.t += dt;
    for (const l of this.letters) l.age += dt;
    for (const p of this.parts) p.age += dt;
    this.parts = this.parts.filter((p) => p.age < 900);
    if (this.phase === 'fade' && this.t >= 700 && (this.arrived || this.t >= 5700)) {
      if (!this.arrived) { const m = this.w.mika; m.autoGoal = null; m.setState('idle', 'idle'); m.face = 1; this.arrived = true; }
      M.Audio.stopMusic();
      this.phase = 'entrance'; this.t = 0;
      this.boss.beginEntrance(() => { if (this.phase === 'entrance') { this.phase = 'title'; this.t = 0; this.face(); } });
    } else if (this.phase === 'title') {
      while (this.next < this.sched.length && this.t >= this.sched[this.next].at) { this.letters.push(Object.assign({ age: 0 }, this.sched[this.next++])); M.Audio.play('boss_title_dan'); }
      if (this.t >= this.burstAt) this.burst();
    }
  }
  face() { const { mika, robot } = this.w, b = this.boss; mika.face = b.x >= mika.x ? 1 : -1; robot.face = b.x >= robot.x ? 1 : -1; b.face = mika.x >= b.x ? 1 : -1; }
  burst() {
    const lg = this.logo && M.bg(this.logo);
    if (lg) {   // 絵のロゴ: 絵の範囲から同じように散らす
      for (let k = 0; k < 90; k++) {
        const ang = rand(0, Math.PI * 2), sp = rand(40, 110), x = LOGO.x + rand(20, 300), y = LOGO.y + rand(10, 86);
        this.parts.push({ x, y, vx: Math.cos(ang) * sp + (x - 192) * 0.5, vy: Math.sin(ang) * sp - 30, age: 0, s: rand(2, 5), c: y > LOGO.y + 48 ? '#ffe9a6' : '#ffffff' });
      }
    }
    if (this.gl) for (const l of this.letters) {   // v069 絵の文字: 文字の範囲から散らす
      const sc = this.gScale(l.line), x = this.gX(l), y = GLYPH.y[l.line], r = 20 * sc;
      for (let k = 0; k < 7; k++) {
        const ang = rand(0, Math.PI * 2), sp = rand(40, 110), px = x + rand(-r, r), py = y + rand(-r, r);
        this.parts.push({ x: px, y: py, vx: Math.cos(ang) * sp + (px - 192) * 0.5, vy: Math.sin(ang) * sp - 30, age: 0, s: rand(2, 5), c: l.line ? '#ffe9a6' : '#ffffff' });
      }
    }
    for (const l of (lg || this.gl ? [] : this.letters)) {
      const sc = this.scale(l.line), x = this.glyphX(l), y = l.line ? 112 : 74, cw = M.jpWidth(l.c) * sc;
      for (let k = 0; k < 7; k++) {
        const ang = rand(0, Math.PI * 2), sp = rand(40, 110);
        this.parts.push({ x: x + rand(0, cw), y: y - rand(0, 12 * sc), vx: Math.cos(ang) * sp + (x - 192) * 0.5, vy: Math.sin(ang) * sp - 30, age: 0, s: rand(2, 5), c: l.line ? '#ffe9a6' : '#ffffff' });
      }
    }
    this.letters = [];
    this.phase = 'battle'; this.done = true;
    M.Audio.playMusic(this.music);
    M.Audio.voice('boss_encount');
    this.w.lockInput = false; this.w.timerRunning = true;
    this.onCombat && this.onCombat();
  }
  draw() {
    const ctx = M.ctx, lg = this.logo && M.bg(this.logo);
    if (lg && this.letters.length) {
      // 文字が1つ出るごと（ダン！の音）に、絵を左から少しずつ現す（上下の段は斬撃で重なっているので全体を一緒に）。
      //   出るたびに少し大きく → 戻る。全部出たら止まって、文字の時と同じ時刻に散って消える
      const n = this.sched.length, k = this.letters.length, last = this.letters[k - 1];
      const u = Math.min(1, (k - 1 + Math.min(1, last.age / 90)) / n), wd = Math.ceil(320 * (k >= n ? 1 : u));
      const pop = 1 + 0.06 * Math.max(0, 1 - last.age / 120);
      ctx.save(); ctx.translate(LOGO.x + 160, LOGO.y + 48); ctx.scale(pop, pop); ctx.translate(-160, -48);
      if (wd > 0) ctx.drawImage(lg, 0, 0, wd, 96, 0, 0, wd, 96);
      ctx.restore();
    }
    if (this.gl) for (const l of this.letters) {   // v069 絵の文字: 出た瞬間1.4倍 → 0.09秒で元の大きさ（文字の時と同じ）
      const sc = this.gScale(l.line) * (1 + 0.4 * Math.max(0, 1 - l.age / 90));
      M.drawBossLogoGlyphV069(this.glKey, l.line ? 'name' : 'epithet', l.i, this.gX(l), GLYPH.y[l.line], { scale: sc });
    }
    for (const l of (lg || this.gl ? [] : this.letters)) {
      const sc = this.scale(l.line) * (1 + 0.4 * Math.max(0, 1 - l.age / 90)), x = this.glyphX(l), y = l.line ? 112 : 74;
      const cw = M.jpWidth(l.c) * this.scale(l.line);
      ctx.save(); ctx.translate(x + cw / 2, y); ctx.scale(sc, sc);
      M.jpText(l.c, -M.jpWidth(l.c) / 2, 0, { color: l.line ? '#ffe9a6' : '#ffffff', edge: '#3a0a10' });
      ctx.restore();
    }
    for (const p of this.parts) {
      const q = p.age / 900;
      ctx.globalAlpha = 1 - q; ctx.fillStyle = p.c;
      ctx.fillRect(Math.round(p.x + p.vx * q), Math.round(p.y + p.vy * q + 85 * q * q), p.s, p.s);
    }
    ctx.globalAlpha = 1;
  }
}
M.TextIntro = TextIntro;

// ================================================================== 最終兵器ウルトラマシーンS（5Iのボス。ドクターSが乗る円盤）
//   浮いたまま左右へゆっくり。床に照準 → 追う → 止まって点滅 → 斜めのレーザー（3回に1回は3本）→ 降りてきて隙（殴りやすい）
const UM = T.ultraMachine = Object.assign({
  hoverZ: 30, lowZ: 4, idleMs: 1000, aimMs: 1000, aimLateMs: 700, lockMs: 650, fireMs: 450, recoverMs: 1250,
  aimSpeed: 150, driftSpeed: 46, laserDmg: 16,   // 2026-10-11 レーザーの威力を倍（8→16） fanEvery: 3, fanEveryLate: 2, fanGap: 56, score: 50000,
  // 2026-10-11 ユーザー指定: 強く。円盤の左右と中央のランプから、ダンダルモンの砲台と同じ弾（ゆっくり追尾→近づいたらまっすぐ）。頻繁にワープ
  volleyWarnMs: 550, roundSpeed: 88, roundTurn: 2.2, roundStraightDist: 56, roundDmg: 3, roundLifeMs: 5200,
  lamps: [[-66, 40], [0, 30], [66, 40]],   // 足元からの [横, 高さ]（絵の左右と中央の赤いランプ）
  warpOutMs: 260, warpInMs: 260, warpChancePerSec: 0.45, warpAfterAttack: 0.7, warpMinDist: 110,
  // 2026-10-11 ユーザー指定: 後半（HP半分以下）は速く。移動・照準・弾の速さ×lateSpeed、待ち・溜め・隙の時間×lateTime
  lateSpeed: 1.6, lateTime: 0.65,
  // 撃破: 円盤は爆発するが、ドクターSは生き残ってニヤリ → ワープして消える
  // 撃破（v057/v058）: 画面x267・足元y174・高さ38へ流れて、1.6秒で大爆発・0.35秒で消える
  defeat: { boomMs: 3000, fadeMs: 350, x: 267, y: 174, z: 38 },   // 2026-10-12 連続爆発3秒→大爆発
}, T.ultraMachine || {});
class UltraS extends Boss {
  constructor(x, y, o) {
    super(x, y, { hp: o.hp, id: 'ultra_machine_s', score: UM.score });
    this.bodyW = 120; this.bodyH = 70; this.shadowW = 0; this.face = -1;
    this.state = 'wait'; this.z = 220; this.n = 0; this.marks = []; this.lowHpBlink = true; this.rounds = [];
  }
  get name() { return S6().bossNames.ultra_machine_s.name; }
  get late() { return this.hp / this.maxHp <= 0.5; }
  get sp() { return this.late ? UM.lateSpeed : 1; }   // 後半の速さ
  get tm() { return this.late ? UM.lateTime : 1; }    // 後半の時間（短く）
  canBeHit() { return !['wait', 'enter', 'dying', 'warpout', 'warpin'].includes(this.state) && !this.gone; }
  hurtbox() { return { x0: this.x - 58, x1: this.x + 58, y: this.y, z0: this.z, z1: this.z + 70 }; }
  beginEntrance(done) { this.doneCb = done; this.state = 'enter'; this.st = 0; this.x0 = this.x; this.showBar = true; M.Audio.play('drs_appear'); }   // 2026-10-12 v108 ドクターS出現の正式な音（前は仮の warp）
  takeHit(att, info) { this.baseHit(att, info); return true; }
  onDefeated() {
    this.state = 'dying'; this.st = 0; this.marks = []; this.rounds = []; this.expT = 0; this.alpha = 1;
    W().run.score += this.def.score;
    if (this.onDeath) this.onDeath(this);
  }
  update(dt) {
    this.tick(dt);
    if (this.freeze > 0) { this.freeze -= dt; return; }
    const w = W(), s = dt / 1000, tg = this.target();
    this.st += dt;
    const bob = Math.sin(w.fxTime / 260) * 3;
    this.updateRounds(dt, tg);
    switch (this.state) {
    case 'wait': break;
    case 'enter': {
      const k = clamp(this.st / 1600, 0, 1), e = 1 - (1 - k) * (1 - k);
      this.z = 220 + (UM.hoverZ - 220) * e;
      if (k >= 1) { this.state = 'idle'; this.st = 0; this.cool = 800; this.doneCb && this.doneCb(); this.doneCb = null; }
      break;
    }
    case 'idle':
      this.z = approach(this.z, UM.hoverZ + bob, 60 * s);
      this.drift(tg, s);
      if (this.active && !w.holdAttacks && Math.random() < UM.warpChancePerSec * this.sp * dt / 1000) { this.beginWarp(); break; }
      if (this.active && !w.holdAttacks && (this.cool -= dt) <= 0 && tg) { if (this.n % 2 === 1) this.beginVolley(); else this.beginAim(tg); }
      break;
    case 'volley': {   // ランプが点滅（予兆）→ 左右・中央から3発
      this.z = approach(this.z, UM.hoverZ + bob, 60 * s);
      if (this.st >= UM.volleyWarnMs * this.tm) {
        for (const [lx, lz] of UM.lamps) {
          const x = this.x + lx, z = this.z + lz, y = this.y + 0.5;
          const a = tg ? Math.atan2(tg.y - y, tg.x - x) : Math.PI;
          this.rounds.push({ x, y, z, vx: Math.cos(a) * UM.roundSpeed * this.sp, vy: Math.sin(a) * UM.roundSpeed * this.sp * 0.5, vz: -20, t: 0, hits: new Set(), homing: true, sp: this.sp });
          w.effects.push(new M.Effect({ x, y: y + 0.5, z, anim: new M.Anim('dand_tflash'), life: 160 }));
        }
        if (M.Tutor) M.Tutor.show('djump');   // 2026-10-12 v104 初めての追尾弾で二段ジャンプの説明（避け方のヒント）
        M.Audio.play('gun', { gain: 0.7, rate: 0.75 });
        this.n++; this.state = 'idle'; this.st = 0; this.cool = UM.idleMs * this.tm * this.coolMul * rand(0.8, 1.2);
        if (Math.random() < UM.warpAfterAttack) this.beginWarp();
      }
      break;
    }
    case 'warpout':
      this.alpha = Math.max(0, 1 - this.st / UM.warpOutMs);
      if (this.st >= UM.warpOutMs) {
        // ミカから離れた場所へ（画面の中）
        for (let k = 0; k < 12; k++) { this.x = rand(w.camX + 70, w.camX + M.W - 70); this.y = rand(w.walkY[0], w.walkY[1]); if (!tg || Math.abs(this.x - tg.x) >= UM.warpMinDist) break; }
        this.state = 'warpin'; this.st = 0;   // 2026-10-12 ワープの音は消える時の1回（SE_DR_S_UFO_WARP は出てくるまでの長さがある）
      }
      break;
    case 'warpin':
      this.alpha = Math.min(1, this.st / UM.warpInMs); this.z = UM.hoverZ + bob;
      if (this.st >= UM.warpInMs) { this.alpha = 1; this.state = 'idle'; this.st = 0; this.cool = Math.max(this.cool, 500); }
      break;
    case 'aim':
      this.z = approach(this.z, UM.hoverZ + bob, 60 * s);
      this.drift(tg, s * 0.5);
      if (tg) for (const m of this.marks) { m.x = approach(m.x, clamp(tg.x + m.off, w.camX + 12, w.camX + M.W - 12), UM.aimSpeed * this.sp * s); m.y = approach(m.y, tg.y, UM.aimSpeed * this.sp * 0.6 * s); }
      if (this.st >= (this.late ? UM.aimLateMs : UM.aimMs)) { this.state = 'lock'; this.st = 0; M.Audio.play('lockon'); M.Audio.duckBgm(0.6, 750); }   // 2026-10-12 ロック音（SE_LOCKON）
      break;
    case 'lock':
      if (this.st >= UM.lockMs * this.tm) { this.state = 'fire'; this.st = 0; this.att = { hits: new Set(), x: this.x, freeze: 0 }; M.Audio.play('laser'); w.shake = 1; }
      break;
    case 'fire':
      for (const m of this.marks) M.applyAttack(this.att, { x0: m.x - 11, x1: m.x + 11, y: m.y, depth: 9, z0: 0, z1: 200 }, [w.mika, w.robot], { dmg: UM.laserDmg, type: 'launch', dir: sign(w.mika.x - m.x) || 1, strike: false, ranged: true });
      if (this.st >= UM.fireMs) { this.state = 'recover'; this.st = 0; this.marks = []; }
      break;
    case 'recover':
      // 撃った後は床近くまで降りてくる（殴りやすい隙）
      this.z = approach(this.z, this.st < UM.recoverMs * this.tm - 350 ? UM.lowZ : UM.hoverZ, 90 * this.sp * s);
      if (this.st >= UM.recoverMs * this.tm) { this.state = 'idle'; this.st = 0; this.cool = UM.idleMs * this.tm * this.coolMul * rand(0.8, 1.2); if (Math.random() < UM.warpAfterAttack) this.beginWarp(); }
      break;
    case 'dying': this.updateDying(dt); break;
    }
    if (this.state !== 'dying') { this.x = clamp(this.x, w.camX + 64, w.camX + M.W - 64); this.y = clamp(this.y, w.walkY[0], w.walkY[1]); }
    // 2026-10-11 ユーザー指定: ドクターSはミカの方を向く（絵は右向き。左にいる時は反転）。真上付近ではパタパタしないよう少し余裕
    if (tg && !['dying', 'escape', 'wait'].includes(this.state)) { if (tg.x > this.x + 6) this.face = 1; else if (tg.x < this.x - 6) this.face = -1; }
  }
  drift(tg, s) {
    if (!tg) return;
    const side = this.x >= tg.x ? 1 : -1, want = tg.x + side * 96;
    this.x = approach(this.x, want, UM.driftSpeed * this.sp * s); this.y = approach(this.y, tg.y, 22 * this.sp * s);
  }
  beginWarp() { this.state = 'warpout'; this.st = 0; this.marks = []; M.Audio.play('ufo_warp'); W().effects.push(new M.Effect({ x: this.x, y: this.y + 0.5, z: this.z + 20, anim: new M.Anim('qfx_warp'), life: 300 })); }
  beginVolley() { this.state = 'volley'; this.st = 0; M.Audio.play('warp', { rate: 2, gain: 0.5 }); }
  // ランプの弾: 相手へゆっくり曲がりながら近づき、一定の距離まで来たら曲がるのをやめてまっすぐ進む
  updateRounds(dt, tg) {
    const s = dt / 1000, w = W();
    for (const r of this.rounds) {
      r.t += dt;
      if (r.homing && tg) {
        const dx = tg.x - r.x, dy = (tg.y - r.y) * 2, d = Math.hypot(dx, dy);
        if (d < UM.roundStraightDist) r.homing = false;
        else {
          const want = Math.atan2(dy, dx), cur = Math.atan2(r.vy * 2, r.vx);
          let da = want - cur; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
          const a = cur + clamp(da, -UM.roundTurn * s, UM.roundTurn * s);
          r.vx = Math.cos(a) * UM.roundSpeed * (r.sp || 1); r.vy = Math.sin(a) * UM.roundSpeed * (r.sp || 1) * 0.5;
          r.vz = clamp((22 - r.z) * 1.5, -60, 60);
        }
      }
      r.x += r.vx * s; r.y += r.vy * s; r.z = Math.max(2, r.z + r.vz * s);
      const att = { hits: r.hits, x: r.x - Math.sign(r.vx || 1) * 5, freeze: 0, kind: 'round' };
      const n = M.applyAttack(att, { x0: r.x - 4, x1: r.x + 4, y: r.y, depth: 6, z0: r.z - 5, z1: r.z + 5 }, [w.mika, w.robot], { dmg: UM.roundDmg, type: 'light', dir: Math.sign(r.vx) || 1, strike: false, ranged: true });
      if (n || r.t > UM.roundLifeMs || r.x < w.camX - 30 || r.x > w.camX + M.W + 30) r.dead = true;
    }
    this.rounds = this.rounds.filter((r) => !r.dead);
  }
  beginAim(tg) {
    this.n++;
    const fan = this.n % (this.late ? UM.fanEveryLate : UM.fanEvery) === 0;
    this.marks = (fan ? [-UM.fanGap, 0, UM.fanGap] : [0]).map((off) => ({ off, x: tg.x + off, y: tg.y }));
    this.state = 'aim'; this.st = 0;
    M.Audio.play('warp', { rate: 1.2, gain: 0.5 });
  }
  // 2026-10-12 v057/v058: 円盤は画面の右寄りへ流れながら、1面ボスと同じ連続爆発（爆発音＋断末魔）→ 最後に大爆発して消える
  //   （残骸とドクターSは 5I の演出 doctorEvent が描く。大爆発の瞬間が演出の1.6秒）
  updateDying(dt) {
    const w = W(), s = dt / 1000, D = UM.defeat;
    if (!this.blastBig) {
      this.x = approach(this.x, w.camX + D.x, 160 * s); this.y = approach(this.y, D.y, 60 * s); this.z = approach(this.z, D.z, 60 * s);
      if (M.bossBlast(this, dt, { ms: D.boomMs, dx: 55, z0: 5, z1: 55, big: 10 })) this.burstAt = this.st;
    }
    const since = this.blastBig ? this.st - this.burstAt : -1;
    this.alpha = since < 0 ? 1 : Math.max(0, 1 - since / D.fadeMs);
    if (since >= D.fadeMs && !this.reported) { this.reported = true; this.gone = true; this.alpha = 0; this.showBar = false; this.onDeathDone && this.onDeathDone(this); }
  }
  draw() {
    if (this.state === 'wait' || this.gone) return;
    const w = W(), ctx = M.ctx, sx = Math.round(this.x - w.camX), k = clamp(1 - this.z / 200, 0.3, 1);
    ctx.fillStyle = `rgba(0,0,0,${0.3 * k})`; ctx.beginPath(); ctx.ellipse(sx, Math.round(this.y), 46 * k + 8, 6, 0, 0, Math.PI * 2); ctx.fill();
    const jit = this.state === 'dying' ? Math.round(rand(-2, 2)) : 0;
    const low = this.hp > 0 && this.hp / this.maxHp < 0.25 && ((w.fxTime / 160) | 0) % 2;
    if (this.flashT > 0 || low) { ctx.save(); ctx.filter = low ? 'sepia(1) saturate(6) hue-rotate(-50deg) brightness(0.95)' : 'brightness(1.7)'; }
    M.drawAnim('ultra_machine_s', 0, sx + jit, Math.round(this.y - this.z), this.face < 0, this.alpha);   // 2026-10-12 ユーザー指定: 向きを逆に（ミカの方を向く）
    if (this.flashT > 0 || low) ctx.restore();
  }
  // 照準とレーザーは役者の前に描く（5Iのフックから）
  drawOver() {
    if (this.gone || this.state === 'dying') return;
    const w = W(), ctx = M.ctx, ex = Math.round(this.x - w.camX), ey = Math.round(this.y - this.z - 4);
    if (this.state === 'volley' && ((this.st / 70) | 0) % 2) for (const [lx, lz] of UM.lamps) { ctx.fillStyle = 'rgba(255,70,50,0.85)'; ctx.beginPath(); ctx.arc(ex + lx, Math.round(this.y - this.z - lz), 4, 0, Math.PI * 2); ctx.fill(); }
    for (const r of this.rounds) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(Math.round(r.x - w.camX) - 2, Math.round(r.y), 4, 1);
      M.drawFrameX('dand_round', r.x - w.camX, r.y - r.z, { flip: r.vx > 0 });
    }
    for (const m of this.marks) {
      const mx = Math.round(m.x - w.camX), my = Math.round(m.y);
      if (this.state === 'aim' || (this.state === 'lock' && ((this.st / 60) | 0) % 2 === 0)) {
        ctx.strokeStyle = this.state === 'lock' ? '#ff3a24' : 'rgba(255,90,60,0.8)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(mx, my, 12, 4, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = ctx.strokeStyle; ctx.fillRect(mx - 16, my, 6, 1); ctx.fillRect(mx + 11, my, 6, 1); ctx.fillRect(mx, my - 7, 1, 4); ctx.fillRect(mx, my + 4, 1, 4);
        if (this.state === 'lock') { ctx.fillStyle = 'rgba(255,60,40,0.25)'; ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(mx - 2, my); ctx.lineTo(mx + 2, my); ctx.fill(); }
      }
      if (this.state === 'fire') {
        const f = ((this.st / 40) | 0) % 2;
        ctx.lineCap = 'round';
        for (const [lw, col] of [[11, 'rgba(255,40,30,0.35)'], [6, '#ff3a24'], [2 + f, '#fff4e8']]) {
          ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(mx, my); ctx.stroke();
        }
        ctx.lineWidth = 1; ctx.lineCap = 'butt';
        ctx.fillStyle = 'rgba(255,230,200,0.85)'; ctx.beginPath(); ctx.ellipse(mx, my, 14 + f * 2, 5, 0, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
}
M.UltraS = UltraS;

// ================================================================== 長老ファイナルゴブリン（5Jのボス）
//   超高速で走り回る（残像）・杖で突く（攻撃力1）・ひるむ・吹っ飛ぶとワープ。倒すと爆発せず、へたり込む
const FG = T.finalGoblin = Object.assign({
  dash: 1250, pauseMs: 300, evade: 0.75, windupMs: 120, activeMs: 100, recoverMs: 160, hitstunMs: 250, knockMs: 160, knockSpeed: 400, warpMs: 160, trails: 6, score: 60000,
  // 2026-10-11 ユーザー指定: HPが半分以下で動きが2倍、1/4以下でさらに2倍（走る速さ×、待ち・構え・隙・ワープの時間÷）
  speedSteps: [[0.5, 2], [0.25, 4]],
  defeat: { boomMs: 3000, seatMs: 3650, doneMs: 4400, blowZ: 34, landMin: 205, landMax: 290 },   // 2026-10-12 連続爆発3秒→大爆発→座り込む   // 2026-10-12 撃破: 爆発の長さ → 座り込む → 6Aへ
}, T.finalGoblin || {});
class FinalGoblin extends Boss {
  constructor(x, y, o) {
    super(x, y, { hp: o.hp, id: 'final_goblin', score: FG.score });
    this.bodyW = 22; this.bodyH = 50; this.shadowW = 22; this.face = -1;
    this.state = 'event'; this.pose = 'elder_idle'; this.trail = []; this.staffDmg = o.staffDmg || 1; this.trailT = 0;
  }
  get name() { return S6().bossNames.final_goblin.name; }
  get sp() { let k = 1; for (const [r, m] of FG.speedSteps) if (this.hp / this.maxHp <= r) k = m; return k; }   // 動きの倍率
  canBeHit() { return ['idle', 'dash', 'windup', 'poke', 'recover', 'hurt'].includes(this.state) && this.alpha > 0.5 && !(this.invulnT > 0); }
  beginEntrance(done) { this.state = 'pose'; this.st = 0; this.doneCb = done; this.showBar = true; this.pose = 'elder_staff_poke'; M.Audio.play('fg_laugh'); }   // 2026-10-12 v103 正式な笑い
  takeHit(att, info) {
    this.baseHit(att, info);
    if (this.hp <= 0) return true;
    if (info.type === 'launch' || info.smash || this.z > 0) { this.state = 'knock'; this.st = 0; this.vx = info.dir * FG.knockSpeed; this.vz = 120; this.pose = 'elder_panic'; this.face = -info.dir; }
    // 2026-10-11 ユーザー指定: ひるまない（連続で殴れない）。殴られたらすぐ逃げることが多い
    else if (['idle', 'recover'].includes(this.state) && Math.random() < 0.6) { const tg = this.target(); if (tg) this.runAway(tg); }
    return true;
  }
  onDefeated() {
    this.state = 'dying'; this.st = 0; this.z = 0; this.pose = 'elder_panic'; this.trail = []; this.alpha = 1; this.invulnT = 0;
    const w = W(); w.shake = 3; M.Audio.play('hit_heavy');
    this.bx0 = this.x; this.by0 = this.y; this.btx = clamp(this.x, w.camX + FG.defeat.landMin, w.camX + FG.defeat.landMax);
    for (let i = 0; i < 4; i++) w.effects.push(new M.Effect({ x: this.x + rand(-14, 14), y: this.y + 0.6, z: rand(8, 40), anim: new M.Anim('rocket_explosion'), life: 500 }));
    W().run.score += this.def.score;
    if (this.onDeath) this.onDeath(this);
  }
  update(dt) {
    this.tick(dt);
    if (this.freeze > 0) { this.freeze -= dt; return; }
    const w = W(), s = dt / 1000, tg = this.target();
    this.st += dt;
    if ((this.trailT += dt) > 18) { this.trailT = 0; if (this.state === 'dash' || this.state === 'warpin') this.trail.push({ x: this.x, y: this.y, z: this.z, face: this.face, pose: this.pose }); else this.trail.shift(); }
    while (this.trail.length > FG.trails) this.trail.shift();
    switch (this.state) {
    case 'event': break;
    case 'pose': if (this.st > 700) { this.state = 'idle'; this.st = 0; this.pose = 'elder_idle'; this.cool = 400; this.doneCb && this.doneCb(); this.doneCb = null; } break;
    case 'idle':
      this.pose = 'elder_idle';
      if (tg) this.face = tg.x >= this.x ? 1 : -1;
      // 2026-10-11 攻撃がなかなか当たらないように: ミカが近くで殴ろうとしたら、ほとんどの場合すぐ走って逃げる
      if (this.active && tg && (this.evadeCool = (this.evadeCool || 0) - dt) <= 0 && ['attack', 'weapon', 'jump'].includes(w.mika.state) &&
          Math.abs(w.mika.x - this.x) < 70 && Math.abs(w.mika.y - this.y) < 16) { this.evadeCool = 450 / this.sp; if (Math.random() < FG.evade) { this.runAway(tg); break; } }
      if (this.active && !w.holdAttacks && (this.cool -= dt) <= 0 && tg) this.decide(tg);
      break;
    case 'dash': {
      const dx = this.tx - this.x, dy = this.ty - this.y, d = Math.hypot(dx, dy * 2), step = FG.dash * this.sp * s;
      if (d <= step) {
        this.x = this.tx; this.y = this.ty;
        if (this.thenPoke && tg && Math.abs(tg.y - this.y) <= 12) { this.face = tg.x >= this.x ? 1 : -1; this.state = 'windup'; this.st = 0; this.pose = 'elder_idle'; }
        else { this.state = 'idle'; this.st = 0; this.cool = FG.pauseMs * this.coolMul / this.sp; }
      } else { this.x += dx / d * step; this.y += dy / d * step / 2; this.face = sign(dx) || this.face; }
      break;
    }
    case 'windup': if (this.st >= FG.windupMs / Math.sqrt(this.sp)) { this.state = 'poke'; this.st = 0; this.pose = 'elder_staff_poke'; this.newAttack(); M.Audio.play('swing'); } break;
    case 'poke':
      M.applyAttack(this, this.attackBox({ reach: [14, 72], band: [14, 40], depth: 10 }), [w.mika, w.robot], { dmg: this.staffDmg, type: 'light', dir: this.face, strike: true, se: 'fg_attack_hit' });   // 2026-10-12 v103 当たった音
      if (this.st >= FG.activeMs / this.sp) { this.state = 'recover'; this.st = 0; }
      break;
    case 'recover': if (this.st >= (FG.recoverMs + 140) / this.sp) { this.state = 'idle'; this.st = 0; this.pose = 'elder_idle'; this.cool = FG.pauseMs * this.coolMul / this.sp; } break;
    case 'hurt':
      if (this.st >= FG.hitstunMs / this.sp) {
        this.state = 'idle'; this.st = 0; this.pose = 'elder_idle'; this.cool = 60;
        if (Math.random() < 0.45 && tg) this.runAway(tg);   // 殴られたらすぐ逃げることも
      }
      break;
    case 'knock':
      this.x += this.vx * s; this.vz -= 900 * s; this.z = Math.max(0, this.z + this.vz * s);
      if (this.st >= FG.knockMs) { this.state = 'warpout'; this.st = 0; M.Audio.play('warp'); }
      break;
    case 'warpout':
      this.alpha = Math.max(0, 1 - this.st / (FG.warpMs / this.sp));
      if (this.st >= FG.warpMs / this.sp) {
        this.z = 0; const side = tg && tg.x < w.camX + M.W / 2 ? 1 : -1;
        this.x = side > 0 ? w.camX + rand(M.W * 0.62, M.W - 40) : w.camX + rand(40, M.W * 0.38); this.y = rand(w.walkY[0], w.walkY[1]);
        this.state = 'warpin'; this.st = 0; w.effects.push(new M.Effect({ x: this.x, y: this.y + 0.5, z: 0, anim: new M.Anim('qfx_warp'), life: 300 }));
      }
      break;
    case 'warpin': this.alpha = Math.min(1, this.st / (FG.warpMs / this.sp)); if (this.st >= FG.warpMs / this.sp) { this.alpha = 1; this.state = 'idle'; this.st = 0; this.cool = 350 / this.sp; this.invulnT = 300; } break;
    case 'dying': {
      // 2026-10-12 ユーザー指定: 倒した手応えの爆発（長老は死なない）→ 煙が晴れると腰を抜かして座り込んでいる → 6Aの演出へ
      const D = FG.defeat;
      M.bossBlast(this, dt, { ms: D.boomMs, dx: 20, z0: 4, z1: 46, big: 8 });   // 2026-10-12 1面ボスと同じ爆発と音 → 大爆発
      // 爆風で吹き飛ばされて、6Aの演出の立ち位置（ミカたちの右）へ落ちる。もともと右の方で倒したら、その場の近く
      // 連続爆発の間はその場で震え、大爆発で吹き飛ぶ（0.6秒）
      const k = clamp((this.st - D.boomMs) / 600, 0, 1);
      this.x = this.bx0 + (this.btx - this.bx0) * k + (k <= 0 ? (((w.fxTime / 45) | 0) % 2 ? 1 : -1) : 0); this.y = this.by0 + (187 - this.by0) * k; this.z = Math.sin(Math.PI * k) * D.blowZ;
      this.pose = this.st < D.seatMs ? 'elder_panic' : 'ev_elder_seated';
      if (this.st >= D.seatMs && !this.sat) { this.sat = true; this.face = -1; }
      if (this.st > D.doneMs && !this.reported) { this.reported = true; this.onDeathDone && this.onDeathDone(this); }
      break;
    }
    }
    if (!['event', 'dying'].includes(this.state)) { this.y = clamp(this.y, w.walkY[0], w.walkY[1]); this.x = clamp(this.x, w.camX + 16, w.camX + M.W - 16); }
  }
  decide(tg) {
    const dx = tg.x - this.x, adx = Math.abs(dx), dy = tg.y - this.y;
    if (adx < 66 && adx > 16 && Math.abs(dy) <= 10 && Math.random() < 0.7) { this.face = sign(dx) || this.face; this.state = 'windup'; this.st = 0; return; }
    if (Math.random() < 0.55) {   // ミカの横へ一瞬で回り込んで突く
      const side = Math.random() < 0.5 ? -1 : 1;
      return this.dashTo(tg.x + side * rand(44, 58), tg.y, true);
    }
    this.runAway(tg);
  }
  runAway(tg) {
    const w = W(), side = tg.x < w.camX + M.W / 2 ? 1 : -1;
    this.dashTo(side > 0 ? w.camX + rand(M.W * 0.55, M.W - 30) : w.camX + rand(30, M.W * 0.45), rand(w.walkY[0], w.walkY[1]), false);
  }
  dashTo(x, y, poke) {
    const w = W();
    this.tx = clamp(x, w.camX + 20, w.camX + M.W - 20); this.ty = clamp(y, w.walkY[0], w.walkY[1]); this.thenPoke = poke;
    this.state = 'dash'; this.st = 0; this.pose = 'elder_idle'; M.Audio.play('dash');
  }
  draw() {
    const w = W();
    for (let i = 0; i < this.trail.length; i++) {
      const t = this.trail[i];
      M.drawAnim(t.pose, 0, t.x - w.camX, t.y - t.z, t.face > 0, 0.1 + 0.32 * (i + 1) / this.trail.length);
    }
    if (this.alpha > 0.05) this.drawShadow();
    const jit = this.state === 'dying' || this.state === 'hurt' ? (((w.fxTime / 45) | 0) % 2 ? 1 : -1) : 0;
    const ctx = M.ctx, flash = this.flashT > 0;
    if (flash) { ctx.save(); ctx.filter = 'brightness(1.7)'; }
    M.drawAnim(this.pose, 0, this.x - w.camX + jit, this.y - this.z, this.face > 0, this.alpha * (this.invulnT > 0 && ((w.fxTime / 60) | 0) % 2 ? 0.4 : 1));
    if (flash) ctx.restore();
  }
}
M.FinalGoblin = FinalGoblin;

// ================================================================== ボス区間の開始（boss.js の M.startBoss から先に呼ばれる）
M.startBossExt = function (w, spec, sec) {
  if (spec.type === 'dark_mika' && spec.count) {
    const ctl = darkMulti(w, spec, () => w.completeSection());
    w.bossCtl = ctl; return true;
  }
  if (spec.type === 'ultra_machine_s') {
    const b = new UltraS(w.camX + 270, (w.walkY[0] + w.walkY[1]) / 2, { hp: spec.hp });
    w.enemies.push(b); w.bosses.push(b); w.boss = b;
    w.bossIntro = new TextIntro(w, b, S6().bossNames.ultra_machine_s, spec.music || 'boss', () => { b.active = true; b.cool = 900; }, 'ultra_machine_s');   // v069 絵の文字
    b.onDeath = () => { w.holdAttacks = false; for (const p of w.projectiles) if (p.team === 'enemy') p.remove = true; ultraDefeated(w, b); };   // 2026-10-12 v057/v058 の演出へ
    b.onDeathDone = null;
    w.bossCtl = { update() {} };
    return true;
  }
  if (spec.type === 'final_goblin') {
    const b = w.s6elderBoss || new FinalGoblin(w.camX + 250, 178, { hp: spec.hp });
    b.maxHp = b.hp = spec.hp; b.staffDmg = spec.staff_dmg || 1;
    if (!w.enemies.includes(b)) w.enemies.push(b);
    w.bosses.push(b); w.boss = b;
    if (w.skipBossIntro) {   // 負けた後のやり直し: 紹介なしで、すぐ戦う
      w.bossIntro = null; b.state = 'idle'; b.st = 0; b.pose = 'elder_idle'; b.showBar = true; b.active = true; b.cool = 800;
      M.Audio.playMusic(spec.music || 'boss'); w.lockInput = false; w.timerRunning = true;
    } else w.bossIntro = new TextIntro(w, b, S6().bossNames.final_goblin, spec.music || 'boss', () => { b.active = true; b.cool = 500; }, 'final_goblin');   // v069 絵の文字（v066 の一枚絵ロゴから変更）
    b.onDeath = () => { w.holdAttacks = true; for (const e of w.enemies) if (e !== b && !e.boss && !e.dead) e.vanish = true; };
    b.onDeathDone = () => toA6(w, b);
    w.bossCtl = { update() {} };
    return true;
  }
  return false;
};
// ダークミカ複数（5I: 2体・HP半分・攻撃頻度半分 ／ 6F: 4体・HP1/3）。名前の演出なし・曲もそのまま。少しずつずらして出る
function darkMulti(w, spec, onAll) {
  const B = T.bossTuning, base = (B.hpByStage && B.hpByStage[2]) || 65, hp = Math.max(6, Math.round(base * (spec.hp_ratio || 0.5))) + (spec.hp_add || 0);   // 2026-10-12 v131: 6Fは+10
  const p2 = (M.PLACEMENTS[2] && M.PLACEMENTS[2].boss && M.PLACEMENTS[2].boss.phase2_ratio) || 0.5;
  // 2026-10-12 v123 ユーザー指定: 同時は count 体（4）まで、合計 total 体（6Fは10）。倒すと次が現れる
  const n = spec.count, total = Math.max(n, spec.total || n), mid = (w.walkY[0] + w.walkY[1]) / 2;
  const appear = [[150, 300], [250, 110], [100, 230], [300, 170]];
  const list = [];
  let dead = 0, made = 0, t = 0;
  const make = (delay) => {
    const i = made++;
    const b = new M.DarkMika(w.camX + appear[i % 4][0], mid, { hp, phase2Ratio: p2, score: B.miniScore || 5000 });
    if (spec.cool_mul) b.coolMul *= spec.cool_mul;
    if (spec.dmg_mul) b.dmgMul = spec.dmg_mul;   // 2026-10-12 v131: 6Fは攻撃力半分（Mika/Robot.takeHit で掛ける）
    b.mid = true; b.s6delay = delay; b.landX = w.camX + appear[i % 4][1]; b.landY = w.walkY[0] + (w.walkY[1] - w.walkY[0]) * [0.5, 0.2, 0.85, 0.35][i % 4];
    b.slot6 = i % 4;
    const up = b.update.bind(b);
    b.update = (dt) => {
      if (b.state === 'appear' && b.st + dt > 900 && !b.jumped) { b.jumped = true; b.jumpTo(b.landX, b.landY, 'katana_jump'); b.vz = 300; b.state = 'appearjump'; b.alpha = 1; }
      up(dt);
    };
    b.onDeath = () => {};
    b.onDeathDone = () => {
      if (++dead === total) return onAll();
      if (made < total) make(t + (spec.next_ms || 700));   // 1体倒すたびに次の1体（同時は n 体まで）
    };
    w.enemies.push(b); w.bosses.push(b); list.push(b);
    return b;
  };
  for (let i = 0; i < n; i++) make(300 + i * 800);
  w.boss = list[0];
  M.Audio.voice('boss_encount');
  return {
    list,
    update(dt) {
      t += dt;
      for (const b of list) if (b.state === 'wait' && t >= b.s6delay) {
        b.beginEntrance(() => { b.active = true; b.cool = 600 + rand(0, 700); });
        b.devX = b.x = w.camX + appear[b.slot6][0];
      }
      let k = 0;   // ゲージは2本まで（生きている順）
      for (const b of list) b.showBar = b.state !== 'wait' && !b.gone && b.hp > 0 && k++ < 2;
    },
  };
}

// ================================================================== 5I 展望台（ボスの照準とレーザーを手前に描く）
//   2026-10-12 v057/v058: ウルトラマシーンS撃破 → 円盤が大爆発して残骸に → ドクターSが投げ出される → 何度も土下座
//   → ミカが考えて見逃す → 顔を上げて右の眉がピクピク → ワープで逃げる → ミカが驚いて首を振り、気を取り直す
//   → ミカとロボが右の扉へ歩いて暗転 → 5J。座標は見本の画面座標（カメラは撃破時のまま）
const DOC = { burst: 1.6, land: 2.7, bow: 2.9, music: 3.2, spare: 7.9, face: 9.4, brow: 10, warp: 11.8, warpEnd: 12.6, shocked: 12.6, recover: 14.2, recoverEnd: 15.4, walk: 16.1, fade: 20.5,
  mikaX: 110, mikaY: 185, docX: 214, docY: 187, ufoX: 267, ufoZY: 135, walkSpeed: 67 };
M.mapHooks = M.mapHooks || {};
M.mapHooks['5I'] = {
  update(w, dt) {
    updateSay(w, dt);
    const X = w.s5iEv; if (!X) return;
    X.t += dt; const t = X.t / 1000, at = (sec) => t >= sec && !X['c' + sec] && (X['c' + sec] = true);
    w.cutscene = true; w.lockInput = true;
    const m = w.mika, r = w.robot, cx = w.camX;
    // ミカ: 見本の位置（画面x110）まで歩いてから演技。16.1秒から右の扉へ
    if (!X.placed) {
      if (!X.going) { X.going = true; m.endWeaponHold(); if (m.z > 0) m.z = 0; m.goTo(cx + DOC.mikaX, DOC.mikaY, () => { X.placed = true; }, T.mika.walkSpeed); }
    } else {
      let anim = 'idle', x = cx + DOC.mikaX;
      if (t >= DOC.walk) { anim = 'walk'; x += (t - DOC.walk) * DOC.walkSpeed; }
      else if (t >= DOC.recover && t < DOC.recoverEnd) { anim = 'ev_mika_recover'; x += Math.sin((t - DOC.recover) * 17) * 1.5; }
      else if (t >= DOC.shocked && t < DOC.recover) anim = 'ev_mika_shocked';
      else if (t >= DOC.spare && t < DOC.face) anim = 'ev_mika_think';
      m.x = x; m.y = DOC.mikaY; act(m, anim, 1); m.anim.update(dt);
    }
    // ロボ: ミカの左後ろ
    const rx = m.x - 32; if (Math.abs(r.x - rx) > 1 || Math.abs(r.y - 191) > 1) { r.x = approach(r.x, rx, 120 * dt / 1000); r.y = approach(r.y, 191, 40 * dt / 1000); act(r, 'robot_move', rx >= r.x ? 1 : -1); } else act(r, 'robot_idle', 1);
    r.anim.update(dt);
    if (at(DOC.burst)) M.Audio.play('hit_heavy');
    if (at(DOC.land)) M.Audio.play('land');
    if (at(DOC.music)) M.Audio.fadeOutMusic(1200);
    if (at(DOC.warp)) M.Audio.play('ufo_warp');   // ドクターSが逃げるワープ
    if (at(DOC.fade)) w.leave('5J', { fadeMs: 600, music: false });
  },
  drawFront(w) { if (w.boss && w.boss.drawOver) w.boss.drawOver(); drawSay(w); },
};
// 残骸とドクターS（役者と一緒に奥行きで並べる）
class DoctorEvent {
  constructor(w) { this.w = w; this.id = 7650; this.y = DOC.docY; }
  get t() { return this.w.s5iEv.t / 1000; }
  draw() {
    const w = this.w, t = this.t, cx = w.camX, ctx = M.ctx;
    if (t >= DOC.burst) M.drawAnim('ev_ufo_wreck', 0, DOC.ufoX, 174, true);   // 残骸（足元y174）
    const dx = DOC.docX, dy = DOC.docY;
    if (t >= DOC.burst && t < DOC.land) {   // 投げ出される
      const p = clamp((t - DOC.burst) / (DOC.land - DOC.burst), 0, 1);
      M.drawAnim('ev_doctor_eject', 0, LERP(DOC.ufoX, dx, p), LERP(DOC.ufoZY, dy, p) - Math.sin(p * Math.PI) * 43, false);
    } else if (t >= DOC.land && t < DOC.warp) {
      const k = t < DOC.bow ? 'ev_doctor_bow_up' : t < DOC.spare ? ((t - DOC.bow) % 0.65 < 0.3 ? 'ev_doctor_bow_down' : 'ev_doctor_bow_up') : t < DOC.face ? 'ev_doctor_bow_down'
        : t >= DOC.brow && Math.floor((t - DOC.brow) / 0.18) % 2 ? 'ev_doctor_brow_up' : 'ev_doctor_face_up';
      ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.ellipse(dx, dy + 1, 15, 3, 0, 0, Math.PI * 2); ctx.fill();
      M.drawAnim(k, 0, dx, dy, false);
      if (t >= DOC.bow && t < DOC.spare && (t - DOC.bow) % 0.65 < 0.09) {   // 床に頭を打ちつける線
        ctx.strokeStyle = '#ffdc82'; ctx.lineWidth = 1;
        for (let j = 0; j < 3; j++) { ctx.beginPath(); ctx.moveTo(192 - j * 4, 185); ctx.lineTo(189 - j * 5, 180 - j); ctx.stroke(); }
      }
    } else if (t >= DOC.warp && t < DOC.warpEnd) {   // ワープで消える
      const p = clamp((t - DOC.warp) / (DOC.warpEnd - DOC.warp), 0, 1);
      M.drawAnim('ev_doctor_face_up', 0, dx, dy, false, 1 - p);
      ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.strokeStyle = '#77f2ff'; ctx.lineWidth = 2;
      for (let j = 0; j < 4; j++) { ctx.beginPath(); ctx.ellipse(dx, 182 - p * 40 + j * 3, 15 * (1 - p) + 3, 4, 0, 0, Math.PI * 2); ctx.stroke(); }
      ctx.fillStyle = `rgba(176,235,255,${(Math.sin(p * Math.PI) * 0.85).toFixed(3)})`; ctx.fillRect(dx - 3 - p * 3, 126, 6 + p * 6, 61);
      ctx.restore();
    }
    void cx;
  }
}
function ultraDefeated(w, b) {
  const sec = w.sec;
  if (sec) { w.run.cleared[sec.section_id] = true; w.run.timeLeft[sec.section_id] = w.time; }
  w.finishMapTime(); w.timerRunning = false; w.mapCleared = true;
  w.s5iEv = { t: DOC.burst * 1000 - UM.defeat.boomMs };   // 大爆発（連続爆発の後）が演出の1.6秒に重なるように
  w.extraActors = (w.extraActors || []).concat([new DoctorEvent(w)]);
}

// ================================================================== 5J 宝物庫（v056 の演出: MIKA_POST_DOCTOR_EVENT_v056 vault）
//   駆け寄る → 3.5秒喜ぶ → カタッ！ → 箱が揺れて開く → 長老が口から顔をのぞかせ、縁をまたいで手前へ
//   → 吹き出し（宝はどこ？の絵 → ワシが宝！の絵）→ ミカの冷めた目・長老が目をそらす → ミカが腕をポキポキ → 長老が構える
//   → 肩書・名前の紹介（本編の文字の紹介 TextIntro のまま）→ 戦闘。セリフの文字や会話ウィンドウは出さない
const CHEST = { x: 253, y: 177 };
const EV = (t, a, b) => t >= a && t < b;
const LERP = (a, b, k) => a + (b - a) * clamp(k, 0, 1);
class Chest5J {
  constructor() { this.x = CHEST.x; this.y = CHEST.y; this.id = 7600; this.open = false; this.shake = 0; this.elder = null; }
  draw() {
    const w = W(), sx = this.x - w.camX;
    M.ctx.fillStyle = 'rgba(0,0,0,0.3)'; M.ctx.beginPath(); M.ctx.ellipse(Math.round(sx), Math.round(this.y) + 1, 60, 4, 0, 0, Math.PI * 2); M.ctx.fill();
    M.drawAnim(this.open ? 'ev_chest_open' : 'ev_chest_closed', 0, sx + this.shake, this.y, true);
    // 箱の口からのぞく・よじ登る長老は「箱 → 長老 → 箱の前面」の順に描く
    const e = this.elder; if (!e) return;
    M.drawAnim(e.pose, 0, e.x - w.camX, e.y, false);
    if (e.front) M.drawAnim('ev_chest_front', 0, sx, this.y, true);
  }
}
// 吹き出し（v056: 白い角丸の枠＋しっぽ、中に56×56の絵）。x はしっぽの位置、y は枠の上端（画面の座標）
function bubbleIcon(icon, x, y) {
  const ctx = M.ctx; x = Math.round(x); y = Math.round(y);
  ctx.save(); ctx.fillStyle = '#fff9df'; ctx.strokeStyle = '#33293a'; ctx.lineWidth = 2;
  ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x - 37, y, 74, 62, 8); else ctx.rect(x - 37, y, 74, 62); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - 6, y + 61); ctx.lineTo(x, y + 73); ctx.lineTo(x + 7, y + 61); ctx.fill(); ctx.stroke();
  ctx.restore();
  M.drawFrame('ev_bubble_' + icon, x - 28, y + 3, [0, 0], false);
}
// 演出で役者のアニメを切り替える（同じなら続ける）。scripted の間は自分でコマを進める
function act(a, anim, face, opts) { if (a.state !== 'scripted' || a.anim.name !== anim) a.setState('scripted', anim, Object.assign({ loop: true }, opts || {})); if (face) a.face = face; }
// 2026-10-12 v104 ミカとロボのHPを満タンに（壊れていたロボも直す。音・表示なし）
function fullHeal(w) {
  const m = w.mika, r = w.robot;
  m.hp = m.maxHp;
  r.hp = r.maxHp; r.repairT = 0; r.flag = null;
  if (r.state === 'broken' || r.state === 'revive') r.setState('idle', 'robot_idle', { loop: true });
}
M.mapHooks['5J'] = {
  init(w) {
    if (w.kind === 'room') return;
    const chest = new Chest5J();
    w.s6j = { t: 0, chest, started: false };
    w.extraActors = [chest];
    // 2026-10-12 ユーザー指定: 長老に負けたら、宝物庫の小芝居も紹介も飛ばして、すぐ戦いから再開
    const cp = w.run.checkpoint;
    if (cp && cp.mapId === '5J' && cp.deaths > 0) {
      w.s6j.heal = true;
      w.s6j.done = true; chest.open = true; w.skipBossIntro = true;
      const e = new FinalGoblin(225, 187, { hp: 50 }); e.face = -1; e.pose = 'elder_idle';
      w.enemies.push(e); w.s6elderBoss = e;
    }
  },
  update(w, dt) {
    updateSay(w, dt);
    const J = w.s6j; if (J && J.heal) { J.heal = false; fullHeal(w); }   // やり直しの時も満タン
    if (!J || J.done) return;
    const m = w.mika, r = w.robot, C = J.chest;
    w.cutscene = true; w.lockInput = true; w.timerRunning = false;
    if (!J.started) {   // 入場の歩きは使わず、左端から駆け寄る
      J.started = true; m.endWeaponHold(); m.vx = 0; m.z = 0; r.z = 0;
      fullHeal(w);   // 2026-10-12 v104 ユーザー指定: 秘宝の間に入ったら説明なしでミカとロボのHPを満タンに（この後の長老戦用）
      m.x = 28; m.y = 187; r.x = -4; r.y = 191; w.camX = 0;
    }
    J.t += dt;
    const t = J.t / 1000, at = (s) => J.t >= s * 1000 && !J['c' + s] && (J['c' + s] = true);
    // ---- ミカとロボ
    const mx = LERP(28, 155, t / 3), joy = EV(t, 3, 6.5), hop = joy ? Math.max(0, Math.sin((t - 3) * 7.4)) * 5 : 0;
    m.x = mx; m.y = 187; m.z = hop; r.x = mx - 32; r.y = 191; r.z = hop * 0.6;
    if (t < 3) act(m, 'dash', 1);
    else if (EV(t, 28.3, 32.1)) act(m, Math.floor((t - 28.3) / 0.6) % 2 ? 'ev_mika_knuckle_b' : 'ev_mika_knuckle_a', 1);
    else if (t >= 23.8) act(m, 'ev_mika_cold', 1);
    else act(m, 'idle', 1);
    act(r, t < 3 || joy ? 'robot_move' : 'robot_idle', 1);
    m.anim.update(dt); r.anim.update(dt);
    if (at(3)) { M.Audio.voice('item'); M.Audio.play('coin'); }
    // ---- 宝箱: カタッ（6.5）→ 揺れる（8.4〜10.4）→ 開く（10.4）
    C.shake = EV(t, 6.5, 6.7) ? Math.sin(t * 90) * 0.8 : EV(t, 8.4, 10.4) ? Math.sin(t * 35) * 2 : 0;
    if (at(6.5)) M.Audio.play('land', { gain: 0.8 });
    if (at(8.4)) M.Audio.play('elevator_stop', { gain: 0.5, rate: 1.4 });
    if (at(10.4)) { C.open = true; M.Audio.play('treasure_open'); }   // 2026-10-12 v104 正式な宝箱の音
    if (at(28.3) || at(30.2)) M.Audio.play('mika_knuckle');   // 2026-10-12 v104 指をポキポキ（28.3〜32.1）
    if (at(13)) M.Audio.play('fg_jump_box');   // 2026-10-12 長老が宝箱から飛び出す声
    // ---- 長老: 箱の口からのぞく（10.9〜13）→ 縁をまたいで手前へ（13〜17.2）→ 箱の手前に着地
    if (EV(t, 10.9, 13)) C.elder = { pose: 'ev_elder_peek', x: 253, y: 160 - 29 * clamp((t - 10.9) / 1.2, 0, 1), front: true };
    else if (EV(t, 13, 17.2)) {
      const p = (t - 13) / 4.2;   // v058: よじ登りの頂点を7px上（足元が縁を越える高さ）
      C.elder = { pose: 'ev_elder_climb', x: LERP(253, 225, p), y: p < 0.4 ? LERP(150, 126, p / 0.4) : LERP(126, 187, (p - 0.4) / 0.6), front: p < 0.4 };
    } else C.elder = null;
    if (at(17.2)) {
      const e = new FinalGoblin(225, 187, { hp: 50 });
      e.face = -1; e.pose = 'elder_idle'; w.enemies.push(e); w.s6elderBoss = J.elder = e;
      M.Audio.play('land');
    }
    const e = J.elder;
    if (e) {
      e.x = 225; e.y = 187; e.z = 0; e.face = -1;
      e.pose = t >= 33.2 ? 'ev_elder_challenge' : t >= 32.1 ? 'ev_elder_startled'
        : EV(t, 25.4, 28.3) ? (Math.floor((t - 25.4) / 0.7) % 2 ? 'ev_elder_look_right' : 'ev_elder_look_left')
        : EV(t, 20.8, 23.8) ? 'ev_elder_self' : 'elder_idle';
    }
    // ---- 35.3秒: 肩書と名前の紹介（本編の文字の紹介）→ 戦闘
    if (t >= 35.3) {
      J.done = true; w.cutscene = false; w.lockInput = false;
      m.z = 0; r.z = 0; m.setState('idle', 'idle'); r.setState('idle', 'robot_idle', { loop: true });
      if (w.bossPending && w.sec) { w.bossPending = false; M.startBoss(w, w.bossSpec, w.sec); }
    }
  },
  drawFront(w) {
    const J = w.s6j;
    if (J && !J.done) {
      const t = J.t / 1000;
      if (EV(t, 17.8, 20.8)) bubbleIcon('treasure', 155 - w.camX, 62);
      if (EV(t, 20.8, 23.8)) bubbleIcon('self', 225 - w.camX, 59);
      // 腕をポキポキ: 指の先に小さな線
      if (EV(t, 28.3, 32.1) && (t - 28.3) % 0.6 > 0.35 && (t - 28.3) % 0.6 < 0.45) {
        const ctx = M.ctx, mx = w.mika.x - w.camX; ctx.strokeStyle = '#fff5bb'; ctx.lineWidth = 1;
        for (let j = 0; j < 3; j++) { ctx.beginPath(); ctx.moveTo(mx + 6 + j * 3, 159); ctx.lineTo(mx + 8 + j * 4, 156 - (j % 2) * 2); ctx.stroke(); }
      }
      if (t < 0.4) { M.ctx.fillStyle = `rgba(0,0,0,${1 - t / 0.4})`; M.ctx.fillRect(0, 0, M.W, M.H); }
    }
    drawSay(w);
  },
};
// 長老を倒した: 同じ部屋の6Aへ（暗転なし）
function toA6(w, b) {
  w.run.cleared.J1 = true; w.finishMapTime();
  M.s6carry = { elder: { x: b.x, y: b.y, face: b.face }, mika: { x: w.mika.x, y: w.mika.y }, robot: { x: w.robot.x, y: w.robot.y }, chest: true };
  w.saveCarry(false);
  const m = w.mika;
  M.setScene(new M.World('6A', { run: w.run, entry: 'event', arrive: [m.x, m.y], onDone: w.onDone, onGameOver: w.onGameOver }));
}

// ================================================================== 長老（6面で連れて歩く。攻撃されない）
class Elder {
  constructor(x, y) { this.x = x; this.y = y; this.z = 0; this.face = -1; this.pose = 'elder_idle'; this.t = 0; this.id = 7700; this.alpha = 1; this.walking = false; this.shiver = false; }
  draw() {
    if (this.hidden) return;
    const w = W(), sx = this.x - w.camX;
    if (this.trail) for (const g of this.trail) M.drawAnim(this.pose, 0, g.x - w.camX, this.y - this.z, this.face > 0, g.a);   // 2026-10-12 v056 マッハで飛びつく時の残像
    if (!this.noShadow) { const k = clamp(1 - this.z / 120, 0.5, 1); M.ctx.fillStyle = 'rgba(0,0,0,0.28)'; M.ctx.fillRect(Math.round(sx - 10 * k), Math.round(this.y) - 1, Math.round(20 * k), 3); }
    const ox = this.shiver ? (((w.fxTime / 50) | 0) % 2 ? 1 : -1) : 0;
    // 2026-10-11 v051: 歩いている時だけ歩き6コマ（各180ms）。止まったら立ち絵・OK・屈むなど
    if (this.walking && M.ANIMS.elder_walk) { const a = M.ANIMS.elder_walk; M.drawAnim('elder_walk', Math.floor(this.t / 180) % a.frames.length, sx, this.y - this.z, this.face > 0, this.alpha); return; }
    M.drawAnim(this.pose, 0, sx + ox, this.y - this.z, this.face > 0, this.alpha);
  }
}
// 吹き出しの位置用に、ミカと長老がしがみつく絵の時の頭
function follow(w, E, dt, dir) {
  const m = w.mika, s = dt / 1000;
  E.t += dt;
  const danger = w.enemies.some((e) => !e.dead && e.state !== 'dying' && !e.friendly && !e.gone && !e.seated && !(e.boss && e.hp <= 0));   // 鎮座中のダンダルモンは数えない
  if (danger) { E.pose = 'elder_crouch'; E.shiver = true; E.walking = false; return; }
  E.shiver = false; E.pose = 'elder_idle';
  const tx = m.x - dir * 34, ty = clamp(m.y - 6, w.walkY[0], w.walkY[1]);
  const dx = tx - E.x, dy = ty - E.y;
  if (Math.abs(dx) > 8 || Math.abs(dy) > 4) {
    const V = w.s6 && w.s6.lastV, late = w.mapId === '6F' && V && V.i >= (T.escape.lastFloorSlowAfter || 3);   // v124: 3つ目の声を言った瞬間から
    const sp = 50 * (w.mapId === '6F' ? (T.escape.lastFloorElderSpeed || 1) * (late ? (T.escape.lastFloorSlowMul || 0.5) : 1) : 1);   // 2026-10-11 ユーザー指定: 長老の足を半分に。ミカが走っても長老は速くならない（画面は長老に引っ張られる）。2026-10-12 最後の6Fはさらに半分
    E.x += clamp(dx, -sp * s, sp * s); E.y += clamp(dy, -50 * s, 50 * s); E.walking = true;
    if (Math.abs(dx) > 2) E.face = sign(dx);
  } else { E.walking = false; E.face = m.x >= E.x ? 1 : -1; }
}

// ================================================================== 6A 自爆と脱出の始まり（v056 の演出: alarm → escort）
//   長老は腰を抜かして座り込む → ミカとロボが左へ跳ぶ → 2秒でサイレン → 自爆の放送を2回（最後まで）
//   → 放送が2回とも終わってから、ミカがゆっくり左へ → 長老が手を合わせてお願い（吹き出しの絵）→ ミカは考えて首を振り、左を向く
//   → 長老がマッハで飛びつき、腕にしがみついて泣く → ミカはクイっと「ついてこい」→「脱出！」→ 3人で左へ（長老はのろのろ）→ 出口でOK → 6B
//   セリフの文字・会話ウィンドウは出さない。揺れと赤い点滅は画面全体だけ
const A6 = { siren: 2000, voice1: 3000, voiceGap: 700, walk: 16000, walkAfterVoice: 770, pray: 18000, think: 19500, refuse: 21300, turn: 22500, lunge: 22800, cling: 23100, help2: 23600, beckon: 27000, title: 31200, escort: 32400,   /* 2026-10-12 声が入ったので「脱出！」と歩き出しを1.9秒後ろへ */
  esc: { mikaSpeed: 115, mikaOut: 100, elderSpeed: 12, elderOut: 80, exitX: 24, mikaExitX: 20, leave: 12200, fade: 700 } };
const VOICE_MS = 5766;   // 放送の声が鳴らない環境での長さ（VOICE_JIBAKU_BUTTON 5.766秒）
M.mapHooks['6A'] = {
  init(w) {
    const c = M.s6carry || {}; M.s6carry = null;
    const e = c.elder || { x: 225, y: 187, face: -1 };
    const E = new Elder(e.x, e.y); E.face = -1; E.pose = 'ev_elder_seated';
    const chest = new Chest5J(); chest.open = true;
    w.s6a = { t: 0, E, chest, prev: { mika: c.mika || { x: 193, y: 187 }, elder: { x: e.x, y: e.y }, robot: c.robot || null } };
    w.extraActors = [chest, E];
    w.cutscene = true; w.lockInput = true; w.timerRunning = false;
    M.Audio.fadeOutMusic(900); unduck();
  },
  update(w, dt) {
    updateSay(w, dt);
    const S = w.s6a, E = S.E, m = w.mika, r = w.robot, P = S.prev;
    w.cutscene = true; w.lockInput = true; w.timerRunning = false;
    if (!S.init) { S.init = true; m.endWeaponHold(); m.vx = 0; m.z = 0; r.z = 0; m.x = P.mika.x; m.y = 187; r.x = P.robot ? P.robot.x : m.x - 32; r.y = 191; w.camX = 0; }
    // 放送が2回とも終わるまで、歩き出し（16秒）で時計を止めて待つ（声の終わりから0.77秒後に歩き出す）
    S.real = (S.real || 0) + dt;
    let nt = S.t + dt;
    if (S.phase !== 'escort' && nt > A6.walk && !(S.v2end != null && S.real >= S.v2end + A6.walkAfterVoice)) nt = Math.max(S.t, A6.walk);
    S.t = nt;
    E.t += dt;
    const t = S.t, at = (ms) => t >= ms && !S['c' + ms] && (S['c' + ms] = true);
    // ---- 警報と放送
    if (t >= A6.siren) { alarmTick(w, dt); w.shake = Math.max(w.shake, 1); quakeTick(w, dt); }   // v120 瓦礫
    if (at(A6.voice1)) { S.v1 = announce(w, 'jibaku') || { ended: false, fake: S.real + VOICE_MS }; }
    const done = (v) => v && (v.fake != null ? S.real >= v.fake : (v.ended || (v.el && v.el.ended)));
    if (S.v1 && !S.v2 && done(S.v1)) { S.v1end = S.v1end || S.real; if (S.real >= S.v1end + A6.voiceGap) S.v2 = announce(w, 'jibaku') || { ended: false, fake: S.real + VOICE_MS }; }
    if (S.v2 && S.v2end == null && done(S.v2)) S.v2end = S.real;
    if (S.phase !== 'escort') {
      // ---- ミカとロボ: 左へ跳ぶ（0.15〜0.9）→ 冷めた目 → 歩き出す → 考える → 断る → 左を向く
      const land = clamp((t / 1000 - 0.15) / 0.75, 0, 1), jump = t > 150 && t < 900 ? Math.sin(land * Math.PI) * 20 : 0;
      const mx = t < 1000 ? LERP(P.mika.x, 155, land) : t < A6.walk ? 155 : t < A6.pray ? LERP(155, 125, (t - A6.walk) / 2000) : 125;
      m.x = mx; m.y = 187; m.z = jump;
      const rx0 = P.robot ? P.robot.x : P.mika.x - 32;
      r.x = t < 1000 ? LERP(rx0, 98, land) : 98; r.y = 191; r.z = jump * 0.8; act(r, 'robot_idle', 1);
      E.hidden = false;
      if (t >= A6.cling && t < A6.title) { m.x = 125; act(m, t >= A6.beckon ? 'ev_mika_elder_accept' : 'ev_mika_elder_cling', 1); E.hidden = true; }
      else if (t < 1000) act(m, 'idle', 1);
      else if (t < A6.walk) act(m, 'ev_mika_cold', 1);
      else if (t < A6.pray) act(m, 'walk', -1);
      else if (t < A6.think) act(m, 'idle', -1);
      else if (t < A6.refuse) act(m, 'ev_mika_think', 1);
      else if (t < A6.turn) { act(m, 'ev_mika_refuse', 1); m.x = mx + Math.sin(t / 1000 * 17) * 0.5; }
      else act(m, 'idle', -1);
      m.anim.update(dt); r.anim.update(dt);
      // ---- 長老: 座り込み（1.5〜2秒で少し右へ）→ お願い → マッハで飛びつく → しがみつく → 立つ
      E.walking = false; E.shiver = false; E.face = -1; E.trail = null;
      if (t >= A6.title) { E.pose = 'elder_idle'; E.x = 160; E.y = 187; }
      else if (t < A6.pray) { E.pose = 'ev_elder_seated'; E.x = t < 1500 ? P.elder.x : LERP(P.elder.x, 190, (t - 1500) / 500); E.y = 187; }
      else if (t < A6.lunge) { E.pose = 'ev_elder_pray'; E.x = 190; E.y = 187; }
      else {
        const q = clamp((t - A6.lunge) / 300, 0, 1); E.pose = 'ev_elder_startled'; E.x = LERP(190, 145, q); E.y = 187;
        E.trail = [1, 2, 3].map((j) => ({ x: LERP(190, 145, clamp(q - j * 0.12, 0, 1)), a: 0.2 * (1 - j / 4) }));
      }
      if (at(A6.lunge)) M.Audio.play('dash');
      // 2026-10-12 長老「助けて」→ ミカ（断る）→ 長老（もう一度）→ ミカ（引き受ける）
      if (at(A6.pray)) M.Audio.play('fg_help1');
      if (at(A6.refuse)) M.Audio.play('mika_help1');
      if (at(A6.help2)) M.Audio.play('fg_help2');
      if (at(A6.beckon)) M.Audio.play('mika_help2');
      if (at(A6.escort)) { S.phase = 'escort'; S.e = 0; }
    } else {
      // ---- 脱出: ミカとロボは出口（左）まで → 待つ。長老はのろのろ出口へ → OK → 3人で出る → 6B
      const C = A6.esc; S.e += dt; const e = S.e / 1000;
      if (!S.left) {
        const mx = e < C.leave / 1000 ? Math.max(C.mikaExitX, 125 - e * C.mikaSpeed) : C.mikaExitX - (e - C.leave / 1000) * C.mikaOut;
        const moving = mx > C.mikaExitX + 0.5 || e >= C.leave / 1000;
        m.x = mx; m.y = 187; m.z = 0; act(m, moving ? 'walk' : 'idle', -1);
        r.x = e < C.leave / 1000 ? Math.max(12, mx - 27) : mx - 27; r.y = 191; act(r, moving ? 'robot_move' : 'robot_idle', -1);
        m.anim.update(dt); r.anim.update(dt);
        const reach = (160 - C.exitX) / C.elderSpeed;   // 長老が出口に着く秒
        E.face = -1; E.shiver = false;
        if (e < reach) { E.x = 160 - e * C.elderSpeed; E.walking = true; }
        else if (e < C.leave / 1000) { E.x = C.exitX; E.walking = false; E.pose = 'elder_ok'; }
        else { E.x = C.exitX - (e - C.leave / 1000) * C.elderOut; E.walking = true; E.pose = 'elder_idle'; }
        if (S.e >= C.leave + 100 && !S.left) {
          S.left = true;
          w.transition(() => {
            w.saveCarry(false);
            M.setScene(new M.World('6B', { run: w.run, entry: 'map', onDone: w.onDone, onGameOver: w.onGameOver }));
          }, { music: false, fadeMs: C.fade });
        }
      }
    }
  },
  drawFront(w) {
    const S = w.s6a; if (!S) return;
    const t = S.t;
    if (S.phase !== 'escort' && t >= A6.pray && t < A6.refuse) bubbleIcon('prayer', 190 - w.camX, 65);
    drawDebris(w);   // v120
    if (t >= A6.siren) alarmFx(w);
    if (S.phase !== 'escort' && t >= A6.title) M.drawFrame('ev_title_escape', 138, 72, [0, 0], false);
    drawSay(w);
  },
};
// 警報の画面効果（v056）: 舞い落ちるほこり＋画面全体の赤い点滅
function alarmFx(w) {
  const ctx = M.ctx, t = w.fxTime / 1000;
  for (let j = 0; j < 9; j++) {
    const x = (j * 47 + 17) % 384, y = (t * 34 + j * 29) % 230 - 12;
    ctx.save(); ctx.translate(x, y); ctx.rotate(t * (j % 2 ? 1 : -1)); ctx.fillStyle = j % 2 ? '#ab8d72' : '#5c5147'; ctx.fillRect(-2, -2, 3 + (j % 3), 3); ctx.restore();
  }
  ctx.fillStyle = `rgba(229,10,21,${(0.06 + 0.17 * (0.5 + 0.5 * Math.sin(t * 5))).toFixed(3)})`; ctx.fillRect(0, 0, M.W, M.H);
}
function MAPMUSIC() { return (M.REF.stageMaps.maps['6B'] || {}).music || 'boss'; }
// ---------------------------------------------------------------- 警報（2026-10-11 SE_SILEN のループ）と画面の赤
//   残り時間が tuning.js escape.sirenSteps の値を下回るたびに、サイレンを速く再生して画面の赤を濃くする（目が痛くない程度まで）
function sirenStep(w) {
  const E = T.escape, st = E.sirenSteps;
  let cur = st[0];
  if (w.stage === 6 && w.tgroup === '6ESC') for (const x of st) if (w.time <= x.at) cur = x;
  return cur;
}
function alarmTick(w, dt) {
  const A = M.Audio, st = sirenStep(w);
  if (!w.sirenV || w.sirenV.ended) w.sirenV = A.play('siren', { loop: true, gain: T.escape.sirenGain });
  const v = w.sirenV; if (!v) return;
  A.touchLoop(v);
  if (v.s) v.s.playbackRate.value = st.rate; else if (v.el) { v.el.preservesPitch = false; v.el.playbackRate = st.rate; }
  // 声（放送・残り時間）の間はBGMを下げる
  if (w.duckV) {
    const on = !w.duckV.ended && !(w.duckV.el && w.duckV.el.ended);
    if (A.bgmGain) A.bgmGain.gain.value = A.bgmVolume * (on ? 0.35 : 1);
    if (!on) w.duckV = null;
  }
}
// ---------------------------------------------------------------- 2026-10-12 v120 6面の揺れと降ってくる瓦礫（演出だけ・当たり判定なし）
//   ときどき強く揺れて瓦礫がまとめて降り、その間も天井から小さな瓦礫がぱらぱら落ちる。床に当たって小さく跳ね、薄れて消える
const DEB_COL = ['#b8ad9c', '#9a8f80', '#d2c7b4', '#7d746a', '#a88c6c'];
function quakeTick(w, dt) {
  const Q = T.escape.quake, D = (w.debris = w.debris || { list: [], next: rand(...Q.everyMs), drop: rand(...Q.dropMs), shakeT: 0 });
  const spawn = (n) => { for (let i = 0; i < n; i++) {
    const y = rand(w.walkY[0] - 6, w.walkY[1] + 4);
    D.list.push({ x: w.camX + rand(4, M.W - 4), y, z: y + rand(10, 40), vz: rand(-20, 0), vx: rand(-8, 8), s: Math.random() < 0.2 ? 7 : Math.random() < 0.55 ? 5 : 3, c: DEB_COL[(Math.random() * DEB_COL.length) | 0], bounced: false, rest: 0,
      img: (Math.random() * 8) | 0, ang: rand(0, Math.PI * 2), spin: rand(-6, 6) });   // v070: 出た時に絵（0〜7）を決めて消えるまで同じ絵。ゆっくり回す
  } };
  D.next -= dt; D.drop -= dt;
  if (D.next <= 0) { D.next = rand(...Q.everyMs); D.shakeT = Q.shakeMs; spawn(Math.round(rand(...Q.burst))); M.Audio.play('land', { rate: 0.5, gain: 0.45 }); }
  if (D.drop <= 0) { D.drop = rand(...Q.dropMs); spawn(1); }
  if (D.shakeT > 0) { D.shakeT -= dt; w.shake = Math.max(w.shake, Q.shake); }
  const s = dt / 1000;
  for (const d of D.list) {
    if (d.rest > 0) { d.rest += dt; continue; }
    d.vz -= 520 * s; d.z += d.vz * s; d.x += d.vx * s; d.ang += d.spin * s;
    if (d.z <= 0) { d.z = 0; if (!d.bounced && d.s >= 3) { d.bounced = true; d.vz = 45; d.vx *= 2; } else d.rest = 1; }
  }
  D.list = D.list.filter((d) => d.rest < 700 && d.x > w.camX - 20 && d.x < w.camX + M.W + 20);
}
function drawDebris(w) {
  const D = w.debris; if (!D) return;
  const ctx = M.ctx;
  for (const d of D.list) {
    const sx = Math.round(d.x - w.camX), a = d.rest > 0 ? Math.max(0, 1 - d.rest / 700) : 1;
    if (d.z > 0) { ctx.globalAlpha = 0.25 * Math.max(0.3, 1 - d.z / 60); ctx.fillStyle = '#000'; ctx.fillRect(sx - 1, Math.round(d.y), d.s + 1, 1); }   // 落ちてくる影
    const sy = Math.round(d.y - d.z) - d.s;
    ctx.globalAlpha = a;
    if (M.drawEscapeRubbleV070 && M.ESCAPE_RUBBLE_V070) {   // 2026-10-12 v070 の瓦礫の絵（16px版。大きさは3段階の倍率で）
      M.drawEscapeRubbleV070(d.img, sx + d.s / 2, sy + d.s / 2, { size: 16, angle: d.rest > 0 ? Math.round(d.ang / (Math.PI / 2)) * (Math.PI / 2) : d.ang, scale: d.s === 7 ? 1 : d.s === 5 ? 0.8 : 0.6 });
    } else {
      ctx.fillStyle = '#2b2622'; ctx.fillRect(sx - 1, sy - 1, d.s + 2, d.s + 2);   // 絵が無い時の四角
      ctx.fillStyle = d.c; ctx.fillRect(sx, sy, d.s, d.s);
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(sx, sy, d.s, 1);
    }
    if (d.rest > 0 && d.rest < 260) { ctx.globalAlpha = 0.35 * (1 - d.rest / 260); ctx.fillStyle = '#d9d0c0'; const r = 3 + d.rest / 30; ctx.fillRect(sx - r, Math.round(d.y) - 2, d.s + r * 2, 2); }   // 着地の土ぼこり
  }
  ctx.globalAlpha = 1;
}
function announce(w, key) { const v = M.Audio.play(key); if (v) w.duckV = v; return v; }
function drawAlarm(w) {
  const st = sirenStep(w), sp = 190 / st.rate;
  const a = st.red * (0.45 + 0.55 * (0.5 + 0.5 * Math.sin(w.fxTime / sp)));
  M.ctx.fillStyle = `rgba(255,24,16,${a.toFixed(3)})`; M.ctx.fillRect(0, 0, M.W, M.H);
}

// ================================================================== 6B〜6F 脱出（長老を連れて進む・行き止まりで床を殴る）
const ESC = { holeR: 26 };
const ESC_LAST = { at: [0.12, 0.34, 0.56, 0.78], ms: [4380, 5020, 5100, 3650] };   // 2026-10-12 6Fの長老の声（FGOBU_ESCAPE_LAST01〜04）を鳴らす進み具合と各長さ
function unduck() { if (M.Audio.bgmGain) M.Audio.bgmGain.gain.value = M.Audio.bgmVolume; }
function escInit(w) {
  const c = M.s6carry || {}; M.s6carry = null;
  const cfg = w.map.escort || {};
  w.camX = w.rtl ? w.width - M.W : 0;
  // 2026-10-11 脱出の制限時間と減る速さ（tuning.js escape）
  w.tickMs = T.escape.tickMs; unduck();
  if (w.run.mapTime[w.tgroup] == null) w.time = T.escape.timeInitial;
  if (w.run.s6said) for (const at of T.escape.voiceAt) if (w.time > at) delete w.run.s6said[at];   // やり直しで時間が戻ったらまた言う
  const S = w.s6 = { phase: 'travel', cfg, spawned: 0, cap: Math.round(w.width / 1920 * 8) + 2, cool: 1800, drop: !!c.drop, E: null, hole: null };
  const dir = w.rtl ? -1 : 1, st = w.map.start;
  const ex = c.drop ? (w.rtl ? w.width - 90 : 90) + -dir * 30 : w.camX + (w.rtl ? M.W + 30 : -30);
  S.E = new Elder(ex, (st && st[1]) || 180); S.E.face = dir;
  w.extraActors = [S.E, { y: -9999, id: 1, draw: () => drawHoleBack(w) }];
  if (S.drop) { w.cutscene = true; w.lockInput = true; }
  // 2026-10-11 ユーザー指定: ダンダルモンはシャッターなしで最初から行き止まりに鎮座。左へ進むマップ（6D）は左端に右向きで置く
  if (cfg.boss === 'dandalmon') {
    const px = M.REF.dandIntro.boss_placement.top_left_preview[0];
    const left = w.rtl ? M.W - px - 112 : w.width - M.W + px;
    const b = new M.Dandalmon(w, { hp: cfg.boss_hp || 28, left, flip: w.rtl });
    b.mid = true; b.freqMul = 0.5; b.seat(null);
    w.enemies.push(b); S.dand = b;
  }
}
function escUpdate(w, dt) {
  updateSay(w, dt);
  const S = w.s6; if (!S) return;
  alarmTick(w, dt);
  if (!(S.drop && S.dropT != null)) quakeTick(w, dt);   // v120 揺れと瓦礫（天井から降りてくる間は止める）
  // 残り時間の声（300・120・60・30・10）。一度言った数はこの脱出の間は言わない
  const said = w.run.s6said = w.run.s6said || {};
  let say1 = null;
  for (const at of T.escape.voiceAt) if (w.time <= at && !said[at]) { said[at] = true; say1 = at; }
  if (say1 != null && w.time > 0) announce(w, 'time' + say1);
  const m = w.mika, r = w.robot, E = S.E, dir = w.rtl ? -1 : 1, end = w.rtl ? 0 : w.width - M.W;
  // 穴から降りてきた: 天井（画面の上）から3人が順に着地
  if (S.drop && !S.dropInit) {
    S.dropInit = true;
    const x = w.rtl ? w.width - 100 : 100;
    m.x = x; m.y = 180; m.z = 170; m.face = dir; m.setState('scripted', 'jump'); m.anim.i = 3;
    r.x = x - dir * 40; r.y = 188; r.z = 210; r.face = dir; r.setState('scripted', 'robot_move', { loop: true });
    E.x = x - dir * 22; E.y = 172; E.z = 250; E.pose = 'elder_panic';
    S.dropT = 0;
  }
  if (S.drop && S.dropInit && S.phase === 'travel' && S.dropT != null) {
    w.cutscene = true; w.lockInput = true;
    S.dropT += dt;
    const s = dt / 1000, fall = 520 * s;
    let landed = 0;
    for (const a of [m, r, E]) {
      if (a.z > 0) { a.z = Math.max(0, a.z - fall); if (a.z === 0) { M.Audio.play('land'); w.shake = Math.max(w.shake, 1); } }
      else landed++;
    }
    if (landed === 3 && S.dropT > 700) {
      S.dropT = null; w.cutscene = false; w.lockInput = false;
      m.setState('idle', 'idle'); r.setState('idle', 'robot_idle', { loop: true }); E.pose = 'elder_idle';
      M.Audio.voice('zone6_start');
    }
    return;
  }
  // ?map=6C などで直接入った時（確認用）: 歩いて登場する位置を画面の中へ
  if (m.state === 'entrance' && !S.entFix) { S.entFix = true; w.entranceTo = w.rtl ? w.camX + M.W - 90 : w.camX + 90; }
  if (S.phase === 'travel' || S.phase === 'end' || S.phase === 'boss') {
    follow(w, E, dt, dir);
    if (m.state === 'entrance') { E.pose = 'elder_idle'; E.shiver = false; }
  }
  // カメラ: ミカについて進む（戻らない）。長老を画面から置いて行かない
  if (S.phase === 'travel' && m.state !== 'entrance') {
    const v = T.stage.cameraMaxSpeed * dt / 1000;
    if (w.rtl) { const want = Math.max(m.x - (M.W - T.stage.cameraLead), E.x + 24 - M.W, end); if (want < w.camX) w.camX = Math.max(want, w.camX - v); }
    else { const want = Math.min(m.x - T.stage.cameraLead, E.x - 24, end); if (want > w.camX) w.camX = Math.min(want, w.camX + v); }
    // 2026-10-12 最後の6F: のろのろ歩く長老の声を、進み具合（カメラの進んだ割合）で1本ずつ順番に。前の声が終わってから
    if (w.mapId === '6F') {
      const V = S.lastV = S.lastV || { i: 0, until: 0, cam0: w.camX, real: 0 };
      V.real += dt;
      const span = Math.abs(end - V.cam0), prog = span > 0 ? Math.abs(w.camX - V.cam0) / span : 1;
      if (V.i < ESC_LAST.at.length && prog >= ESC_LAST.at[V.i] && V.real >= V.until) {
        M.Audio.play('fg_escape' + (V.i + 1)); V.until = V.real + ESC_LAST.ms[V.i] + 600; V.i++;
      }
    }
    // 雑魚: いつも2体くらい。前から多め、たまに後ろから
    const alive = w.enemies.filter((e) => !e.boss && !e.dead && e.state !== 'dying').length;
    S.cool -= dt;
    const atEnd = Math.abs(w.camX - end) < 2;
    if (!atEnd && alive < (S.cfg.zako || 2) && S.spawned < S.cap && S.cool <= 0) {
      const ids = S.cfg.zako_ids || ['mega_goblin'], id = ids[Math.floor(Math.random() * ids.length)];
      const front = Math.random() < 0.72, fromLeft = front ? w.rtl : !w.rtl;
      const y = w.walkY[0] + (w.walkY[1] - w.walkY[0]) * rand(0.15, 0.85);
      const e = new M.Enemy(M.MON[id] || M.MON.goblin, fromLeft ? w.camX - 30 : w.camX + M.W + 30, y, { slot: 40 + S.spawned, enterTo: fromLeft ? w.camX + rand(30, 70) : w.camX + M.W - rand(30, 70) });
      e.sectionId = '_esc'; e.dropWeapon = false;
      w.enemies.push(e); S.spawned++; S.cool = rand(900, 1600);
    }
    // ダンダルモン: カメラが行き止まりに着いたら、ミカが近づくと目覚める（目覚めたら startDand）
    if (S.dand && atEnd && S.dand.seated && !S.dand.wakeCb) S.dand.wakeCb = () => startDand(w, S);
    if (!S.dand && atEnd && alive === 0 && m.state !== 'entrance') {
      S.phase = 'end';
      if (S.cfg.boss === 'dark_mika') { S.ctl = darkMulti(w, { count: S.cfg.boss_count || 4, total: T.escape.darkMikaTotal || 10, hp_ratio: S.cfg.hp_ratio || 1 / 3, cool_mul: T.escape.darkMikaCoolMul || 1, dmg_mul: T.escape.darkMikaDmgMul || 1, hp_add: T.escape.darkMikaHpAdd || 0 }, () => { S.phase = 'exit'; S.t = 0; }); S.phase = 'boss'; }
      else startHole(w, S, true);
    }
  }
  if (S.phase === 'boss' && S.ctl) S.ctl.update(dt);
  // ダンダルモン: 体の中へは入れない（左に置いた時は右側から）
  if (S.dand && S.dand.state !== 'dying' && !S.dand.gone) {
    const b = S.dand, d = b.fl ? -1 : 1, lim = b.bodyFront() - d * 4;
    const clampX = (a, gap) => { const l = lim - d * gap; if (d > 0 ? a.x > l : a.x < l) a.x = l; };
    clampX(m, 0); clampX(r, 10); clampX(E, 24);
  }
  if (S.hole) updateHole(w, S, dt);
  if (S.phase === 'exit') updateExit(w, S, dt);
}
function startDand(w, S) {
  const b = S.dand;
  w.bosses.push(b); w.boss = b;
  S.phase = 'boss';
  b.active = true; b.cool = 900;
  b.onDeath = () => { w.holdAttacks = false; for (const e of w.enemies) if (!e.boss && !e.dead && e.state !== 'dying') e.vanish = true; };
  b.onDeathDone = () => startHole(w, S, false);
  M.Audio.voice('boss_encount');
}
// ---------------------------------------------------------------- 床を殴って穴 → 3人で飛び込む → 次の階へ
function startHole(w, S, stuck) {
  const m = w.mika, dir = w.rtl ? -1 : 1;
  S.phase = 'hole';
  w.cutscene = true; w.lockInput = true; w.holdAttacks = true; w.timerRunning = false;
  for (const p of w.projectiles) if (p.team === 'enemy') p.remove = true;
  m.endWeaponHold(); if (m.z > 0) m.z = 0;
  const hy = w.walkY[0] + 10;   // 2026-10-11 ユーザー指定: 床の奥寄り（下すぎた）
  // 穴の位置: 画面の進む側の端から少し手前（6Bは閉じたエレベーターの手前）
  const hx = M.EscapeV062.holePoint(w).x;   // v062: 予告のひびと同じ位置（世界座標で固定）   // 左に置いたダンダルモンの後は右寄り   // ダンダルモンの後は瓦礫から離した左寄り（2026-10-11 穴とダンダルモンが重なっていたので150→104）
  S.hole = { step: stuck ? 'door' : 'walk', t: 0, x: hx, y: hy, r: 0, stuck, debris: [] };
  if (!['idle', 'walk'].includes(m.state)) m.setState('idle', 'idle');
  if (stuck) m.goTo(w.rtl ? w.camX + 52 : w.camX + M.W - 52, hy + 2, () => { S.hole.step = 'stuck'; S.hole.t = 0; m.face = dir; }, null);
  else m.goTo(hx - dir * 14, hy, () => { S.hole.step = 'slam'; S.hole.t = 0; m.face = dir; }, null);
}
function updateHole(w, S, dt) {
  const H = S.hole, m = w.mika, r = w.robot, E = S.E, dir = w.rtl ? -1 : 1, L = S6().hole, s = dt / 1000;
  H.t += dt;
  w.cutscene = true; w.lockInput = true;
  for (const d of H.debris) { d.vz -= 500 * s; d.x += d.vx * s; d.z = Math.max(0, d.z + d.vz * s); if (d.z === 0) d.vx *= 0.8; }
  // 長老とロボは穴の後ろへ集まる
  const gather = (a, gx, gy, sp) => { const dx = gx - a.x, dy = gy - a.y; a.x += clamp(dx, -sp * s, sp * s); a.y += clamp(dy, -40 * s, 40 * s); return Math.abs(dx) < 2 && Math.abs(dy) < 2; };
  if (H.step === 'door' || H.step === 'walk' || H.step === 'stuck' || H.step === 'slam' || H.step === 'after') {
    if (!E.diving) { const ok = gather(E, H.x - dir * 52, H.y - 4, 45); E.walking = !ok; E.shiver = false; E.pose = 'elder_idle'; if (!ok) E.face = dir; E.t += dt; }
    if (r.state !== 'scripted') r.setState('scripted', 'robot_move', { loop: true });
    if (!r.diving) { const ok = gather(r, H.x - dir * 66, H.y + 10, 100); if (!ok) r.anim.update(dt); r.face = dir; }
  }
  if (H.step === 'stuck') {
    if (H.t < 60 && !H.s1) { H.s1 = true; M.Audio.play('elev_door'); /* 2026-10-12 ユーザー指定: 文字のセリフは出さない（動きと音だけ） */ }
    if (H.t > 1700 && !H.s2) { H.s2 = true; m.face = -dir; }
    if (H.t > 2900) { H.step = 'walk'; H.t = 0; m.goTo(H.x - dir * 14, H.y, () => { H.step = 'slam'; H.t = 0; m.face = dir; }, null); }
  }
  if (H.step === 'slam') {
    if (!H.started) { H.started = true; m.setState('scripted', 'mika_slam', { hold: true }); M.Audio.play('jump'); }
    const t = H.t;
    m.z = t < 300 ? 26 * Math.sin(Math.PI / 2 * t / 300) : t < 560 ? 26 * (1 - (t - 300) / 260) : 0;
    if (t >= 560 && !H.hit) {
      H.hit = true; w.shake = 4; M.Audio.play('hit_heavy'); M.Audio.play('elevator_stop'); boom(w, H.x, H.y, 0, 2);
      for (let i = 0; i < 12; i++) H.debris.push({ x: H.x + rand(-10, 10), y: H.y + rand(-4, 6), z: 2, vx: rand(-90, 90), vz: rand(90, 220), c: Math.random() < 0.5 ? '#3b3a48' : '#6a6878' });
    }
    if (H.hit) H.r = clamp((t - 560) / 220, 0, 1);
    if (t >= 1500) { H.step = 'dive'; H.t = 0; m.setState('idle', 'idle'); m.z = 0; }
  }
  if (H.step === 'dive') {
    // 長老 → ロボ → ミカの順に飛び込む
    const order = [[E, 200], [r, 750], [m, 1300]];
    for (const [a, start] of order) {
      if (H.t >= start && !a.diving) { a.diving = { t: 0, x0: a.x, y0: a.y }; a.noShadow = true; if (a === m) { m.setState('scripted', 'jump'); m.anim.i = 1; M.Audio.play('jump'); } if (a === E) { E.pose = 'elder_panic'; E.walking = false; } }
      const d = a.diving; if (!d) continue;
      d.t += dt; const k = clamp(d.t / 420, 0, 1);
      a.x = d.x0 + (H.x - d.x0) * k; a.y = d.y0 + (H.y - 1 - d.y0) * k;
      a.z = d.t < 420 ? 34 * Math.sin(Math.PI * k) : -(d.t - 420) * 0.25;
      if (a === m) m.anim.i = d.t < 210 ? 1 : 3;
    }
    if (m.diving && m.diving.t > 700 && !H.left) {
      H.left = true;
      w.transition(() => nextFloor(w), { music: false, fadeMs: 600 });
    }
  }
}
function nextFloor(w) {
  const order = M.REF.stageMaps.stages['6'].order, next = order[order.indexOf(w.mapId) + 1];
  w.saveCarry(false);
  const m = w.mika; m.noShadow = false; w.robot.noShadow = false;
  if (!next) return;
  M.s6carry = { drop: true };
  M.setScene(new M.World(next, { run: w.run, entry: 'drop', arrive: [M.REF.stageMaps.maps[next].start[0], 180], onDone: w.onDone, onGameOver: w.onGameOver }));
}
// 穴: 床の上（役者より奥）に黒い楕円と縁。手前側は床の絵を描き直して、落ちていく体を隠す
function drawHoleBack(w) {
  M.EscapeV062.drawCrack(w);   // v062: 殴る前から床にひび
  const H = w.s6 && w.s6.hole; if (!H || H.r <= 0) return;
  const ctx = M.ctx, sx = Math.round(H.x - w.camX), R = ESC.holeR * H.r;
  ctx.fillStyle = '#2a2632'; ctx.beginPath(); ctx.ellipse(sx, H.y, R + 4, R * 0.36 + 2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#050308'; ctx.beginPath(); ctx.ellipse(sx, H.y, R, R * 0.32, 0, 0, Math.PI * 2); ctx.fill();
}
function drawHoleFront(w) {
  const H = w.s6 && w.s6.hole; if (!H) return;
  const ctx = M.ctx, sx = Math.round(H.x - w.camX), R = ESC.holeR * H.r;
  if (H.r > 0) {
    const im = M.bg(w.map.layers[0].bg);
    if (im) {
      // 2026-10-11 穴の手前（下半分の縁より手前）だけ床を描き直して、落ちていく体を隠す。上半分は塗らない（前は上半分が床で埋まっていた）
      ctx.save(); ctx.beginPath(); ctx.rect(sx - R - 6, H.y, 2 * R + 12, 80);
      ctx.moveTo(sx + R, H.y); ctx.ellipse(sx, H.y, R, R * 0.32, 0, 0, Math.PI); ctx.closePath(); ctx.clip('evenodd');
      ctx.drawImage(im, -Math.round(w.camX), 0);
      ctx.restore();
    }
    ctx.strokeStyle = '#2a2632'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(sx, H.y, R + 1, R * 0.32 + 1, 0, 0, Math.PI); ctx.stroke(); ctx.lineWidth = 1;
  }
  for (const d of H.debris) { ctx.fillStyle = d.c; ctx.fillRect(Math.round(d.x - w.camX), Math.round(d.y - d.z), 3, 2); }
}
// ---------------------------------------------------------------- 6F: ダークミカを倒したら、長老と左の出口へ → エンディング
function updateExit(w, S, dt) {
  const m = w.mika, r = w.robot, E = S.E, s = dt / 1000;
  S.t = (S.t || 0) + dt;
  if (!S.exit) {
    S.exit = true; w.finishMapTime();
    w.cutscene = true; w.lockInput = true; w.holdAttacks = true; w.timerRunning = false;
    for (const e of w.enemies) if (!e.boss && !e.dead && e.state !== 'dying') e.vanish = true;
    m.endWeaponHold(); if (m.z > 0) m.z = 0;
    m.goTo(w.camX - 40, clamp(m.y, w.walkY[0], w.walkY[1]), null, T.mika.dashSpeed);
    r.setState('scripted', 'robot_move', { loop: true }); r.face = -1;
    M.Audio.fadeOutMusic(2500);
  }
  r.x -= 150 * s; r.anim.update(dt);
  E.shiver = false; E.face = -1; E.t += dt;
  if (!S.okDone) { if (!S.okT) { S.okT = 1; E.walking = false; E.pose = 'elder_ok'; /* OKのポーズだけ（文字なし） */ } if (S.t > 700) S.okDone = true; }
  else { E.x -= 70 * s; E.walking = true; E.pose = 'elder_idle'; }
  if ((S.t > 2400 && E.x < w.camX - 10 || S.t > 6000) && !S.left) {
    S.left = true;
    w.transition(() => { w.saveCarry(false); M.setScene(new M.EscapeV062.BuildingCollapse(() => M.setScene(new Ending(w.run)), w)); }, { music: false, fadeMs: 1200 });   // v062: ビル崩壊 → テラス
  }
}
function escFront(w) {
  const S = w.s6;
  if (S && S.dand) S.dand.drawOver();
  drawHoleFront(w);
  drawDebris(w);   // v120
  drawAlarm(w);
  drawSay(w);
}
for (const k of ['6B', '6CDE', '6F']) M.mapHooks[k] = { init: escInit, update: escUpdate, drawFront: escFront };

// ================================================================== エンディング（2026-10-11 v032 の ending_controller / ending_renderer を移植）
//   テラス（少し傾いて離れていく）→ 短い暗転 → 外観: 長い空中列車が左上へ・街が大爆発 → 空へ上がって暗転
//   → スタッフロール（画面の上を小さな長編成の列車が走り、雲・森・村・山・町・海・砂漠…と景色が移る）
//   → 列車が加速して去る → 太陽の余韻とゆっくりフェード → THE END（10秒）→ 獲得トレジャー一覧とスコア → タイトル
//   曲はスタッフロールから（4ABの曲）。それまでは列車の走行音と爆発音。テラスのセリフの声は未着（字幕だけ）
// 2026-10-12 v060（v059へ追加）: テラス12.8秒（ミカの声1本目）→ 爆発 → 汽車だけで上昇しながらミカの声2本目 → 余韻 → 最後のアナウンス → 汽笛で上昇を強める → 3秒フェード → 黒1秒 → スタッフロール
const EP = [['departCity', 12.8], ['cutBlack', 0.28], ['watchCity', 1], ['cityExplosion', 5.5], ['riseToSky', 34.78], ['fadeBlack', 3], ['blackHold', 1],
  ['credits', 72], ['trainLeaves', 5], ['afterglow', 5], ['sunsetFade', 8], ['endBlack', 1], ['theEnd', 10], ['results', Infinity]];
const SCENES = ['clouds', 'forest', 'village', 'mountain', 'town', 'sea', 'desert', 'forest', 'village', 'town'];
const CREDITS_AT = 58.36;
// 声と音のきっかけ（テラス開始からの秒）。声は時計を止めない（鳴らない環境でも映像はそのまま進む）
const ENDFADE = { musicFrom: 5, screenFrom: 5, screenMs: 5, resultsIn: 0.8 };   // 2026-10-12 THE END の5秒目から5秒かけて、曲と画面を一緒にゆっくり消す   // THE END（10秒）の曲のフェード・画面を暗くし始める秒と長さ、リザルトが明るくなる秒
const ECUE = [[1, 'ending_mika'], [15.38, 'ending_mika2'], [28.14, 'last_announce'], [46.36, 'train_horn'], [CREDITS_AT + 72 + 5 + 4, 'train_horn', { gain: 0.5 }]];
const ENOD = { from: 9.9, to: 11.8 };   // 長老がほっとして頷く（v059 の elder_relief_up/nod が無い時は頭を下げる動きで代用）
T.endingClackGain = T.endingClackGain != null ? T.endingClackGain : 0.4;
T.endingTrainDuck = T.endingTrainDuck != null ? T.endingTrainDuck : 0.55;   // 声の間の走行音の大きさ（×0.55 ≒ -5dB）   // ガタンゴトンの大きさ（train_inside の通常の音量×0.4 ≒ -8dB）
// 獲得トレジャー一覧（v032 result_catalog の32種）
const RESULT = [
  ['money_bag', 'ドル袋'], ['banknotes', '札束'], ['cash_suitcase', 'スーツケース'], ['ring', '指輪'], ['gem', '宝石'], ['bracelet', 'ブレスレット'], ['necklace', 'ネックレス'], ['gold_statue', '金の彫像'],
  ['crown', '王冠'], ['diamond', 'ダイヤモンド'], ['game_cartridge', 'ゲームソフト'], ['game_console', 'ゲーム機'], ['ace_hearts', 'ハートのエース'], ['ace_spades', 'スペードのエース'], ['ace_clubs', 'クローバーのエース'], ['ace_diamonds', 'ダイヤのエース'],
  ['chocolate', 'チョコレート'], ['apple', 'りんご'], ['potion', 'ポーション'], ['high_potion', 'ハイポーション'], ['elixir', 'エリクサー'],
  ['katana', '刀'], ['war_axe', '戦塵の斧'], ['machinegun', 'マシンガン'], ['rocket_launcher', 'ロケットランチャー'], ['yoichi_bow', 'よいちのゆみ'], ['flamethrower', '火炎放射器'], ['gungnir', 'グングニルのやり'],
  ['battle_hammer', 'バトルハンマー'], ['rocket_punch', 'ロケットパンチ'], ['wave_cannon', '波動砲'], ['aegis_shield', 'イージスの盾'],
];
const ALIAS = { submachinegun: 'machinegun', '与一の弓': 'yoichi_bow', 'よいちの弓': 'yoichi_bow', 'よいちのゆみ': 'yoichi_bow' };
const HI_KEY = 'treasureHunterMika.highScore.v1';
class Ending {
  constructor(run) {
    this.run = run; this.el = 0; this.pi = 0; this.pt = 0; this.cues = {};
    this.bonus = Object.values(run.mapFinal || {}).reduce((a, b) => a + b, 0) * T.mapTime.bonusPerSecond;
    this.score = run.score + this.bonus;
    const G = M.game || {};
    if (M.game) { G.score = this.score; for (const st of [5, 6]) if (!G.cleared.includes(st)) G.cleared.push(st); }
    // ハイスコア（実際の結果から記録。ブラウザに保存できない時はこの回だけ）
    let hi = 0; try { hi = Math.max(0, Number(localStorage.getItem(HI_KEY)) || 0); } catch (e) { /* 保存できない環境 */ }
    this.newRecord = this.score > hi; this.hi = Math.max(hi, this.score);
    try { localStorage.setItem(HI_KEY, String(this.hi)); } catch (e) { /* 保存できない環境 */ }
    const got = {}; for (const [k, n] of Object.entries(G.items || {})) { const id = ALIAS[k] || k; got[id] = Math.min(99, (got[id] || 0) + n); }
    this.items = RESULT.map(([id, name]) => ({ id, name, count: got[id] || 0 }));
    this.mika = new M.Anim('idle', { loop: true }); this.robo = new M.Anim('robot_idle', { loop: true });
    this.E = S6().ending; this.fade = 0;
    unduck(); M.Audio.stopMusic();
    this.cued = 0; this.voices = [];
  }
  get phase() { return EP[this.pi][0]; }
  // 2026-10-12 ユーザー指定: スタッフロールの前は列車のガタンゴトン（車内の走行音）も小さく重ねる。ミカの声の邪魔にならない音量
  clack() { if (!this.clackV || this.clackV.ended) this.clackV = M.Audio.play('train_inside', { loop: true, gain: T.endingClackGain }); M.Audio.touchLoop(this.clackV); }
  update(dt) {
    const s = dt / 1000, I = M.Input;
    this.mika.update(dt); this.robo.update(dt);
    if (this.leaving) { this.fade = Math.min(1, this.fade + dt / 1200); if (this.fade >= 1 && !this.done) { this.done = true; M.Audio.stopMusic(); if (M.game) M.game.endingSeen = true; M.setScene(new M.Title()); }   /* v125 クリア後のタイトルに長老 */ return; }
    let h = s;
    while (h > 1e-9) {
      const d = EP[this.pi][1], step = Math.min(h, d - this.pt);
      this.pt += step; this.el += step; h -= step;
      if (this.pt + 1e-8 >= d) { this.pi++; this.pt = 0; this.enter(this.phase); }
    }
    while (this.cued < ECUE.length && this.el >= ECUE[this.cued][0]) {
      const [, k, o] = ECUE[this.cued++], v = M.Audio.play(k, o || {});
      if (v && k !== 'train_horn') this.voices.push(v);
    }
    this.voices = this.voices.filter((v) => !v.ended && !(v.el && v.el.ended));
    // 音: スタッフロールまでは列車の走行音（ループ）。爆発は街の大爆発で
    if (this.phase === 'theEnd' && this.pt >= ENDFADE.musicFrom && !this.musicFade) { this.musicFade = true; M.Audio.fadeOutMusic(ENDFADE.screenMs * 1000); }
    if (this.el < CREDITS_AT) {
      if (!this.runV || this.runV.ended) this.runV = M.Audio.play('train_outside', { loop: true }); M.Audio.touchLoop(this.runV); this.clack();
      // 声の間は走行音を下げる（声の邪魔をしない）。終わったら滑らかに戻す
      const want = this.voices.length ? T.endingTrainDuck : 1; this.trainK = this.trainK == null ? want : this.trainK + (want - this.trainK) * Math.min(1, dt / 300);
      // 2026-10-12 スタッフロール前の暗転（3秒）に合わせて、列車の音もゆっくり消す（前は暗転の後に突然止まっていた）
      const fadeAt = CREDITS_AT - 1 - 3, fk = this.el < fadeAt ? 1 : Math.max(0, 1 - (this.el - fadeAt) / 3), k = this.trainK * fk * fk;
      for (const v of [this.runV, this.clackV]) if (v) { if (v.g) { v.g0 = v.g0 || v.g.gain.value; v.g.gain.value = v.g0 * k; } else if (v.el) { v.b0 = v.b0 || v.el.volume; v.el.volume = Math.min(1, v.b0 * k); } }
    }
    else { if (this.runV) { M.Audio.stopLoop(this.runV); this.runV = null; } if (this.clackV) { M.Audio.stopLoop(this.clackV); this.clackV = null; } }

    if (this.phase === 'results' && this.pt > 1 && (I.pressed.start || I.pressed.attack || I.pressed.jump)) { this.leaving = true; M.Audio.fadeOutMusic(1200); }
  }
  enter(p) {

    if (p === 'credits') M.Audio.playMusic('ending');
    // 2026-10-12 ユーザー指定: THE END の間にエンディングの曲をゆっくり消し、画面もゆっくり暗くしてから、リザルトはワールドマップの曲
    if (p === 'results') { M.Audio.stopMusic(); M.Audio.playMusic('map'); }
  }
  // ---- v032 の描画をそのまま（座標・時間も同じ）
  snap() {
    const el = this.el, ph = this.phase, pt = this.pt, span = 72 / SCENES.length;
    const index = ph === 'credits' ? Math.min(SCENES.length - 1, Math.floor(pt / span)) : SCENES.length - 1;
    const coastT = Math.max(0, el - (CREDITS_AT + 72 + 5)), coast = Math.min(1, coastT / 3);
    return {
      el, ph, pt, scenery: ph === 'credits' ? SCENES[index] : SCENES[SCENES.length - 1], prev: SCENES[Math.max(0, index - 1)],
      blend: ph === 'credits' && index > 0 ? Math.min(1, (pt % span) / 1.5) : 1,
      pano: coastT > 0 ? CREDITS_AT + 72 + 5 + 1 - Math.pow(1 - coast, 3) : el,
      sunA: ph === 'trainLeaves' ? clamp((pt - 3.2) / 1.8, 0, 1) : 1, fadeP: ph === 'sunsetFade' ? Math.min(1, pt / 8) : 0,
      flight: clamp(el - 13.08, 0, 41.28), cityOff: ph === 'departCity' ? pt * 2.8 : Math.max(0, el - 12.8) * 7,
      closing: ph === 'afterglow' ? pt : ph === 'sunsetFade' ? 5 + pt : 0,
      distant: ph === 'afterglow' ? Math.max(0, (pt - 4) / 9) : ph === 'sunsetFade' ? Math.min(1, (1 + pt) / 9) : 0,
      trainX: ph === 'trainLeaves' ? 30 - 2400 * Math.pow(pt / 5, 2.6) : 30,
    };
  }
  sky(t) {
    const c = M.ctx; c.fillStyle = '#0a1b39'; c.fillRect(0, 0, 384, 216);
    for (let i = 0; i < 45; i++) { c.fillStyle = i % 3 ? '#477399' : '#a9c9d4'; c.fillRect((i * 79 + t * 8) % 420 - 20, i * i * 17 % 110, 1, 1); }
    for (let i = 0; i < 4; i++) { const x = (i * 149 + t * 35) % 550 - 140, y = 95 + i % 2 * 30; c.fillStyle = '#244367'; for (let j = 0; j < 6; j++) c.fillRect(x + j * 11, y - j % 3 * 3, 25, 5); }
  }
  panorama(name, t, speed = 28) {
    const c = M.ctx, im = M.bg('end_' + name), w = 420, off = Math.floor((t * speed) % (w * 2)); if (!im) return;
    for (let i = -2; i < 2; i++) { c.save(); c.translate(i * w + off + (i % 2 ? w : 0), 0); if (i % 2) c.scale(-1, 1); c.drawImage(im, -1, 0, w + 2, 216); c.restore(); }
  }
  streaks(t, diagonal = false, boost = 1) {
    const c = M.ctx; c.save(); c.globalAlpha = 0.2; c.strokeStyle = '#e8f9ff'; c.lineWidth = 1;
    for (let i = 0; i < 30; i++) { const x = (i * 73 + t * 360 * boost) % 700 - 180, y = (i * 41 + t * (diagonal ? 165 : 0)) % 240 - 12; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 40 * boost, y + (diagonal ? 24 * boost : 0)); c.stroke(); }
    c.restore();
  }
  train(x, y, width, t, angle = 0, boost = 1) {
    const c = M.ctx, im = M.bg('end_airtrain'), TR = M.END_TRAIN; if (!im || !TR) return;
    const k = width / TR.w, h = Math.min(angle ? 46 : 28, TR.h * k);
    c.save(); c.translate(x, y + Math.sin(t * 17) * 0.5); c.rotate(angle);
    c.drawImage(im, 0, 0, TR.w, TR.h, 0, 0, width, h);
    // 中の車両1両（左の連結器ごと）を後ろへつなげて長編成に。機関車は繰り返さない
    const [cx0, , cwS] = TR.car, cw = cwS * k;
    for (let i = 0; i < 32; i++) { const dx = width + i * cw; if (x + dx > 430 && !angle) break; if (x + dx + cw < -20 && !angle) continue; c.drawImage(im, cx0, 0, cwS, TR.h, dx, 0, cw, h); }
    c.save(); c.globalAlpha = 0.6; c.strokeStyle = '#def9ff'; c.lineWidth = 1;
    for (let j = 0; j < 6; j++) { const f = (t * 3 + j / 6) % 1, yy = h / 2 + (j % 2 ? 1 : -1) * (h / 2 + 3 + f * 6); c.beginPath(); c.moveTo(-8 - f * 24, yy); c.quadraticCurveTo(12, yy + (j % 2 ? -4 : 4), 55 + f * 90 * boost, yy); c.stroke(); }
    c.restore(); c.restore();
  }
  blast(u, offset) {
    const c = M.ctx, cx = 280, cy = 136 + offset; c.save();
    if (u < 2.2) {
      const life = Math.max(0, 1 - u / 2.2); c.save(); c.globalCompositeOperation = 'screen';
      const g = c.createRadialGradient(cx, cy, 0, cx, cy, 45 + u * 110); g.addColorStop(0, '#fffbe5'); g.addColorStop(0.25, '#ffcc58'); g.addColorStop(1, '#ff501000');
      c.fillStyle = g; c.fillRect(0, 0, 384, 216); c.restore();
      for (let i = 0; i < 20; i++) { const a = i * Math.PI / 10 + u * 0.12, r = 35 + u * 145; c.fillStyle = i % 2 ? '#ffe5a5' : '#ff7935'; c.globalAlpha = life; c.beginPath(); c.moveTo(cx + Math.cos(a - 0.055) * r * 0.35, cy + Math.sin(a - 0.055) * r * 0.2); c.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.65); c.lineTo(cx + Math.cos(a + 0.055) * r * 0.35, cy + Math.sin(a + 0.055) * r * 0.2); c.fill(); }
      c.globalAlpha = 1;
    }
    for (let i = 0; i < 22; i++) { const a = i * 2.4, v = 65 + i % 5 * 17, x = cx + Math.cos(a) * u * v, y = cy + Math.sin(a) * u * v * 0.65 + u * u * 19; c.fillStyle = i % 3 ? '#453b46' : '#ffc75e'; c.fillRect(x, y, 3 + i % 3, 2 + i % 2); }
    for (let j = 0; j < 3; j++) { const r = Math.max(0, u * 115 - j * 24); if (r > 0 && r < 400) { c.strokeStyle = j ? '#ff8c39' : '#fff0b8'; c.lineWidth = j ? 2 : 3; c.beginPath(); c.ellipse(cx, cy, r, r * 0.38, 0, 0, Math.PI * 2); c.stroke(); } }
    for (let i = 0; i < 48; i++) {
      const p = Math.max(0, u - (i % 8) * 0.08); if (!p) continue;
      const a = i * 2.399, r = Math.min(62, p * 45), x = cx + Math.cos(a) * Math.min(130, p * 69), y = cy + Math.sin(a) * Math.min(44, p * 25) - Math.max(0, p - 1) * 29;
      c.fillStyle = p < 0.8 ? '#fff2c1' : p < 1.8 ? '#ffb348' : p < 2.7 ? '#e5592d' : '#3e3944'; c.beginPath(); c.arc(Math.round(x / 2) * 2, Math.round(y / 2) * 2, r * (0.4 + i % 4 * 0.14), 0, Math.PI * 2); c.fill();
      if (p < 2.7) { c.fillStyle = p < 1.3 ? '#fffad6' : '#ff9b39'; c.beginPath(); c.arc(x, y, r * 0.24, 0, Math.PI * 2); c.fill(); }
    }
    for (let i = 0; i < 40; i++) { const a = i * 2.41, r = Math.min(220, u * 95), x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * 0.5 - u * 10; c.fillStyle = i % 2 ? '#ffd76b' : '#fa7833'; c.fillRect(x, y, 2, 2); }
    c.restore();
  }
  sunlight(S) {
    const c = M.ctx, x = 303, y = 42, pulse = 0.75 + Math.sin(S.el * 2.1) * 0.12; c.save(); c.globalAlpha = S.sunA; c.globalCompositeOperation = 'screen';
    const g = c.createRadialGradient(x, y, 1, x, y, 35); g.addColorStop(0, '#fffbd3'); g.addColorStop(0.3, '#ffe1a077'); g.addColorStop(1, '#ffe1a000'); c.fillStyle = g; c.fillRect(x - 35, y - 35, 70, 70);
    c.fillStyle = '#fff2c8'; c.beginPath(); c.arc(x, y, 6, 0, Math.PI * 2); c.fill();
    c.globalAlpha = S.sunA * pulse; c.strokeStyle = '#fffad6'; c.lineWidth = 1;
    for (let j = 0; j < 4; j++) { const an = j * Math.PI / 4, r = 12 + (j % 2 ? 0 : 5) + Math.sin(S.el * 2) * 3; c.beginPath(); c.moveTo(x - Math.cos(an) * r, y - Math.sin(an) * r); c.lineTo(x + Math.cos(an) * r, y + Math.sin(an) * r); c.stroke(); }
    for (let i = 0; i < 4; i++) { const a = S.el * 0.18 + i * 1.6, xx = x + Math.cos(a) * (17 + i * 4), yy = y + Math.sin(a) * (11 + i * 2), al = Math.max(0, Math.sin(S.el * 1.8 + i * 2)); c.globalAlpha = S.sunA * al * 0.55; c.fillRect(xx - 2, yy, 5, 1); c.fillRect(xx, yy - 2, 1, 5); }
    c.restore();
  }
  draw() {
    const c = M.ctx, S = this.snap(), ph = S.ph;
    c.save(); c.imageSmoothingEnabled = false; c.fillStyle = '#000'; c.fillRect(0, 0, 384, 216);
    if (ph === 'theEnd') {
      M.text(this.E.end, 192, 92, { scale: 3, align: 'center', color: '#ffe5ad', edge: '#5a2a08' });
      if (S.pt > ENDFADE.screenFrom) { const u = clamp((S.pt - ENDFADE.screenFrom) / ENDFADE.screenMs, 0, 1); c.fillStyle = `rgba(0,0,0,${(u * u * (3 - 2 * u)).toFixed(3)})`; c.fillRect(0, 0, 384, 216); }
    } else if (ph === 'results') {
      this.drawResults();
      if (S.pt < ENDFADE.resultsIn) { c.fillStyle = `rgba(0,0,0,${(1 - S.pt / ENDFADE.resultsIn).toFixed(3)})`; c.fillRect(0, 0, 384, 216); }
    }
    else if (ph === 'blackHold' || ph === 'cutBlack' || ph === 'endBlack') { /* 黒 */ }
    else if (['departCity', 'watchCity', 'cityExplosion', 'riseToSky', 'fadeBlack'].includes(ph)) {
      this.sky(S.el);
      c.save(); c.translate(0, S.cityOff); if (S.cityOff < 216) this.panorama('city', S.el, 23); c.restore();
      // 2026-10-12 ユーザー指定: 脱出後にビル崩壊の場面（v062）を挟んだので、列車が上がっていく時の街の大爆発は出さない
      this.streaks(S.el, true);
      if (ph === 'departCity') {
        // v060: テラスはゆっくり上へ離れていく（少しだけ傾く）。声の間も止まらない
        c.save(); c.translate(0, -S.pt * 1.8); c.rotate(0.015);
        const ter = M.bg('ending_terrace'); if (ter) c.drawImage(ter, 0, 0, 384, 216);
        M.drawAnim('idle', this.mika.i, 181, 174, true); M.drawAnim('robot_idle', this.robo.i, 229, 174, true);
        const nodding = S.pt >= ENOD.from && S.pt < ENOD.to, down = nodding && Math.sin((S.pt - ENOD.from) * 5) > 0;
        // v059: 長老はミカたちの方（左）を向く。9.9〜11.8秒は安堵の笑顔と頷きの2コマ
        if (nodding && M.ANIMS.ev_elder_relief_up) M.drawAnim(down ? 'ev_elder_relief_nod' : 'ev_elder_relief_up', 0, 281, 174, false);
        else if (!down || M.ANIMS.ev_elder_relief_up) { c.save(); c.translate(281, 174); c.scale(51 / 58, 51 / 58); M.drawAnim('elder_idle', 0, 0, 0, false); c.restore(); }   // v059 と同じ高さ51px（頷きの絵と揃える）
        else {   // 頭（足元から38px より上）だけ2px下げる
          c.save(); c.beginPath(); c.rect(240, 174 - 38, 90, 60); c.clip(); M.drawAnim('elder_idle', 0, 281, 174, false); c.restore();
          c.save(); c.beginPath(); c.rect(240, 100, 90, 174 - 38 - 100 + 2); c.clip(); M.drawAnim('elder_idle', 0, 281, 176, false); c.restore();
        }
        c.restore();
        if (S.pt > 12.52) { c.fillStyle = `rgba(0,0,0,${Math.min(1, (S.pt - 12.52) / 0.28)})`; c.fillRect(0, 0, 384, 216); }
      } else this.train(30 - S.flight * 0.95, 96 - S.flight * 1.25 - Math.max(0, S.el - 46.36) * 2.2, 490, S.el, 0.15);   // 汽笛から上昇を強める
      if (ph === 'watchCity' && S.pt < 0.18) { c.fillStyle = `rgba(0,0,0,${1 - S.pt / 0.18})`; c.fillRect(0, 0, 384, 216); }

      if (ph === 'fadeBlack') { c.fillStyle = `rgba(0,0,0,${Math.min(1, S.pt / 3)})`; c.fillRect(0, 0, 384, 216); }
    } else {
      const scenery = ph === 'trainLeaves' ? SCENES[SCENES.length - 1] : S.scenery;
      this.panorama(scenery, S.pano);
      if (ph === 'afterglow' || ph === 'sunsetFade') {
        this.sunlight(S);
        // v060: 列車が左へ去った後、余韻4秒で遠景に再登場し、太陽（303,42）へ小さくなっていく
        if (S.closing >= 4 && S.distant < 1) {
          const p = S.distant, u = 1 - p, x = u * u * u * 20 + 3 * u * u * p * 90 + 3 * u * p * p * 205 + p * p * p * 303, y = u * u * u * 40 + 3 * u * u * p * 45 + 3 * u * p * p * 55 + p * p * p * 42, wd = 54 * Math.pow(1 - p, 1.6);
          const im = M.bg('end_airtrain'), TR = M.END_TRAIN;
          if (im && TR && wd > 0.5) { c.save(); c.translate(x, y); c.rotate(Math.PI); c.drawImage(im, 0, 0, TR.w, TR.h, 0, -wd * 0.08, wd, wd * 0.08); c.restore(); }
        }
        if (ph === 'sunsetFade') { const u = S.fadeP, a = u * u * (3 - 2 * u); c.fillStyle = `rgba(0,0,0,${a})`; c.fillRect(0, 0, 384, 216); }
      } else {
        if (ph === 'credits' && S.blend < 1) { c.save(); c.globalAlpha = 1 - S.blend; this.panorama(S.prev, S.el); c.restore(); }
        const boost = ph === 'trainLeaves' ? 1 + Math.pow(S.pt / 5, 2) * 7 : 1;
        this.streaks(S.el, false, boost);
        this.train(S.trainX, 31, 340, S.el, 0, boost);
        if (ph === 'trainLeaves') this.sunlight(S);
        if (ph === 'credits') this.drawCredit(S.pt);
      }
    }
    if (ph === 'departCity' && this.el < 1) { c.fillStyle = `rgba(0,0,0,${1 - this.el})`; c.fillRect(0, 0, 384, 216); }   // v062: ビル崩壊の後、テラスは1秒でフェードイン
    if (this.leaving) { c.fillStyle = `rgba(0,0,0,${this.fade})`; c.fillRect(0, 0, 384, 216); }
    c.restore();
  }
  drawCredit(pt) {
    const c = M.ctx, roll = this.E.roll, block = 72 / roll.length, i = Math.min(roll.length - 1, Math.floor(pt / block)), local = pt % block;
    const a = Math.max(0, Math.min(1, local / 0.8, (block - local) / 0.8)), [role, name] = roll[i];
    c.save(); c.globalAlpha = a; c.fillStyle = 'rgba(5,17,38,0.73)'; c.fillRect(32, 140, 320, 60);
    // 2026-10-12 v113 枠（y140〜200）に収める: 字の絵は基準から上16px・下4px（高さ20）なので、2行の中心を枠の上下半分に置く
    //   中心 cy に置くには jpText の y を +6（=字の高さ20の中心）にして、cy を中心に拡大する
    const k = Math.min(i === 0 ? 1.75 : 1.25, 300 / M.jpWidth(role));
    c.save(); c.translate(192, !name ? 170 : i === 0 ? 159 : 155); c.scale(k, k); M.jpText(role, -M.jpWidth(role) / 2, 6, { color: '#fff0c8', edge: '#051126' }); c.restore();
    if (name) { const k2 = Math.min(i === 0 ? 1 : 1.25, 300 / M.jpWidth(name)); c.save(); c.translate(192, i === 0 ? 186 : 182); c.scale(k2, k2); M.jpText(name, -M.jpWidth(name) / 2, 6, { color: '#ffffff', edge: '#051126' }); c.restore(); }
    c.restore();
  }
  // 獲得トレジャー一覧（32種・8列×4段）と今回のスコア
  drawResults() {
    const c = M.ctx;
    c.fillStyle = '#061220'; c.fillRect(0, 0, 384, 216); c.strokeStyle = '#b98b46'; c.strokeRect(9.5, 7.5, 365, 201);
    const tt = this.E.resultTitle; M.jpText(tt, 192 - M.jpWidth(tt) / 2, 26, { color: '#ffe3a3', edge: '#3a1a08' });
    this.items.forEach((it, i) => {
      const x = 16 + (i % 8) * 44, y = 34 + Math.floor(i / 8) * 30;
      c.fillStyle = it.count ? '#16344a' : '#0c2030'; c.fillRect(x, y, 42, 28);
      const fr = M.ATLAS.frames['item_' + it.id] ? 'item_' + it.id : (M.WEAPONS[it.id] && M.ATLAS.frames[M.WEAPONS[it.id].icon] ? M.WEAPONS[it.id].icon : (M.ATLAS.frames.aegis_shield_00 && it.id === 'aegis_shield' ? 'aegis_shield_00' : null));
      // 2026-10-12 v130: 2桁（X10〜X99）でもマスからはみ出さないよう、数は右端（x+41）に収め、そのぶん絵を少し小さく左へ。1桁は前と同じ位置
      const label = 'X' + it.count, adv = M.textAdvance, tx = Math.min(x + 23, x + 41 - (label.length * adv - 1)), room = tx - x - 3;
      if (fr) { const f = M.ATLAS.frames[fr], sc = Math.min(room / f[7], 20 / f[8], 1.5); M.drawFrameX(fr, x + 1 + room / 2, y + 14, { scale: sc, alpha: it.count ? 1 : 0.4 }); }
      M.text(label, tx, y + 8, { color: it.count ? '#fff1c9' : '#6f8092' });
      if (it.count >= 99) M.text('MAX', x + 41, y + 18, { color: '#ffd25d', align: 'right' });
    });
    const lb = this.E.scoreLabel; M.jpText(lb, 192 - M.jpWidth(lb) / 2, 168, { color: '#a9bfd2', edge: '#061220' });
    M.text(String(this.score), 192, 174, { scale: 2, align: 'center', color: '#ffe8a4' });
    M.text((this.newRecord ? 'NEW RECORD!  ' : '') + 'HI-SCORE ' + this.hi, 192, 194, { align: 'center', color: this.newRecord ? '#ffd25d' : '#91a7bb' });
    if (this.pt > 1 && ((this.pt * 2) | 0) % 2 === 0) M.text('PRESS START', 192, 204, { align: 'center', color: '#91a7bb' });
  }
}
M.Ending6 = Ending;
})();
