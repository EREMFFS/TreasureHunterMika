// =====================================================================
//  音の設定
//  ・音量は BGM と効果音で別々（0.0〜1.0）。初期値はどちらも 50%
//  ・音源ファイルは audio/ フォルダ。null の効果音は仮の合成音（placeholder）を鳴らす
//  ・効果音ごとに「同時に鳴らせる数」と「同じ音を重ねない間隔」を決めて、途切れすぎ・かぶりすぎを防ぐ
// =====================================================================
window.MIKA = window.MIKA || {};
MIKA.AUDIO = {
  bgmVolume: 0.5,               // BGM・ジングルの音量（初期値50%）
  seVolume: 0.5,                // 効果音の音量（初期値50%）
  placeholderSE: true,          // 効果音ファイルがない間は仮の合成音を鳴らす
  fadeOutMs: 700,               // [仮] ステージ曲のフェードアウト（ボス登場など）

  // BGM・ジングル（ステージはファイル名どおり）
  music: {
    game_start:  'audio/BGM_GAME_START.wav',   // 1面Aに最初に入った時だけ鳴らす開始合図（2026-10-07 差し替え 約4.18秒）
    stage_clear: 'audio/BGM_STAGE_CLEAR.wav',  // ステージクリア（約7.93秒。再生位置5.000秒で文字がキラーン）
    boss:        'audio/BGM_BOSS.mp3',         // ボス戦（全ボス共通）
    stage1:      'audio/BGM_STAGE01_1.mp3',    // 1面 A・B・C
    stage2_ab:   'audio/BGM_STAGE02_AB.mp3',   // 2面 A・B
    stage2_c:    'audio/BGM_STAGE02_C.mp3',    // 2面 C
    stage3_ab:   'audio/BGM_STAGE03_AB.mp3',   // 3面 A・B
    stage3_c:    'audio/BGM_STAGE03_C.mp3',    // 3面 C
    stage4_ab:   'audio/BGM_STAGE04_AB.mp3',   // 4面 A・B（2026-10-08 着。4A・4Bは未制作）
    stage4_c:    'audio/BGM_STAGE04_C.mp3',    // 4面 C デスポリス駅
    stage5_abchi: 'audio/BGM_STAGE05_ABCHI.mp3', // 5面 A・B・C・H・I（2026-10-10 着）
    stage5_defg:  'audio/BGM_STAGE05_DEFG.mp3',  // 5面 D・E・F・G
    stage5_j:     'audio/BGM_STAGE05_J.mp3',     // 5面 J デスポリス宝物庫（未制作）
    stage6:       'audio/BGM_STAGE06.mp3',       // 2026-10-11 6面 脱出（BGM_STAGE06.wav を mp3 128kbps に変換）
    ending:       'audio/BGM_STAGE04_AB.mp3',    // 2026-10-11 エンディングは4A・4Bの曲（ユーザー指定）
    boss_doctor_s: 'audio/BGM_STAGE05_BOSS01.mp3', // 5I ウルトラマシーンS（ドクターS）戦。ラスボス（ファイナルゴブリン）は共通のボス曲
    title: 'audio/BGM_TITLE.mp3',                // 2026-10-12 v117 タイトル画面（約104秒・ループ）
    map: 'audio/BGM_WORLDMAP.mp3',               // 2026-10-11 ステージ間のワールドマップ（元は BGM_SWORLDMAP.wav、mp3 192kbps に変換）                    // タイトル・ワールドマップは未指定（無音）
  },
  // ステージとマップごとの曲（隠し部屋は親マップの曲を続ける）
  stageMusic: {
    1: { A: 'stage1', B: 'stage1', C: 'stage1' },
    2: { A: 'stage2_ab', B: 'stage2_ab', C: 'stage2_c' },
    3: { A: 'stage3_ab', B: 'stage3_ab', C: 'stage3_c' },
    4: { A: 'stage4_ab', B: 'stage4_ab', C: 'stage4_c' },
    5: { A: 'stage5_abchi', B: 'stage5_abchi', C: 'stage5_abchi', D: 'stage5_defg', E: 'stage5_defg', F: 'stage5_defg', G: 'stage5_defg', H: 'stage5_abchi', I: 'stage5_abchi', J: 'stage5_j' },
  },
  clearShineAtMs: 5000,         // [確定] クリア曲の再生位置5.000秒で STAGE CLEAR 文字に光
  clearShineMs: 450,            // [仮] 光が文字を通り抜ける時間

  // 効果音（ファイルを置いたらパスを書く）
  se: {
    boss_title_dan: 'audio/se_boss_name.wav',  // 2026-10-11 ボス名を1文字出すごと（SE_BOSS_NAME。ワンショット・同時1本）
    swing:      'audio/se_swing.wav',          // パンチ・キック・刀などの発動（空振りでも鳴る）
    hit:        'audio/se_hit_light.wav',      // 打撃・弱（パンチ・左右キック・膝）
    bullet_hit: 'audio/se_hit_bullet.wav',     // 2026-10-09 仮: マシンガン・ロボの弾の命中（se_hit_light を高く・低域を切って短くしたもの。差し替え待ち）
    hit_mid:    'audio/se_hit_mid.wav',        // 打撃・中（強パンチ・肘・回転蹴り・足払い・ジャンプ蹴り・タックル）
    hit_heavy:  'audio/se_hit_heavy.wav',      // 打撃・強（アッパー・SMASH・掴みアッパー）
    smash:      null,                          // SMASH は hit_heavy と同時なので鳴らさない（重ならないように）
    weapon_hit: 'audio/se_weapon_hit.wav',     // 手持ち武器の命中（刀・斧・ハンマー・槍）
    throw_land: 'audio/se_throw_land.wav',     // 投げた敵が地面に落ちた
    hurt:       'audio/se_hurt.wav',           // 被弾（ミカ。ロボは同じ音を少し高く小さく）
    jump:       'audio/se_jump.wav',           // ミカのジャンプ（2026-10-07 追加。添付の1つ目と判断）
    dash:       'audio/se_dash.wav',           // ミカのダッシュ（添付の2つ目と判断）
    // 2026-10-08 追加（ユーザー提供）
    gun:           'audio/se_gun.wav',            // サブマシンガン単発（ミカ・敵・ロボ・ボスのSMG）
    missile:       'audio/se_missile.wav',        // バズーカ発射（ロケットランチャー・ロボのミサイル・ロケットパンチ）
    flame_loop:    'audio/se_flame_loop.wav',     // 火炎放射の放射中（撃っている間ループ）
    enemy_down:    'audio/se_enemy_down.wav',     // 地面に倒れる音（敵・ボスの転倒）
    pickup:        'audio/se_pickup.wav',         // 武器を拾う
    heal:          'audio/se_heal.wav',           // 回復アイテム
    elevator_stop: 'audio/se_elevator_stop.wav',  // 重い着地の音（1面ボスの着地・ダンダルモン・4Bの着地）。2026-10-11 からエレベーターの停止には使わない
    // 2026-10-11 エレベーターの音（2B・5面で共通）
    elev_stop:     'audio/se_elev_stop.wav',       // エレベーターが止まった（ELEVAOR_STOP）
    elev_move:     'audio/se_elev_move_loop.wav',  // 上昇・下降中のループ（ELEVAORMOVE_LOOP）
    elev_door:     'audio/se_elevator_stop.wav',   // 扉の開閉（今までの停止音を流用。ユーザー指定）
    lightning:     'audio/se_lightning.wav',      // クイーンのサンダー
    fire:          'audio/se_queen_fire.wav',     // クイーンの炎の魔法
    train_stop:    'audio/se_train_stop.wav',     // 電車が駅に停止（4B到着の減速・4Cから始めた時）
    announce:      'audio/se_announce.wav',       // 4B到着のアナウンス（全編を聞かせてから降下）。2026-10-11 車掌の声に差し替え（-12.5LUFS・23.77秒）
    train_outside: 'audio/se_train_outside.wav',  // 電車の走行音・野外（4Aの屋根・4Bのバルコニーでループ）
    train_inside:  'audio/se_train_inside.wav',   // 電車の走行音・車内（4Bの車内・整備室でループ。到着の減速で遅く小さく→停止）
    train_descent: 'audio/se_train_descent.mp3',  // 電車の降下中（4B到着: アナウンスの後の降下で一度）
    // 2026-10-10 敵の断末魔（VOICE_DEATH_ENEMY）。音量は声の音量（voiceVolume）で鳴らす（seMix の bus: 'voice'）
    edeath_goblin:   'audio/voice/enemy/death_goblin.wav',     // ゴブリン系（ヘルメット・ホブ・デス・ダーク含む）: 倒れて点滅し始める時
    edeath_skeleton: 'audio/voice/enemy/death_skeleton.wav',
    edeath_dog:      'audio/voice/enemy/death_dog.wav',        // デスハウンド
    edeath_ogre:     'audio/voice/enemy/death_ogre.wav',       // オーガ系
    edeath_gigas:    'audio/voice/enemy/death_gigas.wav',      // ギガース系
    boss_death_boom: 'audio/voice/enemy/death_boss01.wav',     // ボス撃破の爆発に合わせて連打（同時1本。新しい爆発で前を切る）
    boss_death_last: 'audio/voice/enemy/death_boss02.wav',     // ボス撃破の最後の爆発（ステレオ・長い）
    boss_death_dandalmon: 'audio/voice/enemy/death_dandalmon.wav', // ダンダルモンの最後の絶叫（ステレオ。消える時に一緒に消える）
    elevator5_stop: 'audio/se_elevator5_stop.wav',  // 2026-10-10 5面の屋外ガラスエレベーターが止まった（今は仮の上昇＝暗転の後、着いた階で鳴らす）
    map_msg01:     'audio/se_map_message01.wav',    // 地名表示（ナンザスシティなど）のタイプライター音。1文字ずつ01と02を交互に
    map_msg02:     'audio/se_map_message02.wav',
    death_machine:  'audio/se_death_machine.wav',    // 2026-10-10 機械の雑魚（メガゴブリン・メガメガ・ツギラ）が爆発して倒れる
    machine_walk:   'audio/se_machine_walk.wav',     // 機械の雑魚の足音（歩きの1歩ごと）
    robo_goblin_step: 'audio/se_robo_goblin_step.wav', // ボス ロボゴブリン（ゴブリンメカ）の足音とジャンプの着地
    title_start:   'audio/se_title_start.wav',      // 2026-10-11 タイトルでスタートを押した時
    elev_tenboudai: 'audio/elev_tenboudai.wav',     // 2026-10-11 5H→展望台の高速エレベーター: 「展望台に参ります…」（v034 VOICE_TENBOUDAI）
    elev_topspeed:  'audio/elev_topspeed.wav',      // 「まもなく最高速度に達します」（VOICE_TOPSPEED）
    elev_shuiin:    'audio/elev_shuiin.wav',        // かごが飛び去る「シュイイイン」（仮。SE_ELEVATOR_SHUIIN_PROVISIONAL）
    // 2026-10-11 エレベーターガール（通常の外壁エレベーター: 扉が閉まったら「上に参ります」、止まって扉が開く時に階の案内）
    elev_ue:        'audio/elev_ue.wav',            // 「上に参ります」
    elev_13f:       'audio/elev_13f.wav',           // 13階
    elev_37f:       'audio/elev_37f.wav',           // 37階
    elev_99f:       'audio/elev_99f.wav',           // 99階
    // 2026-10-11 クイーンゴブリンの声（声の音量で鳴らす）
    // 2026-10-11 6面（脱出）と新しい敵の音
    siren:          'audio/se_siren_loop.wav',      // 自爆の警報（ループ。残り時間が減るほど速く再生）SE_SILEN
    jibaku:         'audio/voice/VOICE_JIBAKU_BUTTON.wav',   // 6A「自爆ボタンが押されました…」
    ending_mika:    'audio/voice/MIKA_ENDING.wav',     // 2026-10-11 エンディングのテラスのミカのセリフ（v060: テラス開始1秒）
    ending_mika2:   'audio/voice/MIKA_ENDING02.wav',   // 2026-10-12 v059/v060 爆発の後、汽車だけの画面で上昇しながら（15.38秒）
    last_announce:  'audio/voice/VO_LASTANAUNCE.wav',  // 2026-10-12 v060 最後のアナウンス（28.14秒・約18.2秒）
    train_horn:     'audio/se_train_horn.wav',      // 2026-10-12 v060 汽笛（アナウンスの後46.36秒・遠景の再登場139.36秒）
    // 2026-10-12 長老とミカの声（用途はファイル名のとおり）
    fg_jump_box:    'audio/voice/FGOBU_JUMP_TRESUREBOX.wav',   // 長老が宝箱から飛び出す瞬間（5J）
    fg_help1:       'audio/voice/FGOBU_HELP01.wav',            // 警報の後、長老がミカに助けを求める（6A）
    mika_help1:     'audio/voice/MIKA_HELP01.wav',             // ミカがそれに答える（断る）
    fg_help2:       'audio/voice/FGOBU_HELP02.wav',            // 長老がもう一度お願いする（しがみつく）
    mika_help2:     'audio/voice/MIKA_HELP02.wav',             // ミカが引き受ける（クイっと）
    fg_escape1:     'audio/voice/FGOBU_ESCAPE_LAST01.wav',     // 最後の6F、長老がのろのろ歩く間に順番に（進み具合で1本ずつ）
    fg_escape2:     'audio/voice/FGOBU_ESCAPE_LAST02.wav',
    fg_escape3:     'audio/voice/FGOBU_ESCAPE_LAST03.wav',
    fg_escape4:     'audio/voice/FGOBU_ESCAPE_LAST04.wav',
    time300:        'audio/voice/VOICE_TIME300.wav',   // 脱出の残り時間の声
    time120:        'audio/voice/VOICE_TIME120.wav',
    time60:         'audio/voice/VOICE_TIME60.wav',
    time30:         'audio/voice/VOICE_TIME30.wav',
    time10:         'audio/voice/VOICE_TIME10.wav',
    lockon:         'audio/se_lockon.wav',           // 2026-10-12 ウルトラマシーンSのレーザーのロック音（SE_LOCKON。攻略の合図なので大きく・BGMを下げて聞かせる）
    ufo_warp:       'audio/se_dr_s_ufo_warp.wav',    // 2026-10-12 ドクターSの円盤のワープ・ドクターSが逃げる時のワープ（SE_DR_S_UFO_WARP）
    laser:          'audio/se_laser_beam.wav',      // 汎用レーザー（ダンダルモンの口・ツギラ・ウルトラマシーンS）SE_LAZERBERAM
    eye_laser:      'audio/se_dandalmon_eye_laser_loop.wav',   // ダンダルモンの目ビーム（照射中ループ）
    ashiin_spin:    'audio/se_ashiin_spin.wav',     // アシーンの高速回転（1回転ごと）SE_ASSIN_KAITEN
    tsugira_spin:   'audio/se_tsugira_spin.wav',    // ツギラ（仮: 走っている間のループ）SE_TUGIRA_KAITEN
    edeath_ashiin:  'audio/voice/enemy/death_ashiin.wav',
    edeath_tsugira: 'audio/voice/enemy/death_tsugira.wav',
    queen_start:    'audio/voice/queen/queen_start.wav',     // 登場（立ち上がって笑う所）
    queen_laugh:    'audio/voice/queen/queen_mudawarai.wav', // 戦闘中の無駄笑い（仮の合成音の laugh の代わり）
    queen_fire:     'audio/voice/queen/queen_fire.wav',      // 炎の魔法の構え
    queen_thunder:  'audio/voice/queen/queen_thunder.wav',   // サンダーの構え
    bazooka_blast:  'audio/se_bazooka_blast.wav',  // 2026-10-12 v112 バズーカの弾の爆発（ミカ・敵とも）（SE_BUZUUKA）
    drs_appear:     'audio/se_drs_appear.wav',     // 2026-10-12 v108 ドクターS（ウルトラマシーンS）の出現（SE_DRS_SYTUGEN）
    timer:          'audio/se_timer.wav',          // 2026-10-12 v107 TIME が少ない時（30で1回、10以下は1秒ごと。脱出では鳴らさない）（SE_TIMER）
    // 2026-10-12 v106 宝箱・物を壊す音（材質ごと。js/stage.js BREAK_SE）
    chest_open:     'audio/se_chest_open.wav',     // 宝箱を開ける（SE_S_TRESUREBOX）
    break_wood:     'audio/se_break_wood.wav',     // 木の物（バリケード・ベンチ）（SE_S_WOOD_OBJECT）
    break_metal:    'audio/se_break_metal.wav',    // 小さめの金属（倒れた看板・棚・端末・点検口）（SE_S_METAL_OBJECT）
    break_metal2:   'audio/se_break_metal2.wav',   // 大きな金属（自動販売機）（SE_S_METAL_OBJECT02）
    break:          'audio/se_break_other.wav',    // その他（瓦礫・植木鉢・壺・石像・柱・荷物）（SE_S_OTHER_OBJECT）
    // 2026-10-12 v104 効果音
    treasure_open:  'audio/se_treasure_open.wav',      // 5J 秘宝の間で宝箱が開く（SE_TRESUREOPEN）
    mika_knuckle:   'audio/se_mika_fingerbreak.wav',   // 5J ミカが指をポキポキ鳴らす（SE_MIKA_FINGERBREAK）
    grab:           'audio/se_grab.wav',               // 掴む（SE_AC_TUKAMU）
    land:           'audio/se_land.wav',               // 着地（SE_AC_CHAKUCHI）
    throw:          'audio/se_throw.wav',              // 投げる（SE_AC_NAGERU）
    // 2026-10-12 v103 効果音
    hit_mg:         'audio/se_hit_machinegun.wav',     // マシンガンの弾の命中（単発。SE_HIT_MASINGUN）
    hit_arrow:      'audio/se_hit_arrow.wav',          // 弓矢の命中（SE_HIT_ARROW）
    fg_attack_hit:  'audio/se_finalgoblin_attack.wav', // ファイナルゴブリンの杖がミカ・ロボに当たった（SE_FINALGOBLIN_ATTACK）
    fg_laugh:       'audio/se_finalgoblin_ahaha.wav',  // ファイナルゴブリンの戦闘開始の笑い（SE_FINALGOBLIN_AHAHA）
    dand_laugh:     'audio/se_dandalmon_ahaha.wav',    // ダンダルモン撃破の大笑い（DANDARUMON_AHAHA）
    // 2026-10-12 v102 4B到着のミカの声
    mika_train1:    'audio/voice/MIKA_TRAIN_01.wav',   // 車掌のアナウンスが終わって4秒後
    mika_train2:    'audio/voice/MIKA_TRAIN_02.wav',   // 降下して窓から町が見える直前（町が見え始めるのは d=24 秒ごろ）
    // 2026-10-12 v101 効果音
    go:             'audio/se_go.wav',               // 区間クリア後の「GO→」（SE_GO）
    coin:           'audio/se_item_other.wav',       // 回復以外のアイテム（お金・宝）を拾う・宝物庫で喜ぶ（SE_ITEM_OTHER）
    glass:          'audio/se_glass_break.wav',      // 2Cの培養カプセルが割れる（SE_GLASS_BREAK）
    train_chakluti: 'audio/se_train_chakluti.wav',   // 4B到着: 列車が線路に触れた瞬間（SE_TRAIN_CHAKLUTI）
    train_halt:     'audio/se_train_stop_full.wav',  // 4B到着: 列車が完全に止まった時。鳴り終わってから暗転して4Cへ（SE_TRAIN_STOP）
    gameover:       'audio/se_gameover.wav',         // GAME OVER（SE_GAMEOVER）
    robo_repair:    'audio/se_robo_fukkatu.wav',     // ロボが自動修理で直った時（SE_ROBO_FUKKATU。ロボの声はこの後）
    pause:          'audio/se_pause.wav',            // ポーズの ON/OFF（SE_PAUSE_ONOFF。ポーズ中も鳴るように <audio> で別に鳴らす）
    secret_door:    'audio/se_secret_door_open.wav', // 部屋（隠し部屋）に入る・出る、叩くと開く壁（SE_SECRET_DOOR_OPEN）
    explosion: null, time_tick: null,
    laugh: null,   // 未着（仮の合成音）
    // 2026-10-11 ロボの声（ROBO_*）。声の音量で鳴らす。カテゴリごとにランダム（js/stage.js roboSay）
    robo_fukkatu_1:    'audio/voice/robo/ROBO_FUKKATU01.wav',
    robo_fukkatu_2:    'audio/voice/robo/ROBO_FUKKATU02.wav',
    robo_hp0_1:        'audio/voice/robo/ROBO_HP0_01.wav',
    robo_hp0_2:        'audio/voice/robo/ROBO_HP0_02.wav',
    robo_hp0_3:        'audio/voice/robo/ROBO_HP0_03.wav',
    robo_hp0_4:        'audio/voice/robo/ROBO_HP0_04.wav',
    robo_hp25_1:       'audio/voice/robo/ROBO_HP25_01.wav',
    robo_hp25_2:       'audio/voice/robo/ROBO_HP25_02.wav',
    robo_hp25_3:       'audio/voice/robo/ROBO_HP25_03.wav',
    robo_hp25_4:       'audio/voice/robo/ROBO_HP25_04.wav',
    robo_mikahp0_1:    'audio/voice/robo/ROBO_MIKA_HP0_01.wav',
    robo_mikahp0_2:    'audio/voice/robo/ROBO_MIKA_HP0_02.wav',
    robo_kaifuku_1:    'audio/voice/robo/ROBO_MIKA_KAIFUKU_START01.wav',
    robo_kaifuku_2:    'audio/voice/robo/ROBO_MIKA_KAIFUKU_START02.wav',
    robo_room_1:       'audio/voice/robo/ROBO_ROOM_ZAKO_ZENMETU01.wav',
    robo_room_2:       'audio/voice/robo/ROBO_ROOM_ZAKO_ZENMETU02.wav',
    robo_room_3:       'audio/voice/robo/ROBO_ROOM_ZAKO_ZENMETU03.wav',
    robo_room_4:       'audio/voice/robo/ROBO_ROOM_ZAKO_ZENMETU04.wav',
    robo_room_5:       'audio/voice/robo/ROBO_ROOM_ZAKO_ZENMETU05.wav',
  },
  // ------------------------------------------------------------ ミカの声（2026-10-10 MIKA_VOICE）。BGM・効果音とは別の音量（voiceVolume）
  //   files が複数なら毎回ランダム（直前と同じものは避ける）。声は1本ずつ: 鳴っている声より pri が高ければ止めて鳴らし、低ければ鳴らさない
  //   chance=鳴らす確率 / coolMs=同じ種類をこれより短い間隔で鳴らさない / gain=音量の補正
  voiceVolume: 0.5,
  roboVoice: {"fukkatu": ["robo_fukkatu_1", "robo_fukkatu_2"], "hp0": ["robo_hp0_1", "robo_hp0_2", "robo_hp0_3", "robo_hp0_4"], "hp25": ["robo_hp25_1", "robo_hp25_2", "robo_hp25_3", "robo_hp25_4"], "mikahp0": ["robo_mikahp0_1", "robo_mikahp0_2"], "kaifuku": ["robo_kaifuku_1", "robo_kaifuku_2"], "room": ["robo_room_1", "robo_room_2", "robo_room_3", "robo_room_4", "robo_room_5"]},   // ロボの声のカテゴリ → 効果音キー
  voice: {
    stage_start:   { files: ['audio/voice/MIKA_STAGE_START01.wav', 'audio/voice/MIKA_STAGE_START02.wav'], pri: 6, chance: 1, coolMs: 0 },          // 面の最初のマップに登場した時
    zone_start:    { files: ['audio/voice/MIKA_ZONE_START01.wav', 'audio/voice/MIKA_ZONE_START02.wav', 'audio/voice/MIKA_ZONE_START03.wav', 'audio/voice/MIKA_ZONE_START04.wav', 'audio/voice/MIKA_ZONE_START05.wav', 'audio/voice/MIKA_ZONE_START06.wav', 'audio/voice/MIKA_ZONE_START07.wav'], pri: 6, chance: 1, coolMs: 0 },   // 2026-10-11 面の2つ目以降のマップ（B・C…・エレベーターで着いた階・4B）に入った時。ランダム
    zone6_start:   { files: ['audio/voice/MIKA_ZONE_6_START01.wav', 'audio/voice/MIKA_ZONE_6_START02.wav', 'audio/voice/MIKA_ZONE_6_START03.wav', 'audio/voice/MIKA_ZONE_6_START04.wav'], pri: 6, chance: 1, coolMs: 0 },   // 2026-10-11 6面（脱出）の各マップに入った時。ランダム
    boss_encount:  { files: ['audio/voice/MIKA_BOSS_ENCOUNT01.wav', 'audio/voice/MIKA_BOSS_ENCOUNT02.wav', 'audio/voice/MIKA_BOSS_ENCOUNT03.wav'], pri: 7, chance: 1, coolMs: 0 },         // ボス登場演出の始め（ミカが左へ歩く間）
    stage_clear:   { files: ['audio/voice/MIKA_STAGE_CLEAR01.wav', 'audio/voice/MIKA_STAGE_CLEAR02.wav'], pri: 9, chance: 1, coolMs: 0 },          // クリアのポーズ
    death:         { files: ['audio/voice/MIKA_DEATH01.wav', 'audio/voice/MIKA_DEATH02.wav', 'audio/voice/MIKA_DEATH03.wav', 'audio/voice/MIKA_DEATH04.wav', 'audio/voice/MIKA_DEATH05.wav'], pri: 10, chance: 1, coolMs: 0 },               // HP0で倒れた
    yarare:        { files: ['audio/voice/MIKA_YARARE01.wav', 'audio/voice/MIKA_YARARE02.wav', 'audio/voice/MIKA_YARARE03.wav', 'audio/voice/MIKA_YARARE04.wav', 'audio/voice/MIKA_YARARE05.wav', 'audio/voice/MIKA_YARARE06.wav', 'audio/voice/MIKA_YARARE07.wav'], pri: 2, chance: 0.6, coolMs: 900 },           // 殴られた
    getup:         { files: ['audio/voice/MIKA_FUTTTOBI_OKIAGARI01.wav', 'audio/voice/MIKA_FUTTTOBI_OKIAGARI02.wav', 'audio/voice/MIKA_FUTTTOBI_OKIAGARI03.wav', 'audio/voice/MIKA_FUTTTOBI_OKIAGARI04.wav', 'audio/voice/MIKA_FUTTTOBI_OKIAGARI05.wav', 'audio/voice/MIKA_FUTTTOBI_OKIAGARI06.wav'], pri: 4, chance: 0.7, coolMs: 2500 }, // 吹っ飛ばされて起き上がる
    hp20:          { files: ['audio/voice/MIKA_HP20.wav'], pri: 8, chance: 1, coolMs: 0 },      // HPが20%を切った（20%以上に戻るまで一度だけ）
    robo_revive:   { files: ['audio/voice/MIKA_FUKKATSU_ROBO.wav'], pri: 8, chance: 1, coolMs: 0 }, // ロボに助けられて復活
    robo_down:     { files: ['audio/voice/MIKA_IROMBO_DEATH.wav', 'audio/voice/MIKA_IROMBO_DEATH02.wav', 'audio/voice/MIKA_IROMBO_DEATH03.wav', 'audio/voice/MIKA_IROMBO_DEATH04.wav', 'audio/voice/MIKA_IROMBO_DEATH05.wav', 'audio/voice/MIKA_IROMBO_DEATH06.wav', 'audio/voice/MIKA_IROMBO_DEATH07.wav', 'audio/voice/MIKA_IROMBO_DEATH08.wav', 'audio/voice/MIKA_IROMBO_DEATH09.wav', 'audio/voice/MIKA_IROMBO_DEATH10.wav'], pri: 7, chance: 1, coolMs: 0 },  // ロボが壊れた（2026-10-11 10種からランダム）
    item:          { files: ['audio/voice/MIKA_ITEM01.wav', 'audio/voice/MIKA_ITEM02.wav'], pri: 3, chance: 0.8, coolMs: 1500 },             // お金・宝を拾った
    potion:        { files: ['audio/voice/MIKA_POTION_KAIFUKU01.wav', 'audio/voice/MIKA_POTION_KAIFUKU02.wav', 'audio/voice/MIKA_POTION_KAIFUKU03.wav'], pri: 5, chance: 1, coolMs: 0 },       // 回復を拾った
    long_weapon:   { files: ['audio/voice/MIKA_GET_LONGWEPON.wav', 'audio/voice/MIKA_LONGWEPONE_GET02.wav', 'audio/voice/MIKA_LONGWEPONE_GET03.wav', 'audio/voice/MIKA_LONGWEPONE_GET04.wav'],   /* 2026-10-12 v119 バリエーション3本を追加（ランダム） */ pri: 5, chance: 1, coolMs: 0, weapons: ['machinegun', 'rocket_launcher', 'flamethrower', 'wave_cannon'] },  // 2026-10-10 ユーザー指定: 重火器（マシンガン・ロケラン・火炎放射器・波動砲）を拾った「ぶっぱなしてやんよ！」
    jump:          { files: ['audio/voice/MIKA_JUMP01.wav', 'audio/voice/MIKA_JUMP02.wav', 'audio/voice/MIKA_JUMP03.wav'], pri: 1, chance: 1, coolMs: 300 },  // 2026-10-10 ジャンプした時（一番低い優先度: 他の声は止めない）
    todome:        { files: ['audio/voice/MIKA_ATTACK_ZAKO_TODOME01.wav', 'audio/voice/MIKA_ATTACK_ZAKO_TODOME02.wav', 'audio/voice/MIKA_ATTACK_ZAKO_TODOME03.wav', 'audio/voice/MIKA_ATTACK_ZAKO_TODOME04.wav', 'audio/voice/MIKA_ATTACK_ZAKO_TODOME05.wav'], pri: 3, chance: 1, coolMs: 1000 }, // 雑魚にとどめ（2026-10-10 ユーザー指定: 少しでも間があけば必ず言う。前の声が鳴っている間と1秒以内は言わない）
    smash:         { files: ['audio/voice/MIKA_ATTACK_SMASH01.wav', 'audio/voice/MIKA_ATTACK_SMASH02.wav', 'audio/voice/MIKA_ATTACK_SMASH03.wav', 'audio/voice/MIKA_ATTACK_SMASH04.wav', 'audio/voice/MIKA_ATTACK_SMASH05.wav', 'audio/voice/MIKA_ATTACK_SMASH06.wav', 'audio/voice/MIKA_ATTACK_SMASH06B.wav', 'audio/voice/MIKA_ATTACK_SMASH07.wav', 'audio/voice/MIKA_ATTACK_SMASH08.wav', 'audio/voice/MIKA_ATTACK_SMASH09.wav', 'audio/voice/MIKA_ATTACK_SMASH10.wav', 'audio/voice/MIKA_ATTACK_SMASH11.wav'], pri: 5, chance: 0.8, coolMs: 3000 },  // SMASH（アッパーの締め・掴みアッパー）。2026-10-10 6種に増えたので頻度も上げた
  },
  // 鳴らし方: gain=音量の補正 / voices=同時に鳴らせる数（超えたら一番古い音を短く消す）/ gapMs=同じ音をこれより短い間隔で重ねない
  seMix: {
    swing:      { gain: 0.80, voices: 2, gapMs: 45 },
    hit:        { gain: 0.95, voices: 2, gapMs: 40 },
    bullet_hit: { gain: 0.55, voices: 2, gapMs: 60 },    // 連射で何度も鳴るので軽く小さく
    hit_mid:    { gain: 0.95, voices: 2, gapMs: 45 },
    hit_heavy:  { gain: 0.90, voices: 1, gapMs: 120 },
    weapon_hit: { gain: 0.85, voices: 2, gapMs: 60 },
    throw_land: { gain: 0.90, voices: 1, gapMs: 120 },
    hurt:       { gain: 0.95, voices: 1, gapMs: 90 },
    jump:       { gain: 0.85, voices: 1, gapMs: 120 },
    dash:       { gain: 0.80, voices: 1, gapMs: 200 },
    // 2026-10-08 追加分の音量（素材の大きさを測って既存の打撃音にそろえた初期値）
    gun:           { gain: 0.55, voices: 3, gapMs: 50 },    // 連射で何度も鳴るので控えめ
    missile:       { gain: 0.60, voices: 2, gapMs: 90 },
    flame_loop:    { gain: 0.60, voices: 3, gapMs: 0 },
    enemy_down:    { gain: 0.50, voices: 2, gapMs: 90 },    // 素材が大きめ（ピーク0dB）
    pickup:        { gain: 0.90, voices: 1, gapMs: 150 },
    heal:          { gain: 0.75, voices: 1, gapMs: 300 },
    elevator_stop: { gain: 0.80, voices: 1, gapMs: 300 },
    robo_fukkatu_1:    { gain: 2.11, voices: 1, gapMs: 0, bus: 'voice' },   // -20.5 LUFS → 約-14（2026-10-11 +3dB ユーザー指定）
    robo_fukkatu_2:    { gain: 2.57, voices: 1, gapMs: 0, bus: 'voice' },   // -22.2 LUFS → 約-14（2026-10-11 +3dB ユーザー指定）
    robo_hp0_1:        { gain: 1.44, voices: 1, gapMs: 0, bus: 'voice' },   // -17.2 LUFS → 約-14（2026-10-11 +3dB ユーザー指定）
    robo_hp0_2:        { gain: 2.11, voices: 1, gapMs: 0, bus: 'voice' },   // -20.5 LUFS → 約-14（2026-10-11 +3dB ユーザー指定）
    robo_hp0_3:        { gain: 1.58, voices: 1, gapMs: 0, bus: 'voice' },   // -18.0 LUFS → 約-14（2026-10-11 +3dB ユーザー指定）
    robo_hp0_4:        { gain: 1.62, voices: 1, gapMs: 0, bus: 'voice' },   // -18.2 LUFS → 約-14（2026-10-11 +3dB ユーザー指定）
    robo_hp25_1:       { gain: 1.37, voices: 1, gapMs: 0, bus: 'voice' },   // -16.7 LUFS → 約-14（2026-10-11 +3dB ユーザー指定）
    robo_hp25_2:       { gain: 1.79, voices: 1, gapMs: 0, bus: 'voice' },   // -19.1 LUFS → 約-14（2026-10-11 +3dB ユーザー指定）
    robo_hp25_3:       { gain: 1.41, voices: 1, gapMs: 0, bus: 'voice' },   // -17.0 LUFS → 約-14（2026-10-11 +3dB ユーザー指定）
    robo_hp25_4:       { gain: 2.04, voices: 1, gapMs: 0, bus: 'voice' },   // -20.2 LUFS → 約-14（2026-10-11 +3dB ユーザー指定）
    robo_mikahp0_1:    { gain: 1.95, voices: 1, gapMs: 0, bus: 'voice' },   // -19.8 LUFS → 約-14（2026-10-11 +3dB ユーザー指定）
    robo_mikahp0_2:    { gain: 1.78, voices: 1, gapMs: 0, bus: 'voice' },   // -19.0 LUFS → 約-14（2026-10-11 +3dB ユーザー指定）
    robo_kaifuku_1:    { gain: 2.45, voices: 1, gapMs: 0, bus: 'voice' },   // -21.8 LUFS → 約-14（2026-10-11 +3dB ユーザー指定）
    robo_kaifuku_2:    { gain: 1.78, voices: 1, gapMs: 0, bus: 'voice' },   // -19.0 LUFS → 約-14（2026-10-11 +3dB ユーザー指定）
    robo_room_1:       { gain: 2.26, voices: 1, gapMs: 0, bus: 'voice' },   // -21.1 LUFS → 約-14（2026-10-11 +3dB ユーザー指定）
    robo_room_2:       { gain: 2.09, voices: 1, gapMs: 0, bus: 'voice' },   // -20.4 LUFS → 約-14（2026-10-11 +3dB ユーザー指定）
    robo_room_3:       { gain: 1.38, voices: 1, gapMs: 0, bus: 'voice' },   // -16.8 LUFS → 約-14（2026-10-11 +3dB ユーザー指定）
    robo_room_4:       { gain: 1.86, voices: 1, gapMs: 0, bus: 'voice' },   // -19.4 LUFS → 約-14（2026-10-11 +3dB ユーザー指定）
    robo_room_5:       { gain: 2.16, voices: 1, gapMs: 0, bus: 'voice' },   // -20.7 LUFS → 約-14（2026-10-11 +3dB ユーザー指定）
    elev_stop:     { gain: 0.90, voices: 1, gapMs: 500 },   // -16.6LUFS
    elev_move:     { gain: 0.60, voices: 1, gapMs: 0 },     // -16.6LUFS → ×0.6で約-21（BGMの下で鳴り続ける）
    elev_door:     { gain: 0.60, voices: 1, gapMs: 300 },
    lightning:     { gain: 0.45, voices: 1, gapMs: 500 },   // 素材がかなり大きい（約-10LUFS・4.8秒）
    fire:          { gain: 0.65, voices: 1, gapMs: 200 },
    train_stop:    { gain: 0.70, voices: 1, gapMs: 500 },
    announce:      { gain: 1.00, voices: 1, gapMs: 1000 },   // 2026-10-11 +3dB（0.70→1.00）ユーザー指定  // 2026-10-11 新素材 -12.2LUFS（旧 -15.9）。×0.7で約-15LUFS相当＝通常のBGMと同じ大きさ。鳴っている間BGMは-12dBなので約12dB上で聞こえる
    train_outside: { gain: 0.50, voices: 2, gapMs: 0 },     // 2026-10-11 ユーザー差し替え（素材 -13.2LUFS、旧 -20.3）→ ×0.5で約-19LUFS相当（BGMの約4dB下）
    train_inside:  { gain: 0.70, voices: 2, gapMs: 0 },     // 2026-10-11 ユーザー差し替え（素材 -13.5LUFS、旧 -23.1）→ ×0.7で約-16.6LUFS相当（BGMとほぼ同じ）
    train_descent: { gain: 0.60, voices: 1, gapMs: 1000 },
    edeath_goblin:   { gain: 0.80, voices: 2, gapMs: 120, bus: 'voice' },
    edeath_ashiin:   { gain: 0.80, voices: 2, gapMs: 120, bus: 'voice' },
    edeath_tsugira:  { gain: 0.80, voices: 2, gapMs: 120, bus: 'voice' },
    siren:           { gain: 1.00, voices: 1, gapMs: 0 },     // 音量は tuning.js escape.sirenGain
    jibaku:          { gain: 1.00, voices: 1, gapMs: 500, bus: 'voice' },
    time300:         { gain: 1.00, voices: 1, gapMs: 500, bus: 'voice' },
    ending_mika:     { gain: 1.00, voices: 1, gapMs: 500, bus: 'voice' },
    ending_mika2:    { gain: 0.87, voices: 1, gapMs: 500, bus: 'voice' },   // 2026-10-12 ミカ2本とアナウンスの大きさを揃えた（実測 -17.7/-16.5/-16.0dB）
    last_announce:   { gain: 0.82, voices: 1, gapMs: 500, bus: 'voice' },
    train_horn:      { gain: 0.50, voices: 2, gapMs: 300 },                 // 汽笛は大きすぎないように（実測 -11.5dB）。遠景はさらに半分
    bazooka_blast:   { gain: 0.60, voices: 3, gapMs: 60 },    // -13.2dB・ピーク1.0（大きいので下げた）
    drs_appear:      { gain: 1.50, voices: 1, gapMs: 1000 },  // -24.9dB・ピーク0.44
    timer:           { gain: 1.40, voices: 2, gapMs: 300 },   // -24.6dB・ピーク0.39
    chest_open:      { gain: 1.80, voices: 2, gapMs: 100 },   // -30.6dB・ピーク0.44（小さいので上げた）
    break_wood:      { gain: 1.00, voices: 2, gapMs: 100 },   // -22.9dB
    break_metal:     { gain: 0.65, voices: 2, gapMs: 100 },   // -14.7dB
    break_metal2:    { gain: 0.75, voices: 2, gapMs: 100 },   // -16.9dB
    break:           { gain: 0.85, voices: 2, gapMs: 100 },   // -19.1dB
    treasure_open:   { gain: 0.90, voices: 1, gapMs: 1000 },  // -18.9dB
    mika_knuckle:    { gain: 1.00, voices: 1, gapMs: 500 },   // -20.3dB
    grab:            { gain: 1.00, voices: 2, gapMs: 80 },    // -22.4dB
    land:            { gain: 1.20, voices: 2, gapMs: 80 },    // -25.1dB（小さめ・ピーク0.52）
    throw:           { gain: 0.90, voices: 2, gapMs: 80 },    // -21.0dB
    hit_mg:          { gain: 1.00, voices: 3, gapMs: 50 },    // -23.4dB。連射で何度も鳴る
    hit_arrow:       { gain: 0.75, voices: 2, gapMs: 60 },    // -16.9dB。貫通で同時に当たっても2つまで
    fg_attack_hit:   { gain: 0.90, voices: 1, gapMs: 120 },
    fg_laugh:        { gain: 0.90, voices: 1, gapMs: 500 },
    dand_laugh:      { gain: 0.85, voices: 1, gapMs: 1000 },  // -14.3dB
    mika_train1:     { gain: 1.00, voices: 1, gapMs: 500, bus: 'voice' },   // -16.6dB
    mika_train2:     { gain: 1.00, voices: 1, gapMs: 500, bus: 'voice' },   // -16.0dB
    // 2026-10-12 v101 効果音（実測の大きさで揃えた）
    go:              { gain: 0.80, voices: 1, gapMs: 300 },
    coin:            { gain: 1.00, voices: 2, gapMs: 120 },
    glass:           { gain: 0.85, voices: 2, gapMs: 200 },
    train_chakluti:  { gain: 0.60, voices: 1, gapMs: 1000 },
    train_halt:      { gain: 0.90, voices: 1, gapMs: 1000 },
    gameover:        { gain: 0.90, voices: 1, gapMs: 1000 },
    robo_repair:     { gain: 1.00, voices: 1, gapMs: 500 },
    pause:           { gain: 0.90, voices: 1, gapMs: 0 },
    secret_door:     { gain: 1.00, voices: 1, gapMs: 200 },
    // 2026-10-12 声の大きさを揃えた（実測 rms と peak。割れない範囲で）
    fg_jump_box:     { gain: 1.00, voices: 1, gapMs: 500, bus: 'voice' },
    fg_help1:        { gain: 1.00, voices: 1, gapMs: 500, bus: 'voice' },
    mika_help1:      { gain: 1.00, voices: 1, gapMs: 500, bus: 'voice' },
    fg_help2:        { gain: 1.05, voices: 1, gapMs: 500, bus: 'voice' },
    mika_help2:      { gain: 1.00, voices: 1, gapMs: 500, bus: 'voice' },
    fg_escape1:      { gain: 1.30, voices: 1, gapMs: 500, bus: 'voice' },
    fg_escape2:      { gain: 1.20, voices: 1, gapMs: 500, bus: 'voice' },
    fg_escape3:      { gain: 1.15, voices: 1, gapMs: 500, bus: 'voice' },
    fg_escape4:      { gain: 1.00, voices: 1, gapMs: 500, bus: 'voice' },
    time120:         { gain: 1.00, voices: 1, gapMs: 500, bus: 'voice' },
    time60:          { gain: 1.00, voices: 1, gapMs: 500, bus: 'voice' },
    time30:          { gain: 1.00, voices: 1, gapMs: 500, bus: 'voice' },
    time10:          { gain: 1.00, voices: 1, gapMs: 500, bus: 'voice' },
    laser:           { gain: 0.75, voices: 3, gapMs: 60 },
    lockon:          { gain: 1.6, voices: 1, gapMs: 0 },     // 2026-10-12 ユーザー指定で下げた（4.0→1.6、約-8dB）。単純な波形で目立つので、耳に痛くない程度
    ufo_warp:        { gain: 1.0, voices: 2, gapMs: 120 },
    eye_laser:       { gain: 0.55, voices: 1, gapMs: 0 },
    ashiin_spin:     { gain: 0.45, voices: 2, gapMs: 70 },
    tsugira_spin:    { gain: 0.20, voices: 2, gapMs: 0 },   // 2026-10-11 ユーザー指定: 大きいので下げた（0.40→0.20 約-6dB）
    edeath_skeleton: { gain: 1.30, voices: 2, gapMs: 120, bus: 'voice' },   // 素材が小さめ
    edeath_dog:      { gain: 1.60, voices: 2, gapMs: 120, bus: 'voice' },   // 素材が小さめ（ピーク-10dB）
    edeath_ogre:     { gain: 1.00, voices: 2, gapMs: 120, bus: 'voice' },
    edeath_gigas:    { gain: 1.20, voices: 1, gapMs: 120, bus: 'voice' },
    boss_death_boom: { gain: 0.80, voices: 1, gapMs: 0, bus: 'voice' },     // 最大同時発音数1で連打（ユーザー指定）
    boss_death_last: { gain: 0.75, voices: 1, gapMs: 500, bus: 'voice' },   // 素材が大きめ（約-13dB）
    boss_death_dandalmon: { gain: 1.00, voices: 1, gapMs: 500, bus: 'voice' },
    elevator5_stop: { gain: 1.60, voices: 1, gapMs: 500 },   // 素材が小さめ（ピーク-13dB）
    map_msg01:     { gain: 0.90, voices: 2, gapMs: 0 },
    map_msg02:     { gain: 1.40, voices: 2, gapMs: 0 },       // 01より約8dB小さいので少し上げてそろえた
    death_machine:  { gain: 0.55, voices: 2, gapMs: 80 },    // 素材が大きい（ピーク0dB・平均-10dB）
    machine_walk:   { gain: 0.55, voices: 2, gapMs: 110 },   // 何体も歩くので控えめ・重ねすぎない
    robo_goblin_step: { gain: 0.75, voices: 2, gapMs: 150 },
    boss_title_dan: { gain: 1.00, voices: 1, gapMs: 0 },
    elev_tenboudai: { gain: 0.80, voices: 1, gapMs: 1000 },   // 約-13LUFS（4Bのアナウンス -12.2 ×0.7 とそろえる）。鳴っている間BGMは-12dB
    elev_topspeed:  { gain: 0.80, voices: 1, gapMs: 1000 },
    elev_shuiin:    { gain: 0.90, voices: 1, gapMs: 1000 },
    elev_ue:        { gain: 0.80, voices: 1, gapMs: 1000 },   // 約-12LUFS（展望台の案内とそろえる）
    elev_13f:       { gain: 0.95, voices: 1, gapMs: 1000 },   // 素材が少し小さい（-14.8LUFS）
    elev_37f:       { gain: 0.80, voices: 1, gapMs: 1000 },
    elev_99f:       { gain: 0.80, voices: 1, gapMs: 1000 },
    queen_start:    { gain: 0.85, voices: 1, gapMs: 500, bus: 'voice' },   // -13.4LUFS
    queen_laugh:    { gain: 0.95, voices: 1, gapMs: 500, bus: 'voice' },   // -14.6LUFS
    queen_fire:     { gain: 1.20, voices: 1, gapMs: 500, bus: 'voice' },   // -17.3LUFS
    queen_thunder:  { gain: 1.60, voices: 1, gapMs: 500, bus: 'voice' },   // -20.4LUFS（小さめなので上げた）   // 約-16LUFS   // 最大同時発音数1（次の文字で前の音を切る）
    default:    { gain: 1.00, voices: 3, gapMs: 30 },
  },
  // ロボの音: 同じ音を少し高く・少し小さく。ミカの同じ音と同時なら鳴らさない（同じ波形の重なり＝フランジングを避ける）
  robotSE: { rate: 1.12, gain: 0.62, avoidSameMs: 70, voices: 1 },
};
