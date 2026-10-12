// 簡易チュートリアル（2026-10-11 ユーザー指定）
// 地名表示と同じタイプライター（1文字ごとに map_msg01/02 を交互）で画面下に操作説明を出す。
//   move  : ゲーム開始後、ミカが動かせるようになったら「↑↓←→で移動」
//   enemy : 敵が初めて画面に出てきたら「Zボタンで攻撃」「Xボタンでジャンプ」
//   smg   : マシンガンを初めて拾ったら「Zボタン押しっぱなしで発射」
//   djump : ドクターS（ウルトラマシーンS）が初めて追尾弾を撃ったら「ジャンプ中にXボタンで二段ジャンプ」
// キー名は T.keys（将来のキーコンフィグで変わる）の先頭のキーから作る。各説明はタイトルから始めるごとに1回だけ。
(function () {
const M = window.MIKA, T = M.TUNING;
const C = Object.assign({ enabled: true, delayMs: 250, holdMs: 3200, fadeMs: 500, y: 200, lineH: 19 }, T.tutorial || {});

const ARROW = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' };
function keyName(code) {
  if (!code) return '?';
  if (ARROW[code]) return ARROW[code];
  let m = /^Key([A-Z])$/.exec(code); if (m) return m[1];
  m = /^(Digit|Numpad)(\d)$/.exec(code); if (m) return m[2];
  const named = { Space: 'SPACE', Enter: 'ENTER', Escape: 'ESC', Tab: 'TAB', ShiftLeft: 'SHIFT', ShiftRight: 'SHIFT', ControlLeft: 'CTRL', ControlRight: 'CTRL', AltLeft: 'ALT', AltRight: 'ALT' };
  return named[code] || code.toUpperCase();
}
const key = (act) => keyName((T.keys[act] || [])[0]);
const TEXT = {
  move: () => [key('up') + key('down') + key('left') + key('right') + 'で移動'],
  enemy: () => [key('attack') + 'ボタンで攻撃', key('jump') + 'ボタンでジャンプ'],
  smg: () => [key('attack') + 'ボタン押しっぱなしで発射'],
  djump: () => ['ジャンプ中に' + key('jump') + 'ボタンで二段ジャンプ'],   // 2026-10-12 v104 ドクターSが初めて追尾弾を撃った時（避け方のヒント）
};

const Tutor = {
  seen: {}, queue: [], cur: null,
  reset() { this.seen = {}; this.queue = []; this.cur = null; },
  // 説明を出す予約（同じものは1回だけ）
  show(id) {
    if (!C.enabled || this.seen[id] || !TEXT[id]) return;
    this.seen[id] = true; this.queue.push(id);
  },
  busy(w) { return (w.mapTitle && w.mapTitle.active) || (w.bossIntro && w.bossIntro.busy) || w.cutscene || w.clearSeq || w.over || w.exiting; },
  update(dt, w) {
    if (!C.enabled) return;
    // きっかけを見張る
    if (!this.seen.move && !w.lockInput && w.mika && w.mika.state !== 'entrance' && w.kind !== 'room') this.show('move');
    if (!this.seen.enemy && w.enemies.some((e) => e.hp > 0 && !e.dormant && e.x > w.camX + 8 && e.x < w.camX + M.W - 8)) this.show('enemy');
    if (this.cur && w.cutscene) this.cur = null;   // 2026-10-12 演出が始まったら説明は消す（6Aなど）
    if (!this.cur) {
      if (!this.queue.length || this.busy(w)) return;
      const lines = TEXT[this.queue.shift()]().map((s) => Array.from(s));
      this.cur = { lines, total: lines.reduce((n, l) => n + l.length, 0), t: 0, shown: 0, tick: 0 };
    }
    const c = this.cur, step = M.REF.mapNames.intro.per_character_ms;
    c.t += dt;
    const n = Math.max(0, Math.min(c.total, Math.floor((c.t - C.delayMs) / step)));
    while (c.shown < n) {
      const ch = this.charAt(c, c.shown); c.shown++;
      if (ch.trim() && ch !== '　') { c.tick++; M.Audio.play(c.tick % 2 ? 'map_msg01' : 'map_msg02'); }
    }
    // 次の説明が待っていたら、打ち終わって1秒見せたところで早めに消し始める（敵の説明が遅れないように）
    const typed = C.delayMs + c.total * step;
    if (this.queue.length && c.t > typed + 1000 && c.t < typed + C.holdMs) c.t = typed + C.holdMs;
    if (c.t >= typed + C.holdMs + C.fadeMs) this.cur = null;
  },
  charAt(c, i) { for (const l of c.lines) { if (i < l.length) return l[i]; i -= l.length; } return ''; },
  draw() {
    const c = this.cur; if (!c) return;
    const step = M.REF.mapNames.intro.per_character_ms;
    let n = Math.max(0, Math.min(c.total, Math.floor((c.t - C.delayMs) / step)));
    if (!n) return;
    const fadeStart = C.delayMs + c.total * step + C.holdMs;
    M.ctx.globalAlpha = c.t <= fadeStart ? 1 : Math.max(0, 1 - (c.t - fadeStart) / C.fadeMs);
    const y0 = C.y - (c.lines.length - 1) * C.lineH;
    c.lines.forEach((l, i) => {
      const k = Math.min(n, l.length); n -= k;
      if (!k) return;
      // 行の位置は全文の幅で決める（打っている途中で文字が左右に動かないように）
      const x = Math.round(M.W / 2 - M.jpWidth(l.join('')) / 2);
      M.jpText(l.slice(0, k).join(''), x, y0 + i * C.lineH, { color: '#fff5c5', edge: '#101729' });
    });
    M.ctx.globalAlpha = 1;
  },
};
M.Tutor = Tutor;
})();
