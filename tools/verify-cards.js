/**
 * 校验内置卡面地址是否真的能取到图片（用 Node.js 运行，需要能访问 bestdori.com）
 *
 * 为什么需要单独校验：卡面数据是按"资源编号"存进游戏的，编号错一位就会变成
 * 碎图。而且 bestdori 对不存在的路径也会返回 200，所以只检查状态码没有意义，
 * 这里直接检查返回内容的文件头是不是 PNG。
 *
 * 运行：node tools/verify-cards.js [数量|all]     默认每位角色抽查 1 张
 */

const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'minesweeper.html'), 'utf8');
const block = html.match(/const CARD_SETS = \{([\s\S]*?)\n\};/);
if (!block) throw new Error('没找到 CARD_SETS 数据');
const sets = new Function('return {' + block[1] + '};')();

function cardUrl(code) {
  return 'https://bestdori.com/assets/jp/characters/resourceset/res' +
         code.slice(1) + '_rip/card_normal.png';
}

const chars = Object.keys(sets);
const arg = process.argv[2] || '40';
const perChar = arg === 'all' ? null : 1;
const limit = arg === 'all' ? Infinity : parseInt(arg, 10);

const targets = [];
for (const ch of chars) {
  const cards = perChar ? sets[ch].slice(0, perChar) : sets[ch];
  for (const code of cards) {
    if (targets.length >= limit) break;
    targets.push({ ch, code, url: cardUrl(code) });
  }
  if (targets.length >= limit) break;
}

async function checkOne(t) {
  try {
    const res = await fetch(t.url);
    const buf = Buffer.from(await res.arrayBuffer());
    // PNG 文件头固定是 89 50 4E 47
    const isPng = buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 &&
                  buf[2] === 0x4e && buf[3] === 0x47;
    return { ...t, ok: isPng, bytes: buf.length, status: res.status };
  } catch (err) {
    return { ...t, ok: false, bytes: 0, status: 0, error: err.message };
  }
}

(async () => {
  console.log('抽查 ' + targets.length + ' 个卡面地址（共 ' + chars.length + ' 位角色，' +
              Object.values(sets).reduce((a, b) => a + b.length, 0) + ' 张卡面数据）');
  const results = [];
  const CONCURRENCY = 6;
  for (let i = 0; i < targets.length; i += CONCURRENCY) {
    const batch = targets.slice(i, i + CONCURRENCY);
    results.push(...await Promise.all(batch.map(checkOne)));
  }

  const bad = results.filter(r => !r.ok);
  for (const r of results) {
    if (!r.ok) console.log('  ✗ 角色 ' + r.ch + '  ' + r.code + '  ' + r.url);
  }
  const sizes = results.filter(r => r.ok).map(r => r.bytes);
  console.log('');
  console.log('成功: ' + (results.length - bad.length) + ' / ' + results.length);
  if (sizes.length) {
    console.log('图片大小: 最小 ' + Math.round(Math.min(...sizes) / 1024) + ' KB，最大 ' +
                Math.round(Math.max(...sizes) / 1024) + ' KB');
  }
  process.exit(bad.length ? 1 : 0);
})();
