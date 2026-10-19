import { readFileSync, writeFileSync } from 'node:fs';

const reviews = {
  sh600312: { buy: [[20.09,20.40],[18.86,19.16]], sell: [null,null], reference: 20.74 },
  sz002156: { buy: [[47.28,48.78],null], sell: [[61.40,62.90],[71.75,73.25]], reference: 48.67 },
  sh601138: { buy: [null,null], sell: [null,null], reference: 47.78 },
  sz002463: { buy: [[110.78,114.22],[103.44,106.88]], sell: [[127.26,130.72],[140.16,143.62]], reference: 113.38 },
};

const review = {
  asOf: '2026-10-19 11:05',
  dataDate: '2026-10-16',
  nextScheduled: '2026-10-23 16:30',
  policy: '每周五收盘后复核；连续2个收盘日跌破T2、ATR较上次扩大20%以上或新增业绩报告时临时复核',
};

let source = readFileSync('worker/dashboard.js', 'utf8');
for (const [symbol, value] of Object.entries(reviews)) {
  const marker = `{symbol:'${symbol}',`;
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`Missing stock ${symbol}`);
  const end = source.indexOf('\n{symbol:', start + marker.length);
  const sliceEnd = end < 0 ? source.indexOf('\n];', start) : end;
  let block = source.slice(start, sliceEnd);
  block = block
    .replace(/sellReview:\{.*?\},sellReference:/s, `sellReview:${JSON.stringify({asOf:review.asOf,dataDate:review.dataDate,policy:'已完成日线真实压力；距复核价至少12%且1ATR；距买T1上沿至少8%且1ATR',levels:value.sell})},levelReview:${JSON.stringify(review)},sellReference:`)
    .replace(/sellReference:\{price:[^,]+,asOf:'[^']+',source:'[^']+'\}/, `sellReference:{price:${value.reference},asOf:'${review.asOf}',source:'腾讯财经完整日线收盘 · 本轮固定复核基准，非持仓成本'}`);
  const levelAt = block.lastIndexOf('levels:');
  if (levelAt < 0) throw new Error(`Missing levels for ${symbol}`);
  block = block.slice(0, levelAt) + `levels:${JSON.stringify([...value.buy,...value.sell])}},`;
  source = source.slice(0, start) + block + source.slice(sliceEnd);
}
source = source
  .replace("levelDate:s.sellReview?.dataDate||tech?.date||'待核验'", "levelDate:s.levelReview?.dataDate||s.sellReview?.dataDate||tech?.date||'待核验'")
  .replace("levelType:'买档2026-09-30确认 · 卖档已保存 · 复核价≥12%且≥1ATR · 120交易日压力 · 待估值复核'", "levelType:'买卖档已按周复核 · 缺少可靠支撑或压力时留空 · 触价仍须估值与走势确认'");
writeFileSync('worker/dashboard.js', source);

const snapshot = JSON.parse(readFileSync('worker/snapshot.json', 'utf8'));
for (const stock of snapshot.stocks) {
  const value = reviews[stock.symbol];
  if (!value) continue;
  stock.levels = [...value.buy, ...value.sell];
  stock.sellReview = { asOf: review.asOf, dataDate: review.dataDate, policy: '已完成日线真实压力；距复核价至少12%且1ATR；距买T1上沿至少8%且1ATR', levels: value.sell };
  stock.levelReview = review;
  stock.sellReference = { price: value.reference, asOf: review.asOf, source: '腾讯财经完整日线收盘 · 本轮固定复核基准，非持仓成本' };
  stock.levelDate = review.dataDate;
  stock.levelType = '买卖档已按周复核 · 缺少可靠支撑或压力时留空 · 触价仍须估值与走势确认';
}
writeFileSync('worker/snapshot.json', JSON.stringify(snapshot, null, 2) + '\n');

let page = readFileSync('worker/page.html', 'utf8');
page = page.replace("+(s.sellReference?.price?'<br>固定复核价 ¥'+num(s.sellReference.price)+' · '+esc(s.sellReference.asOf):'')+'", "+(s.sellReference?.price?'<br>固定复核价 ¥'+num(s.sellReference.price)+' · '+esc(s.sellReference.asOf):'')+(s.levelReview?.nextScheduled?'<br>下次定期复核 '+esc(s.levelReview.nextScheduled)+'；满足异常条件将提前复核':'')+'");
writeFileSync('worker/page.html', page);

let test = readFileSync('tests/levels.test.mjs', 'utf8');
test = test.replace(/\n  if\(stock\.symbol==='sz002156'\).*?former 3ATR floor'\);/, '');
test += "\nfor(const stock of stocks){assert.equal(stock.levelReview?.dataDate,'2026-10-16');assert.equal(stock.levelReview?.nextScheduled,'2026-10-23 16:30');}\n";
writeFileSync('tests/levels.test.mjs', test);

const docs = 'docs/observation-level-rules.md';
writeFileSync(docs, readFileSync(docs, 'utf8') + `\n\n## 2026-10-19 自动再校准规则（覆盖此前固定买档规则）\n\n- 每周五收盘后用最近120个完整交易日正式复核四档，下一交易日发布。\n- 连续两个交易日收盘跌破买T2、ATR14相较上次复核扩大20%以上，或新增定期报告、业绩预告/快报时，提前触发临时复核。\n- 买档使用真实局部低点并结合正常化盈利和估值安全边际；卖档使用真实历史压力并保留间距约束。没有可靠支撑或压力时显示“暂无符合条件”，不得编造价格。\n- 盘中刷新只更新报价和触价状态，不重算档位，避免价格下跌时档位机械追随。\n- 本轮以2026-10-16完整日线复核，复核时间2026-10-19 11:05；下次定期复核为2026-10-23 16:30。\n`);

console.log('Recalibrated four stock tiers and scheduling metadata.');
