// main.js — タイトル → ワールドマップ → 1面 → ワールドマップ の流れとメインループ
'use strict';
(function () {
const M = window.MIKA, T = M.TUNING, I = M.Input, REF = M.REF;
const ctx = M.ctx;

const game = { scene: null, score: 0, cleared: [], paused: false };
M.debug = { speed: 1, god: false, bot: null };   // 確認用（自動テストで使う）
// ステージ途中の得点は M.run.score。ワールドマップの表示は game.score
M.game = game;

// ------------------------------------------------------------------ タイトル
// 正式タイトル TREASURE HUNTER MIKA。title_screen.json の background にミカ・ロボ・PRESS START を別描画（完成見本は使わない）
function drawScaled(anim, idx, pos, scale) {
  const a = M.ANIMS[anim]; if (!a) return;
  ctx.save(); ctx.translate(pos[0], pos[1]); ctx.scale(scale, scale);
  M.drawFrame(a.frames[idx % a.frames.length], a.origin[0], a.origin[1], a.origin, false);
  ctx.restore();
}
const TITLE_ATTRACT_MS = 110000;   // v125 タイトル曲が鳴らない時にデモへ移るまで（曲は約104秒）
const TITLE_ELDER = [56, 187];     // v125 クリア後のタイトルの長老の足元（ミカの足元は 138,187）
class Title {
  constructor() {
    this.t = 0; this.fade = { a: 1, dir: -1 };
    this.layers = REF.title.character_layers.map((l) => ({ anim: l.file.startsWith('mika') ? 'idle' : 'robot_idle', pos: l.canvas_position, scale: l.scale, a: new M.Anim(l.file.startsWith('mika') ? 'idle' : 'robot_idle', { loop: true }) }));
    // 2026-10-12 v125 ユーザー指定: タイトル曲はループしない。1回流れ終わったらオープニングのデモ → またタイトル（の繰り返し）
    M.Audio.playMusic(M.AUDIO.music.title ? 'title' : null, { loop: false, onEnd: () => { this.musicDone = true; } });
  }
  update(dt) {
    this.t += dt;
    for (const l of this.layers) l.a.update(dt);
    this.fade.a = M.clamp(this.fade.a + this.fade.dir * dt / (this.fade.ms || 500), 0, 1);
    if (M.KeyConfig && M.KeyConfig.consumeOpen(this)) return;
    // v125 曲が1周したら（鳴らない環境は約110秒で）デモへ。デモはキーで飛ばせて、終わるとまたタイトル
    if (!this.leaving && (this.musicDone || this.t > TITLE_ATTRACT_MS) && M.OpeningV067) {
      M.Audio.stopMusic();
      return setScene(new M.OpeningV067.Opening(() => setScene(new Title()), null, { demoOnly: true }));
    }
    if (!this.leaving && this.t > 300 && (I.pressed.start || I.pressed.attack || I.pressed.jump)) {
      // 2026-10-11 スタート音（約2.5秒）: PRESS START を速く点滅させて1秒待ち、1秒かけて暗転
      // ボタン音が鳴ってから地図へ（音がまだ読み込み中なら、読み終わるのを待って鳴らしてから数え始める）
      this.leaving = true; this.leaveT = 0; this.fade = { a: 0, dir: 0 }; this.sePlayed = false;
      M.Audio.whenReady('title_start').then(() => { M.Audio.play('title_start'); this.sePlayed = true; });
    }
    if (this.leaving && this.sePlayed && (this.leaveT += dt) >= 1000 && this.fade.dir === 0) { this.fade = { a: 0, dir: 1, ms: 1000 }; M.Audio.fadeOutMusic(1000); }   // 2026-10-12 v117 暗転と一緒にタイトル曲を消す
    if (this.leaving && this.fade.a >= 1) { game.score = 0; game.cleared = []; game.items = {}; M.Tutor && M.Tutor.reset(); setScene(new WorldMap(T.prototype.startStage || 1)); }
  }
  draw() {
    ctx.drawImage(M.bg('title_bg'), 0, 0);
    // 2026-10-11 v034: 既存タイトルはそのまま、サブタイトル「ゴブリン族の秘宝」の画像だけをロゴの下に重ねる（ミカとロボより奥）
    const sub = M.ATLAS.frames.title_subtitle;
    if (sub) M.drawFrame('title_subtitle', Math.round((T.ui.subtitleCX || 218) - sub[3] / 2), T.ui.subtitleY || 73, [0, 0], false);   // ミカの頭とロボに重ならない位置
    // v125 クリア後に戻ってきたら、ミカの左に右を向いた長老（ファイナルゴブリン）。ミカより奥に描く
    if (game.endingSeen && M.ANIMS.elder_idle) { ctx.save(); ctx.translate(TITLE_ELDER[0], TITLE_ELDER[1]); ctx.scale(2, 2); M.drawAnim('elder_idle', 0, 0, 0, true); ctx.restore(); }
    for (const l of this.layers) drawScaled(l.anim, l.a.i, l.pos, l.scale);
    // v125 PRESS START → 攻撃に設定したキーの名前（例: PRESS Z BUTTON）
    const atk = (T.keys.attack || [])[0], kn = atk ? (M.KeyConfig && M.KeyConfig.name ? M.KeyConfig.name(atk) : atk.replace(/^Key/, '')) : 'START';
    if (((this.t / (this.leaving ? 80 : 500)) | 0) % 2 === 0) M.text('PRESS ' + kn + ' BUTTON', M.W / 2, 199, { align: 'center' });
    if (M.KeyConfig) M.KeyConfig.drawTitleButton();
    if (this.fade.a > 0) { ctx.fillStyle = `rgba(0,0,0,${this.fade.a})`; ctx.fillRect(0, 0, M.W, M.H); }
  }
}

// ------------------------------------------------------------------ ワールドマップ
// 背景は文字・地点アイコンなしの world_map_clean。WORLD MAP・STAGE N・点滅アイコン・未クリア地域の暗さは別レイヤーで描く
const PLAYABLE = [1, 2, 3, 4, 5];   // 2026-10-11 6面（脱出）は5Jから続けて入る（ワールドマップには出さない）   // 2026-10-10 5面（5A仮・5B〜5H。5I・5Jは未制作）   // 4面は4C（デスポリス駅）だけ。4A・4Bは未制作      // 今回遊べる面（4面以降は未実装と表示して止める）
// v061: 未到達地域は不透明な雲。現在地・過去の地域・クリア済み地域を公開する。
function mapRegionVisible(stage, current, cleared) {
  return stage <= current || cleared.includes(stage);
}
function drawMapCloud(region) {   // 2026-10-12 v065: 陰影のある雲画像で覆う（js/world_map_cloud_v065.js）
  M.WorldMapCloudV065.draw(ctx, region);
}
class WorldMap {
  constructor(stage) {
    this.stage = stage; this.t = 0; this.fade = { a: 1, dir: -1 };
    this.regions = REF.regions.regions;
    this.info = REF.mapNames.stages.find((s) => s.stage_id === stage);
    M.Audio.playMusic(M.AUDIO.music.map ? 'map' : null);
  }
  update(dt) {
    this.t += dt;
    this.fade.a = M.clamp(this.fade.a + this.fade.dir * dt / (this.fade.ms || 500), 0, 1);
    if (!PLAYABLE.includes(this.stage)) {
      // 4面は未実装: 地図の上で待つ。スタートでタイトルへ（未定義のマップへは進まない）
      if (!this.leaving && this.t > 1500 && (I.pressed.start || I.pressed.attack)) { this.leaving = true; this.fade = { a: 0, dir: 1 }; }
      if (this.leaving && this.fade.a >= 1) setScene(new Title());
      return;
    }
    // 2026-10-11 地図の曲を聞かせる: スタート／攻撃で進む（押さなければ showMs で自動）。ステージへは2秒かけて暗転と曲のフェードアウト
    if (!this.leaving && (this.t > T.worldMap.showMs || (this.t > 600 && (I.pressed.start || I.pressed.attack)))) {
      this.leaving = true; this.fade = { a: 0, dir: 1, ms: T.worldMap.leaveFadeMs || 2000 }; M.Audio.fadeOutMusic(T.worldMap.leaveFadeMs || 2000);
    }
    if (this.leaving && this.fade.a >= 1) startStage(this.stage);
  }
  draw() {
    ctx.drawImage(M.bg('world_map'), 0, 0);
    ctx.fillStyle = `rgba(4,6,18,${T.worldMap.dimAlpha})`;
    for (const r of this.regions) {
      if (game.cleared.includes(r.stage)) continue;
      ctx.beginPath(); r.polygon.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.fill();
    }
    for (const r of this.regions) {
      if (!mapRegionVisible(r.stage, this.stage, game.cleared)) drawMapCloud(r);
    }
    const blinkOn = ((this.t / T.worldMap.blinkMs) | 0) % 2 === 0;
    for (const r of this.regions) {
      if (!mapRegionVisible(r.stage, this.stage, game.cleared)) continue;
      const [x, y] = r.node, cur = r.stage === this.stage, done = game.cleared.includes(r.stage);
      if (cur && blinkOn) {
        ctx.fillStyle = 'rgba(255,190,60,0.35)'; ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff2a0'; ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ff9a1a'; ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.fillStyle = '#1a1020'; ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = done ? '#ffd84a' : '#8a2a24'; ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
      }
      M.text(String(r.stage), x, y - 13, { align: 'center', color: done ? '#ffd84a' : cur ? '#fff' : '#9aa' });
    }
    M.text('WORLD MAP', M.W / 2, 6, { scale: 2, align: 'center', color: '#ffc93a', edge: '#6a1a08' });
    M.text('STAGE ' + this.stage, M.W / 2, 202, { align: 'center', color: '#ffd84a' });
    if (this.info && this.info.world_name) M.jpText(this.info.world_name, M.W / 2, 194, { align: 'center', color: '#fff5c5' });
    if (!PLAYABLE.includes(this.stage)) {
      M.text(this.stage > 5 ? 'TO BE CONTINUED  (5I 5J ARE NOT MADE YET)' : 'STAGE ' + this.stage + ' IS NOT MADE YET', M.W / 2, 164, { align: 'center' });
      M.text('PRESS START', M.W / 2, 176, { align: 'center', color: '#9ab' });
    }
    M.text('G ' + String(game.score).padStart(7, '0'), M.W - 6, 4, { align: 'right', color: '#ffd84a' });
    if (this.fade.a > 0) { ctx.fillStyle = `rgba(0,0,0,${this.fade.a})`; ctx.fillRect(0, 0, M.W, M.H); }
  }
}

function startStage(stage, o = {}) {
  const st = REF.stageMaps.stages[stage];
  M.run = M.newRun(stage, game.score);
  const mapId = o.map || st.first;
  const w = new M.World(mapId, {
    run: M.run,
    entry: o.section || o.map ? 'map' : 'stage_start',
    firstEntry: stage === 1 && !o.map && !o.section,     // 1面Aに最初に入った時だけ開始ジングル
    startSection: o.section,
    onDone: (res) => { game.score = res.score; if (!game.cleared.includes(stage)) game.cleared.push(stage); setScene(new WorldMap(stage + 1)); },
    onGameOver: () => M.restartArea(M.world),   // ゲームオーバー: そのエリアからやり直し（点数はエリア開始時＋1）
  });
  setScene(w);
}
M.startStage = startStage;

M.Audio.uiPrep('pause');   // 2026-10-12 v101 ポーズ音は最初から読み込んでおく（初回の押下で遅れない）
function setScene(s) { if (game.paused) M.Audio.resumeAll(); game.scene = s; game.paused = false; if (s instanceof M.World) M.world = s; }
M.setScene = setScene;
M.Title = Title;

// ------------------------------------------------------------------ ループ（60Hz固定）
const STEP = 1000 / 60;
let last = performance.now(), acc = 0;
// ゲームループは常に1本だけ。ページが開いたまま更新されて scripts が読み直されても、
// 古いループが残って二重に進む（倍速になる）ことがないようにする
const LOOP_ID = (window.__MIKA_LOOP_ID = (window.__MIKA_LOOP_ID || 0) + 1);
function frame(now) {
  if (LOOP_ID !== window.__MIKA_LOOP_ID) return;
  acc += Math.min(100, now - last) * (M.debug.speed || 1); last = now;
  while (acc >= STEP) {
    I.update(now);
    if (M.debug.bot) M.debug.bot();
    const sc = game.scene;
    if (sc instanceof M.World && I.pressed.pause) {
      game.paused = !game.paused;
      if (game.paused) M.Audio.pauseAll(); else M.Audio.resumeAll();
      M.Audio.uiSound('pause');   // 2026-10-12 v101 ポーズの ON/OFF 音   // ポーズ中は音楽と演出の時計も止める
    }
    if (!game.paused) sc.update(STEP);
    // 2026-10-12 タイトル・地図・エンディングでも曲のフェードを進める（前は経過0で呼んでいて、フェードアウトが進まず突然止まっていた）
    if (!(game.scene instanceof M.World) && !game.paused) M.Audio.update(STEP);
    I.endFrame();
    acc -= STEP;
  }
  game.scene.draw();
  if (game.paused) {
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, 0, M.W, M.H);
    M.text('PAUSE', M.W / 2, 92, { scale: 2, align: 'center' });
    M.text(M.KeyConfig ? M.KeyConfig.pauseLabel() : 'P / ESC', M.W / 2, 114, { align: 'center', color: '#9ab' });
  }
  requestAnimationFrame(frame);
  if (M.CRT) M.CRT.present();   // ブラウン管風の表示（F3でON/OFF）。失敗してもループは止めない
}

// 確認用のURL: ?skip=1（タイトルとマップを飛ばす） ?stage=2 ?map=2B ?section=EB3 ?hitbox=1 ?boss=1（そのマップのボス区間へ）
// 公開ページでは末尾に #s2 #s3 #s5（2面・3面・5面から）#5B〜#5H #mid5（5Dダンダルモン）#2B #2C #3B #3C #3F3（そのマップから）#boss（1面ボス）#boss2 #boss3 #mini（3A終端）
const qs = new URLSearchParams(location.search);
if (qs.get('skip')) T.prototype.skipTitle = true;
if (qs.get('hitbox')) T.prototype.showHitboxes = true;
if (qs.get('stage')) T.prototype.startStage = +qs.get('stage');
if (qs.get('map')) { T.prototype.startMap = qs.get('map'); T.prototype.startStage = REF.stageMaps.maps[qs.get('map')].stage; }
if (qs.get('section')) T.prototype.startSection = qs.get('section');
if (qs.get('boss')) T.prototype.debugBoss = true;
const hash = (location.hash || '').replace('#', '');
const H = { s2: [2], s3: [3], boss: [1, '1C', 'C5'], boss2: [2, '2C', 'C5'], boss3: [3, '3C', 'C5'], mini: [3, '3F3', 'F3_5'], s4: [4], boss4: [4, '4C', 'C5'], s5: [5], mid5: [5, '5D', 'D2'] };
if (hash === 'ending') T.prototype.debugEnding = true;   // 確認用: #ending でエンディングだけ
if (H[hash]) { const [st, mp, sc] = H[hash]; T.prototype.startStage = st; T.prototype.startMap = mp || null; T.prototype.startSection = sc || null; T.prototype.skipTitle = true; }
else if (REF.stageMaps.maps[hash]) { T.prototype.startMap = hash; T.prototype.startStage = REF.stageMaps.maps[hash].stage; T.prototype.skipTitle = true; }
function bootStage() {
  const P = T.prototype;
  if (P.debugEnding) { M.run = M.newRun(6, 0); return setScene(new M.Ending6(M.run)); }
  if (P.debugBoss && !P.startSection) { P.startMap = P.startMap || REF.stageMaps.stages[P.startStage || 1].order.slice(-1)[0]; P.debugBoss = false; P.startSection = 'C5'; }
  startStage(P.startStage || 1, { map: P.startMap, section: P.startSection });
}

function boot() {
  const el = document.getElementById('loading');
  // 2026-10-12 v067: ロード画面（LONKA CORPORATE PRESENTS）は画像と音の読み込み完了まで → 無音のオープニング → タイトル
  const audioReady = M.OpeningV067.preloadAudio();
  Promise.all([M.loadAssets(), audioReady]).then(() => {
    const now = el && el.querySelector('.loading-now'); if (now && (T.prototype.skipTitle || T.prototype.debugEnding)) now.remove();   // v111 読み込みが終わったら NOW LOADING... を消す（v121: 通常は PRESS ANY KEY に変わる＝opening_v067.js）
    if (T.prototype.skipTitle || T.prototype.debugEnding) { if (el) el.remove(); bootStage(); }
    else setScene(new M.OpeningV067.Opening(() => setScene(new Title()), el));
    requestAnimationFrame(frame);
  }).catch((e) => {
    if (el) el.textContent = String(e.message || e);
  });
}
// 公開ページを開いたまま更新された時は、ビューアの更新フックから起動し直す（ループは LOOP_ID で常に1本）
const hot = window.claude && window.claude.hot;
if (hot && hot.snapshot) hot.snapshot(() => ({ score: game.score }));
if (hot && hot.ready) hot.ready(boot); else boot();
})();
