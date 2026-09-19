/**
 * 扫雷 AI 批量模拟测试（用 Node.js 运行）
 *
 * 目的：验证第二阶段"AI 自动完成标准局（9×9、10 雷）"的真实能力。
 * 做法：从 minesweeper.html 里抽出不含界面的引擎代码，用同一套 AI 逻辑
 *       反复随机开新局，统计胜率、最长连胜、以及"连续通关 2 局"需要多少局。
 *
 * 运行：node tools/simulate-minesweeper.js [局数]
 */

const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '..', 'minesweeper.html');
const html = fs.readFileSync(htmlPath, 'utf8');

const MARK_A = 'ENGINE_START';
const MARK_B = 'ENGINE_END';
const iA = html.indexOf(MARK_A);
const iB = html.indexOf(MARK_B);
if (iA < 0 || iB < 0) throw new Error('在 minesweeper.html 里找不到引擎代码块');

const codeStart = html.indexOf('*/', iA) + 2;
const codeEnd = html.lastIndexOf('/*', iB);
const code = html.slice(codeStart, codeEnd);

const engine = new Function(
  code + '\nreturn { newGame, reveal, toggleFlag, aiDecide, mulberry32 };'
)();

const { newGame, reveal, toggleFlag, aiDecide, mulberry32 } = engine;
const COLS = 9, ROWS = 9, MINES = 10;
const MAX_MOVES = 400;   // 防止死循环的保护值

function playOne(seed) {
  const g = newGame(COLS, ROWS, MINES, mulberry32(seed));
  let moves = 0;
  let safety = 0;

  while (g.status !== 'won' && g.status !== 'lost' && moves < MAX_MOVES) {
    const d = aiDecide(g);
    if (!d) break;
    const x = d.cell % g.cols;
    const y = (d.cell / g.cols) | 0;
    const changed = d.action === 'flag' ? toggleFlag(g, x, y) : reveal(g, x, y);

    if (!changed) {
      // 这一步没产生任何变化，说明 AI 选中了无效目标：随便翻开一个未知格，避免死循环
      let done = false;
      for (let i = 0; i < g.cells.length; i++) {
        const c = g.cells[i];
        if (!c.revealed && !c.flagged) {
          reveal(g, i % g.cols, (i / g.cols) | 0);
          done = true;
          break;
        }
      }
      safety++;
      if (!done || safety > 20) break;
    }
    moves++;
  }
  return { won: g.status === 'won', moves, status: g.status };
}

/* ---------- 测试 1：连续玩 N 局，看总胜率和最长连胜 ---------- */
const N = parseInt(process.argv[2] || '1000', 10);
let wins = 0, totalMoves = 0, streak = 0, bestStreak = 0;
let metAt = null;                       // 第几局达成了"连续通关 2 局"
let stuckGames = 0;

const t0 = Date.now();
for (let i = 0; i < N; i++) {
  const r = playOne(90001 + i);
  totalMoves += r.moves;
  if (r.moves >= MAX_MOVES) stuckGames++;
  if (r.won) {
    wins++;
    streak++;
    if (streak > bestStreak) bestStreak = streak;
  } else {
    streak = 0;
  }
  if (metAt === null && streak >= 2) metAt = i + 1;
}
const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

console.log('=== 测试 1：连续模拟 ' + N + ' 局（标准局 9×9、10 雷） ===');
console.log('总胜率        : ' + (wins / N * 100).toFixed(1) + '%  (' + wins + '/' + N + ')');
console.log('最长连胜      : ' + bestStreak + ' 局');
console.log('首次达成连续 2 局通关 : 第 ' + metAt + ' 局');
console.log('平均每局操作数: ' + (totalMoves / N).toFixed(1));
console.log('异常未结束局数: ' + stuckGames);
console.log('总耗时        : ' + elapsed + ' 秒');

/* ---------- 测试 2：反复"从零开始打到连胜 2 局"，看平均要几局 ---------- */
const TRIALS = 200;
let sumGames = 0, worst = 0, successes = 0;

for (let t = 0; t < TRIALS; t++) {
  let s = 0, played = 0;
  while (played < 200) {
    const r = playOne(500000 + t * 1000 + played);
    played++;
    s = r.won ? s + 1 : 0;
    if (s >= 2) break;
  }
  if (s >= 2) { successes++; sumGames += played; if (played > worst) worst = played; }
}

console.log('');
console.log('=== 测试 2：' + TRIALS + ' 次"从零开始打到连续通关 2 局" ===');
console.log('成功次数      : ' + successes + '/' + TRIALS);
console.log('平均需要局数  : ' + (sumGames / Math.max(1, successes)).toFixed(2) + ' 局');
console.log('最多需要局数  : ' + worst + ' 局');
