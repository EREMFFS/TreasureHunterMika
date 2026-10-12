// debug.js — ★テスト用のデバッグ機能（公開前に必ず消す: このファイルと index.html / artifact.html の <script src="js/debug.js"> を削除）
'use strict';
// 2026-10-12 v114: W を4回で無限マシンガン（DEBUG SMG）は削除（W はタイトルの CONFIG キーと重なるため）。ステージセレクトだけ残す

// ================================================================== ★デバッグ: ステージセレクト（公開前に消す）
//   タイトル画面で 左SHIFT＋S を3回（v125 隠しコマンド）→ 一覧。↑↓で選ぶ、Z / Enter で開始、X / Esc でタイトルへ
(function () {
const M = window.MIKA, I = M.Input, ctx = M.ctx;
const NAME = {};
for (const st of M.REF.mapNames.stages) for (const k in st.maps) NAME[st.stage_id + k] = st.maps[k];
const LIST = [
  ['1A', 1, '1A'], ['1B', 1, '1B'], ['1C', 1, '1C'], ['1 BOSS', 1, '1C', 'C5'],
  ['2A', 2, '2A'], ['2B', 2, '2B'], ['2C', 2, '2C'], ['2 BOSS', 2, '2C', 'C5'],
  ['3A', 3, '3F1'], ['3A END', 3, '3F3', 'F3_5'], ['3B', 3, '3B'], ['3C', 3, '3C'], ['3 BOSS', 3, '3C', 'C5'],
  ['4A', 4, '4A'], ['4B', 4, '4B'], ['4B END', 4, '4B', 'B5'], ['4C', 4, '4C'], ['4 BOSS', 4, '4C', 'C5'],
  ['5A', 5, '5A'], ['5B', 5, '5B'], ['5C', 5, '5C'], ['5D', 5, '5D'], ['5D BOSS', 5, '5D', 'D2'], ['5E', 5, '5E'], ['5F', 5, '5F'], ['5G', 5, '5G'], ['5H', 5, '5H'],
  ['5I', 5, '5I'], ['5I BOSS', 5, '5I', 'I5'], ['5J', 5, '5J'],   // 2026-10-11 6面まで
  ['6A', 6, '6A'], ['6B', 6, '6B'], ['6C', 6, '6C'], ['6D', 6, '6D'], ['6E', 6, '6E'], ['6F', 6, '6F'], ['ENDING', 0],
];
const jp = (e) => (e[0].includes('BOSS') || e[0].includes('END') ? '' : NAME[e[0]] || '');   // 6面の名前も map_names から
class StageSelect {
  constructor() { this.i = StageSelect.last || 0; this.t = 0; }
  update(dt) {
    this.t += dt;
    if (I.pressed.down) this.i = (this.i + 1) % LIST.length;
    if (I.pressed.right) this.i = Math.min(LIST.length - 1, this.i + 12);   // 左右で列を移動
    if (I.pressed.left) this.i = Math.max(0, this.i - 12);
    if (I.pressed.up) this.i = (this.i + LIST.length - 1) % LIST.length;
    if (I.pressed.jump || I.pressed.pause) return M.setScene(new M.Title());
    if (this.t > 200 && (I.pressed.attack || I.pressed.start)) {
      StageSelect.last = this.i;
      const [, stage, map, section] = LIST[this.i];
      M.game.score = 0; M.game.cleared = [];
      if (!stage) { M.run = M.newRun(6, 0); return M.setScene(new M.Ending6(M.run)); }   // エンディングだけ
      for (let s = 1; s < stage; s++) M.game.cleared.push(s);   // 前の面はクリア済み扱い
      M.startStage(stage, { map, section });
    }
  }
  draw() {
    ctx.fillStyle = '#0b0f1e'; ctx.fillRect(0, 0, M.W, M.H);
    M.text('STAGE SELECT', M.W / 2, 6, { scale: 2, align: 'center', color: '#ffc93a', edge: '#6a1a08' });
    M.text('DEBUG', M.W - 6, 6, { align: 'right', color: '#ff6a5a' });
    const per = 12, rowH = 12;   // 2026-10-11 6面を足したので4列
    LIST.forEach((e, k) => {
      const col = Math.floor(k / per), row = k % per;
      const x = 22 + col * 92, y = 30 + row * rowH, on = k === this.i;
      if (on && ((this.t / 250) | 0) % 2 === 0) M.text('>', x - 12, y, { color: '#fff' });
      M.text(e[0], x, y, { color: on ? '#fff' : e[0].includes('BOSS') ? '#ff9a7a' : '#9ab' });
    });
    const n = jp(LIST[this.i]); if (n) M.jpText(n, M.W / 2, M.H - 18, { align: 'center', color: '#fff5c5' });   // 選んでいるマップの名前だけ下に
    M.text('UP DOWN SELECT  Z START  X BACK', M.W / 2, M.H - 10, { align: 'center', color: '#7f8aa8' });
  }
}
M.StageSelect = StageSelect;
// 2026-10-12 v125 ユーザー指定: 隠しコマンド。タイトルで「左SHIFTを押しながら S を3回」（1.5秒以内）でステージセレクト
let sTaps = [];
window.addEventListener('keydown', (e) => {
  if (e.code !== 'KeyS' || e.repeat || !(M.game && M.game.scene instanceof M.Title)) return;
  if (!e.getModifierState || !e.shiftKey || !(M.Input && M.Input.lshift)) { sTaps = []; return; }
  const now = performance.now(); sTaps = sTaps.filter((t) => now - t < 1500); sTaps.push(now);
  if (sTaps.length >= 3) { sTaps = []; M.setScene(new StageSelect()); }
});
window.addEventListener('keydown', (e) => { if (e.code === 'ShiftLeft') M.Input.lshift = true; }, true);
window.addEventListener('keyup', (e) => { if (e.code === 'ShiftLeft') M.Input.lshift = false; }, true);
window.addEventListener('blur', () => { if (M.Input) M.Input.lshift = false; });
})();
