/**
 * 界面层回归测试（用 Node.js 运行）
 *
 * 为什么需要它：AI 胜率模拟只测了"引擎"（纯逻辑），测不出"引擎和界面的连接"。
 * 之前就出过这个问题——左键点数字时调用了展开函数，却忘了重画界面，
 * 数据变了但屏幕上没变化，看起来就像功能坏了。
 *
 * 这个测试用一个极简的假 DOM 把整个游戏脚本跑起来，然后真的去"点"格子，
 * 检查数据变化之后界面元素有没有跟着更新。
 *
 * 运行：node tools/test-ui.js [要测试的 html 路径]
 */

const fs = require('fs');
const path = require('path');

const htmlPath = process.argv[2] ||
  path.join(__dirname, '..', 'minesweeper.html');
const html = fs.readFileSync(htmlPath, 'utf8');

const script = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));

/* ---------- 极简假 DOM ---------- */
let pass = 0, fail = 0;
const check = (name, cond, extra) => {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra ? '   → ' + extra : '')); }
};

function makeEl(tag) {
  const cls = new Set();
  const el = {
    tag,
    children: [],
    dataset: {},
    handlers: {},
    textContent: '',
    _html: '',
    style: { setProperty() {}, removeProperty() {} },
    get innerHTML() { return el._html; },
    set innerHTML(v) { el._html = v; if (v === '') el.children = []; },
    get className() { return [...cls].join(' '); },
    set className(v) { cls.clear(); String(v).split(/\s+/).filter(Boolean).forEach(c => cls.add(c)); },
    classList: {
      add: (...c) => c.forEach(x => cls.add(x)),
      remove: (...c) => c.forEach(x => cls.delete(x)),
      contains: c => cls.has(c),
      toggle: (c, on) => (on ? cls.add(c) : cls.delete(c))
    },
    appendChild(child) { el.children.push(child); return child; },
    addEventListener(type, fn) { (el.handlers[type] = el.handlers[type] || []).push(fn); },
    closest() { return el; },
    querySelectorAll() { return []; }
  };
  return el;
}

const byId = {};
const board = makeEl('div');
byId.board = board;

const doc = {
  documentElement: {
    _attr: {},
    setAttribute(k, v) { doc.documentElement._attr[k] = v; },
    getAttribute(k) { return doc.documentElement._attr[k]; },
    style: { setProperty() {}, removeProperty() {} }
  },
  getElementById(id) { return byId[id] || (byId[id] = makeEl('div')); },
  createElement(tag) { return makeEl(tag); },
  body: makeEl('body')
};

const store = {};
const localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; }
};

const window = {};
const timers = [];

/* ---------- 跑起来 ---------- */
new Function(
  'document', 'localStorage', 'window', 'setInterval', 'clearInterval',
  'setTimeout', 'clearTimeout', 'navigator', 'confirm', 'Image',
  script
)(
  doc, localStorage, window,
  (fn, ms) => { const id = timers.length; timers.push(fn); return id; },
  () => {}, (fn) => { return 0; }, () => {},
  { vibrate() {} }, () => false,
  function Image() { this.src = ''; }
);

const game = window.__minesweeper.game;
const cellEl = i => window.__minesweeper.cellEl(i);

console.log('脚本加载完成，初始状态：' + game.status + '，棋盘 ' + game.cols + '×' + game.rows);

/* 模拟一次鼠标事件 */
function fire(el, type, event) {
  (el.handlers[type] || []).forEach(fn => fn(Object.assign({
    target: el, button: 0, preventDefault() {}
  }, event)));
}

/* 1) 先左键点一格，把局面打开 */
const first = 4 * 9 + 4;
fire(board, 'mouseup', { target: cellEl(first), button: 0 });
check('左键点开格子后，棋盘进入进行中状态', game.status === 'playing', 'status=' + game.status);
check('左上角第一格界面已被标记为已翻开', cellEl(first).classList.contains('down'));

/* 2) 找一个"已翻开的数字格，周围还有没翻开的安全格" */
let target = null;
for (let i = 0; i < 81; i++) {
  const c = game.cells[i];
  if (!c.revealed || c.adj === 0) continue;
  const x = i % 9, y = (i / 9) | 0;
  const nb = [];
  for (const [dx, dy] of [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]]) {
    const nx = x + dx, ny = y + dy;
    if (nx >= 0 && ny >= 0 && nx < 9 && ny < 9) nb.push(ny * 9 + nx);
  }
  const safeHidden = nb.filter(k => !game.cells[k].revealed && !game.cells[k].flagged && !game.cells[k].mine);
  const mineHidden = nb.filter(k => !game.cells[k].revealed && !game.cells[k].flagged && game.cells[k].mine);
  if (safeHidden.length) { target = { i, x, y, nb, mineHidden, safeHidden }; break; }
}
if (!target) { console.log('  (这个随机局面里没有合适的目标格，跳过后续测试)'); process.exit(fail ? 1 : 0); }

console.log('目标格：第 ' + (target.y + 1) + ' 行第 ' + (target.x + 1) + ' 列，数字 ' +
            game.cells[target.i].adj + '；周围未翻开的安全格 ' + target.safeHidden.length + ' 个');

/* 3) 旗子没插够时点数字：不应该展开，但要给出提示 */
fire(board, 'mouseup', { target: cellEl(target.i), button: 0 });
check('旗子不够时点击数字不会误翻开', game.cells[target.safeHidden[0]].revealed === false);

