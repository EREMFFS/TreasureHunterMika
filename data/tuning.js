// =====================================================================
//  トレジャーハンターミカ  調整用の設定ファイル
//  ---------------------------------------------------------------------
//  ここにある数値はすべて「仮設定」です（確定値は別ファイル）。
//    確定値の出どころ: weapon_balance.json / time_rules.json / 指示書 / 敵一覧
//  [確定] と書いた行だけは指示書・採用済み資料どおりの値です。
//  [仮] の行は遊びながら変えてください。時間は ms、距離はゲーム内ピクセル（原寸）。
// =====================================================================
window.MIKA = window.MIKA || {};
MIKA.TUNING = {
  // ------------------------------------------------------------ 試作の範囲
  prototype: {
    startStage: 1,             // 確認用: ?stage=2 などで開始ステージ
    startMap: null,            // 確認用: ?map=2B などで開始マップ
    startSection: null,        // 確認用: ?section=C5 などで開始区間
    skipTitle: false,          // [仮] true でタイトルとマップを飛ばしてすぐ1面へ
    showHitboxes: false,       // [仮] 当たり判定の確認表示（F2キーでも切替）
    debugBoss: false,          // 確認用: A1でボス登場演出とボスBGMを見る（URL ?boss=1）
  },

  // ------------------------------------------------------------ 操作
  keys: {
    left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'],
    attack: ['KeyZ', 'KeyJ'],     // [仮] A攻撃
    jump: ['KeyX', 'KeyK'],       // [仮] Bジャンプ
    start: ['Enter', 'Space'],
    pause: ['KeyP', 'Escape'],    // [確定] P／Esc
  },
  input: {
    dashDoubleTapMs: 230,       // [仮] 横2回の受付時間（指示書で未定）
    attackBufferMs: 160,        // [仮] 攻撃ボタンの先行入力
    tauntHoldMs: 600,           // [仮] Aため→挑発までの長さ（未定）
    directionalAttack: 'hold',  // [仮] ↑/↓を押しながらAで回転蹴り/足払い
  },

  // ------------------------------------------------------------ 演出
  hitstop: {
    normalMs: 110,              // [仮] 通常ヒットの停止（確認GIFの110msを初期値に）
    finisherMs: 150,            // [仮] 決め技の停止（確認GIFの150ms）
    shakeFinisher: 2,           // [仮] 決め技の画面揺れ(px)
  },
  blink: { count: 5, intervalMs: 80 },   // [確定] 撃破後5回点滅→消滅（採用済み確認GIF）

  // ------------------------------------------------------------ ボス
  boss: {
    landShakePx: 2,             // [仮] 着地の揺れ（1面演出v001の初期案 約2px・約0.2秒）
    landShakeMs: 200,
  },

  // ------------------------------------------------------------ HUD
  ui: {
    font: 'ps2p',               // 2026-10-10 英数字のフォント: 'ps2p'（Press Start 2P）／'classic'（従来の5×7）
    hpBarH: 12,                 // ミカ・ロボのゲージの厚み（v0.2の6の2倍）
    hpBarW: 120,
    targetBarH: 8,              // 攻撃対象のゲージ（v0.2の4の2倍）
    targetBarW: 80,
    bossBarH: 12,               // ボスのゲージ（ボス実装時に使用。複数段の配色は未定）
  },

  // ------------------------------------------------------------ ミカ
  mika: {
    maxHp: 100,                 // [仮] HP最大値（未定）
    // 移動の速さを上げても、歩き・ダッシュ・走り・キャタピラーのモーションは animation.json の時間のまま再生する（倍速に見せない）
    walkSpeed: 108,             // [仮] px/秒 横（v0.3の72×1.5。歩きモーションは100ms/コマのまま）
    walkSpeedY: 72,             // [仮] px/秒 縦（軸ずらし。v0.3の48×1.5）
    entranceSpeed: 72,          // [仮] 登場時に歩いて入ってくる速さ（v0.3のまま）
    // --- 2026-10-07 操作感調整（倍率は v0.2 実装が基準）---
    dashSpeed: 187.5,           // [仮] v0.2の150×1.25
    jumpVelocity: 395,          // [仮] 最高到達 約61px（v0.2の約30.6pxの2倍）
    // 2026-10-11 v034 二段ジャンプ: 頂点付近（上昇速度 apexUp 以下〜下降速度 apexDown 以下）でBを離して押し直すと回転二段ジャンプ。着地まで1回
    doubleJump: { vz: 340, apexUp: 210, apexDown: 280 },   // [仮] 二段目の上向き速度（約45px上がる）と受付幅。実プレイで調整
    gravity: 1275,              // [仮] 滞空 約0.62秒（v0.2は0.58秒。高さ2倍でも間延びさせない）
    airControl: 0.6,            // [仮] 空中左右操作の効き（0〜1）
    airSpeed: 151,              // [仮] 移動ジャンプの飛距離 約94px（v0.2の約47pxの2倍）
    dashJumpSpeed: 170,         // [仮] ダッシュジャンプの飛距離 約100px（v0.2の実測約50pxの2倍。同じ向きに入れている間は勢いを保つ）
    jumpPoseVz: 95,             // [仮] 上昇/頂点/下降コマを切り替える速度（v0.2の50を高さに合わせて換算）
    legacyAirSpeed: 80,         // v0.2の空中速度（ジャンプ蹴りの倍率を二重に掛けないための基準）
    slideSpeed: 300,            // [仮] 2026-10-08 速く・遠くへ（190→300）
    slideMs: 420,               // [仮] 2026-10-08 滑る時間 300→420（飛距離 約57→約126px）
    tackleSpeed: 130,
    hurtInvulnMs: 1000,         // [仮] 被ダメージ後の無敵（未定）
    lightHurtMs: 260,           // [仮] のけぞり時間
    downedMs: 700,              // [仮] 倒れている時間（起き上がり前）
    // 2026-10-08 吹っ飛びは威力ではなく「吹っ飛ばし技」と「コンボを食らった時」（ユーザー指定）
    comboKnockHits: 3,          // [仮] この回数を続けて食らうと吹っ飛ぶ
    comboKnockMs: 1500,         // [仮] 「続けて」とみなす時間
    comboGraceMs: 175,          // [仮] 前の技が終わってから次のAを受け付ける時間（v0.2の260÷1.5）
    grabRange: 66,              // [仮] 2026-10-08 掴める距離を3倍（22→66）。少し離れていても歩いて近づけば掴む
    grabDepth: 8,               // [仮] 縦のずれの許容 5→8
    grabWalkMs: 120,            // [仮] 敵へ向かって歩き続けてから掴むまで
    grabReleaseMs: 1600,        // [仮] 掴み中に無操作で手放すまで（未定）
    entranceFromX: -40,         // [確定] 開始時は画面左から歩いて登場（FF2風）
    entranceToX: 72,            //        マップの start x
  },

  // 動作速度の倍率（animation.json のコマ時間をこの倍率で速く再生。ヒットストップは別で短くしない）
  actionSpeed: {
    punch: 3.0, kick_right: 3.0, kick_left: 3.0, strong_punch: 3.0, elbow: 3.0, uppercut: 3.0,  // 通常コンボ 2026-10-08 さらに2倍（1.5→3.0）
    sweep: 2.0,                 // 足払い 2倍（動作時間は半分）
    jump_kick: 1.5,             // ジャンプ蹴り 1.5倍
  },
  jumpKick: { distanceScale: 1.5 },  // ジャンプ蹴り中の水平移動距離（v0.2のジャンプ蹴り比）

  // 斬風エフェクトの取り付け位置（攻撃コマの拳・足先。ミカ足元からの右向きpx。素材から実測）
  fxTips: {
    // 2026-10-11 ユーザー指定（v034「手のオーラ撤去」）: 拳の先の白い斬風は表示しない（punch・strong_punch・elbow を外した）。
    //   当たり判定・リーチ・速度・ダメージは moves 側で変更なし。戻すなら punch: [26, -28], strong_punch: [33, -28], elbow: [15, -37]
    kick_right: [26, -27], kick_left: [39, -27],
    jump_kick: [35, -25],       // アッパーは SMASH 演出があるので斬風なし
  },

  // 素手技: dmg=威力（2026-10-07 斬風v001に合わせ、通常コンボ・ジャンプ蹴りの前方端を+10px＝拳1〜2個分。奥行きは変えない）, reach=[前方の始まり, 終わり], band=[高さ下, 上], depth=奥行きの許容差
  //   type: light=のけぞり / launch=打ち上げ吹っ飛び / down=転倒
  //   [確定] 通常パンチ2。それ以外は [仮]。2026-10-08 コンボの締めアッパー 4→10、掴みアッパー 4→8（爽快感）
  moves: {
    punch:        { dmg: 2, reach: [6, 54],  band: [18, 44], depth: 8, type: 'light' },
    kick_right:   { dmg: 1, reach: [6, 54],  band: [12, 40], depth: 8, type: 'light' },
    kick_left:    { dmg: 1, reach: [8, 62],  band: [12, 40], depth: 8, type: 'light' },
    strong_punch: { dmg: 2, reach: [8, 58],  band: [18, 44], depth: 8, type: 'light' },
    elbow:        { dmg: 2, reach: [4, 48],  band: [18, 44], depth: 8, type: 'light' },
    uppercut:     { dmg: 10, reach: [2, 56],  band: [8, 64],  depth: 9, type: 'launch', finisher: true, smash: true },
    somersault:   { dmg: 3, reach: [-6, 56], band: [-44, 64],  depth: 10, type: 'launch' },  // 2026-10-08 前方を+12px（44→56）。体が高く上がる分、判定は下へ広げて地上の敵に当てる
    sweep:        { dmg: 2, reach: [6, 42],  band: [0, 14],  depth: 8, type: 'down', low: true },
    jump_kick:    { dmg: 3, reach: [6, 48],  band: [-10, 36], depth: 9, type: 'launch' },
    tackle:       { dmg: 3, reach: [2, 30],  band: [6, 40],  depth: 9, type: 'launch' },
    slide:        { dmg: 2, reach: [2, 40],  band: [0, 16],  depth: 8, type: 'down', low: true },
    grab_knee:    { dmg: 2, reach: [0, 30],  band: [10, 40], depth: 10, type: 'grab' },
    grab_upper:   { dmg: 8, type: 'launch', finisher: true, smash: true },
    throw:        { dmg: 4, type: 'launch' },
    thrown_body:  { dmg: 3, type: 'launch' },   // 投げた敵が巻き込む威力
  },
  // 投げの基準 D0（変更前のゴブリンの投げ: 横150px/秒・上110px/秒 → 約53px）。この値は固定で、二重に倍率を掛けない
  throwD0: { vx: 150, vz: 110 },
  throwBounce: { vz: 130, shake: 2, shakePerWeight: 0.2 },   // [仮] 投げで叩きつけた時のバウンドと揺れ（重量10→2px、20→4px）
  launch: { vx: 150, vz: 170, smashVx: 190, smashVz: 210 },  // [仮] 吹っ飛びの勢い（v0.2の110/140から。画面を広く使う）

  // ------------------------------------------------------------ ロボ
  robot: {
    maxHp: 60,                  // [仮]（未定）
    speed: 115,                 // [仮] キャタピラー移動（v0.2の80から。戦闘中に広く動き回るため）
    fireDistance: 92,           // [仮] 戦闘中、狙った敵からこの距離の同じ軸に回り込んで撃つ
    dodgeRange: 34,             // [仮] この距離で敵が向かってきたら軸を外して離れる
    retargetMs: 2200,           // [仮] 同じ敵を追い続ける時間
    followOffsetX: -44,         // [仮] ミカの後ろに付く位置
    followOffsetY: 6,
    smgRange: 170,              // [仮] 射程（未定）
    smgDepth: 10,
    smgCooldownMs: 1500,        // [仮] 射撃間隔（未定。v0.2の1900から）
    smgBullets: 4,              // [仮] 1回の連射数
    smgDamage: 1,               // [仮] 弾1発の威力
    bulletSpeed: 330,
    missileCooldownMs: 9000,    // [仮] ときどきミサイル
    missileDamage: 4,
    rescueMs: 5000,             // [確定案] 約5秒で救命
    rescueHpRatio: 0.5,         // [仮] 復帰時のHP（未定）
    rescueInvulnerable: true,   // [仮] 救命中のロボは無敵（中断ルール未定）
    repairMs: 20000,            // 2026-10-08 壊れてから20カウントで自動修理（頭上に残り秒と緑のバー）
    repairKills: 8,             // 旧: 撃破数で修理（使わない）             // [仮] 修復に必要な撃破数（未定）
    reviveHpRatio: 0.5,         // [仮]
  },

  // ------------------------------------------------------------ 敵
  // 面ごとの倍率（balance_proposal.json の初期案）。雑魚HPは 切り上げ(基本HP×倍率) を一度だけ。ボスには掛けない
  stageHp: { 1: 1.0, 2: 1.1, 3: 1.2, 4: 1.35, 5: 1.5 },          // [仮] 提案値
  stageCooldown: { 1: 1.0, 2: 0.95, 3: 0.9, 4: 0.85, 5: 0.8 },   // [仮] AIの攻撃待ちだけに掛ける（予備動作・弾速・アニメは変えない）
  enemyCommon: {
    hpScale: 1.0,               // [仮] 全体の追加倍率（通常は1.0のまま。面の倍率は stageHp）
    rangedGapMs: 900,
    holdGiveUpMs: 2500,         // 2026-10-10 持ち場の弓兵が撃てないまま待つ最長時間（過ぎたら持ち場を離れて普通に動く）           // [仮] 遠距離の敵が続けて撃ち始めるまでの間（同時射撃をずらす）
    spawnIntervalMs: 700,       // [仮] 通常波の補充間隔
    maxAttackers: 2,            // [仮] 同時に殴りかかる敵の数
    downedMs: 900,              // [仮] 倒れている時間
    getupMs: 300,               // [仮] 起き上がり（ゴブリンは専用コマなし→待機で代用）
    hurtMs: 300,                // [仮]
    aggroDelayMs: [400, 1200],  // [仮] 攻撃前の間合い待ち
  },
  // 敵HPの上書き（monster_catalog.csv の基本HPは書き換えず、ここで上書き）。2026-10-07 攻撃速度アップに合わせて調整
  //   goblin 10→14 / hobgoblin 14→18 / death_goblin 18→22 / dark_goblin 20→24 / skeleton 14→18。他は基本HPのまま
  enemyHp: { goblin: 14, hobgoblin: 18, death_goblin: 22, dark_goblin: 24, skeleton: 18 },   // [仮]
  enemies: {
    goblin:     { speed: 46, speedY: 26, reach: 26, attackDepth: 5, attackMove: 'punch', attackDmg: 5 /*[確定]攻撃5*/ },
    // スケルトン: 2026-10-08 盾は確率ではなく動き。歩きながら時々立ち止まって構え、その間の正面攻撃（足払い以外）を防ぐ
    skeleton:   { speed: 32, speedY: 22, reach: 38, attackDepth: 5, attackDmg: 6,
                  guardCheckMs: 400, guardFar: 0.30, guardMid: 0.12, guardNear: 0.03, guardMs: [700, 1300] },  // [仮] 離れている(100px超)/中間/接近 での構えやすさ
    deathhound: { speed: 120, speedY: 40, reach: 90, attackDepth: 6, attackDmg: 8, groundedLowOnly: true },
    // 2026-10-07 追加（1〜3面）。攻撃力は敵一覧の基本値（monster_catalog.csv）を使う
    ogre:        { speed: 32, speedY: 20, reach: 44, attackDepth: 6, guardChance: 0.10 },   // [確定] ガード10%・ガード中は被ダメージ1
    gigas:       { speed: 26, speedY: 16, reach: 58, attackDepth: 8, chargeWarnMs: 520, chargeSpeed: 250, chargeDist: 230, chargeRecoverMs: 900 },  // [仮] 体当たりの予兆・速さ
    mega_goblin: { speed: 44, speedY: 24, reach: 32, attackDepth: 5 },
    megamega:    { speed: 34, speedY: 20, reach: 52, attackDepth: 7 },
    // 2026-10-09 ツギラ（HP・威力・点数以外は仮）。速く寄って、時々止まる。遠い同じ軸で口レーザー（同じ相手に1回だけ当たる）
    ashiin:      { speed: 174, speedY: 90, reach: 34, attackDepth: 6,   // 2026-10-11 ユーザー指定: ものすごく速く（58/30 の3倍）
                   dodge: { dist: 72, depth: 16, chance: 0.65, speed: 330, ms: 280, coolMs: 600, evadeHit: 0.5 },   // evadeHit: 当たる瞬間にかわす確率   // [仮] ミカが近くで攻撃すると素早く横へ逃げる（当たりにくく）
                   dart: { everyMs: [700, 1400], ms: 260, speed: 260 } },   // [仮] 時々左右・奥手前へ飛び回る
    // 2026-10-11 カオーン（数値は[仮]）: 普段はほぼ止まっている。予兆400ms→秒速560pxで約300px突進→ブレーキ
    kaon:        { speed: 30, speedY: 34, reach: 24, attackDepth: 8, keepDist: [70, 210], alignY: 8, minDist: 60, maxDist: 300,
                   warnMs: 400, chargeSpeed: 560, chargeDist: 300, brakeMs: 420, hitDepth: 10, coolMs: [1400, 2600] },
    tsugira:     { speed: 336, speedY: 138,   // 2026-10-11 ユーザー指定: 移動速度3倍（112/46→336/138）
                   reach: 44, attackDepth: 6, pauseChancePerSec: 0.35, pauseMs: [400, 900],
                   laserMinDist: 90, laserMaxDist: 300, laserChancePerSec: 0.6, laserWarnMs: 600, laserFireMs: 450, laserSpeed: 900, laserMaxLen: 330,
                   laserCoolMs: [1800, 2800], mouth: [21, 9], mouthDraw: [24, 14] },   // mouthDraw: 2026-10-11 v043の口レーザー本体の口（足元から前24・上14）
  },
  weaponTuning: {
  },
  // 2026-10-11 簡易チュートリアル（js/tutorial.js）。画面下にタイプライターで操作説明。タイトルから始めるごとに各1回
  tutorial: { enabled: true, delayMs: 250, holdMs: 3200, fadeMs: 500, y: 200, lineH: 19 },
  // 武器の補給（2026-10-08 ユーザー指定: 武器をガンガン使う爽快なゲームに）
  // 2026-10-12 v119 ユーザー指定: 武器の威力の上乗せ（js/weapons.js M.weaponDmg）
  weaponBonus: {
    flamethrower: { always: 3 },             // 火炎放射器: 常に+3（1→4。0.1秒ごと）
    katana:       { fromStage: 4, add: 1 },  // 刀: 4面から+1（2→3）
    machinegun:   { fromStage: 4, add: 1 },  // マシンガン: 4面から+1（1→2）
  },
  // 2026-10-12 v119 ユーザー指定: 難易度がぬるいので、雑魚の攻撃（ミカが受けるダメージ）を面ごとに上乗せ。中ボス・ボスとロボへのダメージは変えない
  zakoDmgBonusByStage: { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5 },
  weaponSupply: {
    // 2026-10-10 ユーザー指定: 武器を持った敵は倒すと必ず武器を落とす（奪える）。武器を減らすのは「武器を持って出てくる敵の数」で
    armedRateByStage: { 1: 1, 2: 0.5, 3: 0.5, 4: 0.4, 5: 0.4 },   // 配置表で武器持ちの雑魚が、本当に武器を持って出てくる割合（武器源は必ず）。1面は配置表で直接減らした
    // 2026-10-12 v110 ユーザー指定: 2面（基地）は武器が少なくて飽きるので、マシンガンとバズーカを少し足す。
    //   武器持ちのいない戦闘区間（エレベーターの停車中も）で、確率 chance でゴブリン系の雑魚1体に pool の武器を持たせる（倒すと必ず落とす）
    extraArmed: { 2: { chance: 0.55, pool: ['machinegun', 'machinegun', 'rocket_launcher'], kinds: ['combat', 'elevator_stop'] } },
    travelArmed: false,         // 2026-10-10 OFF（移動区間に武器を落とす雑魚を必ず1体、をやめる）
    unarmedAssist: false,       // 2026-10-10 OFF（素手の時に武器持ちの雑魚を出す救済をやめる）
    megaStages: [2, 4, 5],      // この面の補給役はメガゴブリン（それ以外はゴブリン系）
    pools: {                    // 面ごとに補給される武器（波動砲は隠し報酬なので入れない）
      1: ['machinegun', 'katana', 'rocket_launcher', 'yoichi_bow'],
      2: ['machinegun', 'katana', 'rocket_launcher', 'war_axe', 'flamethrower'],
      3: ['katana', 'flamethrower', 'gungnir', 'battle_hammer', 'rocket_launcher', 'yoichi_bow', 'machinegun'],
      4: ['machinegun', 'katana', 'rocket_launcher', 'war_axe', 'flamethrower', 'battle_hammer'],
      5: ['machinegun', 'katana', 'rocket_launcher', 'war_axe', 'flamethrower', 'battle_hammer', 'gungnir', 'yoichi_bow'],
    },
  },
  // ボス（HPは placement の boss.hp。撃破点は未設定のため仮）
  bossTuning: {
    hpByStage: { 1: 55, 2: 65, 3: 75, 4: 230 },   // 2026-10-12 v107 4面ダンダルモンを10%減（256→230）   // 2026-10-11 4面ダンダルモンを倍（128→256。その前に85→128）   // 2026-10-08 ボスHP（面が進むほど増える。3A終端のメカ2体は1面の半分ずつ）
    maxAdds: 2,                 // 2026-10-08 ボス戦の取り巻きは同時2体まで（ユーザー指定）
    introMikaX: 64,             // 2026-10-09 ユーザー指定: ボス登場演出の前にミカが歩いて行く位置（画面左端から）
    mechWalk: 40,
    mechHurtW: 112,             // 2026-10-09 ユーザー指定: 1面ボスの食らい判定の幅（腕まで。体の幅は64のまま）
    mechHurtMs: 260,            // [仮] 2026-10-08 1面ボスのひるみ時間
    mechWakeInvulnMs: 900,      // [仮] 起き上がりジャンプの着地後も少し無敵（点滅）
    darkSpeed: 1.4,             // [仮] 2面ボスの速さ（跳ぶ速さと攻撃間隔）
    darkWakeInvulnMs: 1500,     // [仮] 吹っ飛び→起き上がり後の無敵（大ジャンプで離れる）               // [仮] ゴブリンメカの歩き
    darkLandOpeningMs: 300,     // [仮] ダークミカの着地後の隙
    mechScore: 10000, darkScore: 20000, queenScore: 30000, miniScore: 5000,   // [仮] ボスの撃破点（未指定）
  },

  // 2026-10-11 6面の脱出（6B〜6Fで共通の制限時間）。ギリギリにしたい時は tickMs を小さく（例 700 = 実際の0.7秒で1減る）
  escape: {
    timeInitial: 500,           // 2026-10-12 ユーザー指定: 元の600から100秒減らす（=500）。6Bに入った時のTIME
    // 2026-10-12 v120 ユーザー指定: 6面はビルが揺れて、あちこちで瓦礫が降る（演出だけ・当たり判定なし）
    quake: { everyMs: [2600, 5200], shakeMs: 550, shake: 2, burst: [12, 18], dropMs: [180, 480] },   // 強い揺れの間隔・長さ・強さ、その時に降る数、ふだん1つずつ降る間隔
    lastFloorElderSpeed: 0.5,
    lastFloorSlowAfter: 3,      // 2026-10-12 v124 ユーザー指定: 6Fで長老が3つ目の声（FGOBU_ESCAPE_LAST03）を言った瞬間から
    lastFloorSlowMul: 0.5,      //   歩きをさらに半分（25→12.5px/秒）
    darkMikaCoolMul: 2,         // 2026-10-12 v131 ユーザー指定: 6Fのダークミカは攻撃の頻度を半分（攻撃の間隔×2）
    darkMikaDmgMul: 0.5,        //   攻撃力を半分（刀・パンチ・マシンガン・ロケット。ミカにもロボにも）
    darkMikaHpAdd: 10,          //   体力を1体ごとに+10（65×1/3≒22 → 32）
    darkMikaTotal: 10,          // 2026-10-12 v123 ユーザー指定: 最後（6F）のダークミカは合計10体（同時は4体まで。倒すと次が現れる）   // 2026-10-12 ユーザー指定: 最後の1フロア（6F）は長老の歩きをさらに半分にして焦らせる
    tickMs: 1000,               // [仮] TIMEが1減る間隔（ms）。通常は1000
    voiceAt: [300, 120, 60, 30, 10],   // 残り時間の声（VOICE_TIME300 など）を鳴らす残り
    sirenSteps: [               // 残りがこの値以下になったら、サイレンを速く・画面を赤く（rate=再生の速さ、red=赤の濃さの上限）
      { at: 9999, rate: 1.00, red: 0.06 },
      { at: 300,  rate: 1.10, red: 0.08 },
      { at: 120,  rate: 1.22, red: 0.10 },
      { at: 60,   rate: 1.36, red: 0.12 },
      { at: 30,   rate: 1.52, red: 0.14 },
      { at: 10,   rate: 1.75, red: 0.16 },
    ],
    sirenGain: 0.55,            // [仮] サイレンの音量（効果音の音量に対して）
  },

  // TIME（2026-10-08 ユーザー指定で変更）: 区間ごとの99ではなく、マップ（1A・1B…）ごとの残り時間。
  //   基本は切れない長さにして、ステージクリア時に各マップの残り×500点（タイムアタックの点数）
  mapTime: {
    initial: 300,               // [仮] マップごとの初期TIME（秒）。2026-10-08 600→300
    tickMs: 1000,               // [仮] 1秒で1減る
    bonusPerSecond: 50,         // 2026-10-12 v107 ユーザー指定: 大きすぎたので 500→50（残り1につき50点）
    rescueRefill: 60,           // [仮] 時間切れでロボに救命された時に戻すTIME
  },
  entryMarker: { floorOffset: 14 },   // [仮] 青い△の底辺 = 歩ける床の奥端 + この値（入口の下・床の手前）
  // ------------------------------------------------------------ 進行
  stage: {
    minEnemiesByStage: { 2: 2, 3: 2, 4: 2, 5: 2 },   // 2026-10-10 ユーザー指定: 1区間の最低数・同時の最低数（1面はそのまま）
    enemyCountRate: 0.67,       // 2026-10-09 ユーザー指定: 区間ごとに出る雑魚の数（配置表の約2/3。固定配置の敵は別）
    travelSpawnEveryPx: 70,     // [仮] 移動区間で、何pxスクロールごとに1体出すか
    goBlinkMs: 300,
    cameraMaxSpeed: 240,        // [仮] スクロールの最高速度（px/秒）。急に画面が飛ばないように
    cameraLead: 160,            // [仮] 移動中、ミカがこのx（画面内）を越えたらスクロール
    clearSlowmo: 0.25,          // [仮] クリア時スローモーション倍率
    clearJingleMs: 3200,        // ジングルが読めなかった時だけ使う待ち時間（通常は BGM_STAGE_CLEAR の実際の長さ）
    clearTallyDelayMs: 1200,    // [仮] STAGE CLEAR を出してから TIME BONUS 集計を始めるまで
    clearTallyMs: 1000,         // [仮] TIME BONUS のカウントアップ時間（約1秒・1面演出v001）
    clearHoldMs: 400,           // [仮] ジングルが鳴り終わってからフェードまで
    bossSlowmoMs: 1200,         // [仮] ボス撃破スローの長さ（実時間。一度だけ）
    lastKillSlow: 0.3,          // [仮] 区間の最後の1体を倒した時のスロー倍率（ボスより短く軽く）
    lastKillSlowMs: 550,        // [仮] その長さ（実時間）
    lastKillShake: 3,           // [仮] その時の揺れ(px)
    groupSpawnGapMs: 300,       // [仮] 同じ群れの2体目以降が出てくる間隔
    dropZ: 150,                 // [仮] 2B降下中に上から降ってくる高さ
    fadeMs: 700,
    mapFadeOutMs: 2000,         // 2026-10-09 ユーザー指定: マップ移動の暗転とBGMフェードアウト（入った先の明転は fadeMs）
    bossClearDelayMs: 2000,     // 2026-10-09 ユーザー指定: ボスが倒れきってからクリアのポーズ・曲までの間
  },
  worldMap: {
    blinkMs: 350,               // [仮] world_map_regions.json の提案値（未定）
    dimAlpha: 0.55,             // [仮] 未クリア地域の暗さ（提案値）
    showMs: 12000,              // 2026-10-11 地図の曲が付いたので長めに（スタート／攻撃ですぐ進む）
    leaveFadeMs: 2000,          // 2026-10-11 ユーザー指定: ステージに入る時の暗転と曲のフェードアウト
  },
};
