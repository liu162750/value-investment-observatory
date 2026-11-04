import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stocks,completedDailyRows,technical,swingCandidates,parseGold} from '../worker/dashboard.js';
const fixture=JSON.parse(readFileSync(new URL('./fixtures/daily-audit.json',import.meta.url),'utf8'));
const at=time=>Date.parse('2026-10-08T'+time+'+08:00');
for(const stock of stocks){
 const rows=fixture.stocks[stock.symbol].map(r=>({date:r[0],open:+r[1],close:+r[2],high:+r[3],low:+r[4],volume:+r[5]}));
 for(const time of ['00:01:00','09:50:00','12:00:00','15:04:59']){
  const done=completedDailyRows(rows,at(time));
  assert.equal(done.at(-1).date,'2026-09-30');
  const tech=technical(done),levels=swingCandidates(done,tech,stock.levels);
  assert(Number.isFinite(tech.atr20)&&tech.atr20>0,'Use the shared simple-average ATR20 calculation');
  assert.deepEqual(levels,stock.levels,'Daily refresh preserves the last adopted four-tier group: '+stock.symbol);
  assert.deepEqual(swingCandidates(completedDailyRows(rows.map(r=>r.date==='2026-10-08'?{...r,close:r.close*2,high:r.high*2}:r),at(time)),tech,stock.levels),stock.levels,'Intraday movement must not change tiers');
 }
 const afterClose=completedDailyRows(rows,at('15:05:00'));
 assert.equal(afterClose.at(-1).date,'2026-10-08');
 assert.deepEqual(swingCandidates(afterClose,technical(afterClose),stock.levels),stock.levels,'Confirmed tiers remain stable after new close');
 const future=[...rows,{date:'2026-10-09',close:999}];assert.equal(completedDailyRows(future,at('18:00:00')).at(-1).date,'2026-10-08');
 const done=completedDailyRows(rows,at('09:50:00'));assert.deepEqual(swingCandidates(done,technical(done)),[null,null,null,null],'No saved review means no generated tiers');
}
const goldBefore=parseGold(fixture.gold,at('09:50:00'));
assert.equal(goldBefore.levelReview.policyId,'gold-weekly-close-atr20-v1');
assert(goldBefore.levels.every(Boolean),'Gold must always produce four volatility tiers');
assert(goldBefore.levels[0][1]<=goldBefore.levelReview.referencePrice*.97+.011,'Gold buy T1 must not crowd the weekly anchor');
assert(goldBefore.levels[2][0]>=goldBefore.levelReview.referencePrice*1.05-.011,'Gold sell T1 must not crowd the weekly anchor');
assert(goldBefore.levels[0][0]-goldBefore.levels[1][1]>=goldBefore.levelReview.atr20*.9975-.011,'Gold buy tiers need about one ATR20 net spacing');
assert(goldBefore.levels[3][0]-goldBefore.levels[2][1]>=goldBefore.levelReview.atr20*.9975-.011,'Gold sell tiers need about one ATR20 net spacing');
const goldWithFuture={...fixture.gold,time:[...fixture.gold.time,['2026-10-08',900,910,890,920],['2026-10-09',900,910,890,920]]};
assert.deepEqual(parseGold(goldWithFuture,at('15:59:59')).levels,goldBefore.levels);
assert.equal(parseGold(goldWithFuture,at('16:00:00')).date,'2026-10-08');
assert.deepEqual(swingCandidates([],null),[null,null,null,null]);
console.log('PASS: all four stocks, baseline buys, all tiers, intraday isolation, Shanghai close boundaries, future dates, gold session');

assert(readFileSync(new URL('../worker/dashboard.js',import.meta.url),'utf8').includes('...(s.sellReview?.levels||'),'Dashboard must use confirmed buys');

for(const stock of stocks){const saved=JSON.parse(readFileSync(new URL('../worker/snapshot.json',import.meta.url),'utf8')).stocks.find(s=>s.symbol===stock.symbol);assert.equal(stock.levelReview?.policyId,'two-regime-ma60-final-v1');assert.deepEqual(saved.levels,stock.levels);assert.deepEqual(saved.sellReview.levels,stock.sellReview.levels,'Seed and fetched levels must share one saved review');assert(stock.levels[1][0]<stock.levels[0][0]);assert(stock.levels[0][0]<stock.levels[2][0]);assert(stock.levels[2][0]<stock.levels[3][0]);}

for(const stock of stocks){assert.equal(stock.levelReview?.dataDate,'2026-11-04');assert.match(stock.levelReview?.nextScheduled||'',/^\d{4}-\d{2}-\d{2} 16:30$/,'Next review must be explicitly scheduled at 16:30');}

