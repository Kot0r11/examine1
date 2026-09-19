/**
 * 扫雷文件的静态检查（用 Node.js 运行）
 *
 * 只做"不看效果也能查出来"的检查，代替不了在浏览器里实际试玩：
 *   1) 脚本能否通过语法编译（不执行）
 *   2) HTML 标签是否成对
 *   3) 界面代码引用的元素 id 是否都真实存在
 *   4) 任务书要求的功能关键词是否都在
 *
 * 运行：node tools/check-game.js
 */

const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'minesweeper.html');
const html = fs.readFileSync(file, 'utf8');
let ok = true;

/* 1) 脚本语法 */
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
console.log('script 块数量:', scripts.length);
scripts.forEach((code, i) => {
  try {
    new Function(code);            // 只编译，不执行
    console.log('  脚本 ' + (i + 1) + ' 语法: OK');
  } catch (e) {
    ok = false;
    console.log('  脚本 ' + (i + 1) + ' 语法错误: ' + e.message);
  }
});

/* 2) 标签配对 */
const VOID = new Set(['meta', 'br', 'img', 'hr', 'link', 'input', 'source']);
const stack = [], errors = [];
for (const m of html.matchAll(/<\/?([a-zA-Z][a-zA-Z0-9]*)[^>]*?(\/?)>/g)) {
  const tag = m[1].toLowerCase();
  if (VOID.has(tag) || m[2] === '/') continue;
  if (m[0].startsWith('</')) {
    const top = stack.pop();
    if (top !== tag) errors.push('期望 </' + top + '>，实际 </' + tag + '>');
  } else {
    stack.push(tag);
  }
}
console.log('标签未闭合:', stack.length ? stack : '无');
console.log('标签配对错误:', errors.length ? errors : '无');
if (stack.length || errors.length) ok = false;

/* 3) getElementById 引用的 id 是否存在 */
const ids = new Set([...html.matchAll(/id="([^"]+)"/g)].map(m => m[1]));
const refs = new Set([...html.matchAll(/getElementById\('([^']+)'\)/g)].map(m => m[1]));
const missing = [...refs].filter(r => !ids.has(r));
console.log('代码引用的元素 id:', refs.size, '个 | 缺失:', missing.length ? missing : '无');
if (missing.length) ok = false;

/* 4) 任务书要求的功能 */
const must = [
  ['阶段一：右键插旗', 'contextmenu'],
  ['阶段一：触屏长按插旗', 'touchstart'],
  ['阶段一：左侧计数与计时', 'mine-left'],
  ['阶段一：实时得分显示', 'currentScore'],
  ['阶段二：AI 决策', 'aiDecide'],
  ['阶段二：连续通关 2 局判定', 'aiStats.streak >= 2'],
  ['新增功能：主题切换', 'data-theme'],
  ['新增功能：主题持久化', 'setItem(THEME_KEY'],
  ['新增功能：计分制统计', 'bestScore'],
  ['新增功能：重置按钮', 'btn-reset'],
  ['自定义主题：角色数据', 'BANDS'],
  ['自定义主题：随机', 'randomTheme'],
  ['自定义主题：卡面图片', 'setImage'],
  ['自定义主题：内置卡面数据', 'CARD_SETS'],
  ['自定义主题：卡面地址模板', 'function cardUrl'],
  ['自定义主题：随机卡面', 'randomCard'],
  ['通关后把雷标出来', 'c.mine && !c.flagged'],
  ['新增功能：多局战绩', 'renderHistory'],
  ['AI 连胜不会被中途停下清零', '这里不清零连胜'],
];
console.log('');
must.forEach(([name, kw]) => {
  const has = html.includes(kw);
  if (!has) ok = false;
  console.log((has ? '  OK   ' : '  缺少 ') + name);
});

console.log('');
console.log(ok ? '静态检查全部通过' : '静态检查有未通过项');
process.exit(ok ? 0 : 1);