/* 4) 把周围的雷都插上旗，再点这个数字：必须真的展开，而且界面要跟着更新 */
for (const k of target.mineHidden) {
  fire(board, 'mousedown', { target: cellEl(k), button: 2 });
}
const beforeCount = game.revealedCount;
fire(board, 'mouseup', { target: cellEl(target.i), button: 0 });

check('插满旗后点击数字，数据上确实展开了新格',
      game.revealedCount > beforeCount, beforeCount + ' → ' + game.revealedCount);

const safeCell = game.cells[target.safeHidden[0]];
check('★ 界面同步更新了（上一次就是这里出的 bug）',
      safeCell.revealed === true && cellEl(target.safeHidden[0]).classList.contains('down'));
check('展开过程没有踩雷', game.status !== 'lost');

/* 5) 角色主题：点一个角色按钮，配色应该真的换掉并存进本地 */
const charList = byId['char-list'];
const chip = makeEl('button');
chip.dataset.id = '21';                       // 21 = 凑友希那（Roselia），官方色 #881188
fire(charList, 'click', { target: chip });
const th = window.__minesweeper.theme;
check('点角色按钮后切换到角色主题', th.kind === 'char' && th.color === '#881188',
      'kind=' + th.kind + ' color=' + th.color);
check('角色主题会写进本地存储（刷新后能保留）',
      (store['minesweeper.theme.v2'] || '').indexOf('#881188') >= 0);

/* 6) 卡面：选中角色后应该列出 TA 的卡面，地址要用真实的资源目录名 */
const cardHtml = window.__minesweeper.cardListHtml();
check('选中角色后列出该角色的卡面', cardHtml.indexOf('<img') >= 0 && cardHtml.split('<img').length > 5,
      '卡面数量≈' + (cardHtml.split('<img').length - 1));
check('卡面地址用了正确的资源目录格式',
      cardHtml.indexOf('https://bestdori.com/assets/jp/characters/resourceset/res') >= 0 &&
      cardHtml.indexOf('_rip/card_normal.png') >= 0);

/* 7) 通关后必须把所有雷标出来，否则玩家看不出自己赢了 */
const api = window.__minesweeper;
api.newBoard();
const g2 = api.game;
fire(board, 'mouseup', { target: cellEl(40), button: 0 });   // 第一下，布雷
const mineCells = [];
for (let i = 0; i < 81; i++) if (g2.cells[i].mine) mineCells.push(i);
for (let i = 0; i < 81; i++) {
  if (g2.cells[i].mine) continue;
  fire(board, 'mouseup', { target: cellEl(i), button: 0 });
}
check('把所有安全格翻完后判定为胜利', g2.status === 'won', 'status=' + g2.status);
check('胜利后所有雷自动插旗（一眼能看出雷的位置）',
      mineCells.length === 10 && mineCells.every(i => g2.cells[i].flagged),
      '雷数=' + mineCells.length);
check('胜利后界面上雷的位置显示为旗帜',
      cellEl(mineCells[0]).textContent === '🚩');

/* 8) 多局战绩：每打完一局自动追加一条 */
const hist = api.stats.human.history;
check('打完一局后自动记入战绩', hist.length === 1 && hist[0].win === true,
      '条数=' + hist.length);
check('战绩列表界面能显示记录', api.historyHtml().indexOf('通关') >= 0);

/* 9) 战绩只保留最近 10 局 */
api.stats.human.history = [];
for (let i = 0; i < 10; i++) {
  api.stats.human.history.push({ t: Date.now(), win: i % 2 === 0, sec: 10 + i, score: 100 });
}
api.newBoard();
const g3 = api.game;
fire(board, 'mouseup', { target: cellEl(40), button: 0 });   // 先布雷
for (let i = 0; i < 81; i++) {
  if (!g3.cells[i].mine) fire(board, 'mouseup', { target: cellEl(i), button: 0 });
}
check('战绩超过 10 局时只保留最近 10 局',
      api.stats.human.history.length === 10 && api.stats.human.history[9].win === true,
      '条数=' + api.stats.human.history.length);

/* 10) AI 连胜：中途停下来再开始，不应该把连胜清零（否则最长连胜永远涨不上去） */
api.stats.ai.streak = 5;
api.stats.ai.bestStreak = 5;
api.startAI();
check('重新开始 AI 演示不会清零连胜', api.stats.ai.streak === 5,
      'streak=' + api.stats.ai.streak);

/* 11) AI 打完一局后不能自动停下（否则连胜永远涨不过 2） */
const g4 = api.game;
let guard = 0;
while (g4.status !== 'won' && g4.status !== 'lost' && guard++ < 400) api.aiTick();
api.aiTick();          // 再走一步，让 AI 结算这一局
check('AI 打完一局后演示仍在继续（没有自动停止）', api.aiRunning === true);
check('这一局被记入 AI 战绩', api.stats.ai.games >= 1 && api.stats.ai.recent.length >= 1,
      'AI局数=' + api.stats.ai.games + ' 最近战绩=' + api.stats.ai.recent.join(''));
api.stopAI();

console.log('');
console.log('结果：通过 ' + pass + ' 项，失败 ' + fail + ' 项');
process.exit(fail ? 1 : 0);
