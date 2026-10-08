import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stocks,completedDailyRows,technical,candidates,swingCandidates,parseGold} from '../worker/dashboard.js';
const fixture=JSON.parse(readFileSync(new URL('./fixtures/daily-audit.json',import.meta.url),'utf8'));
const at=time=>Date.parse('2026-10-08T'+time+'+08:00');
for(const stock of stocks){
 const rows=fixture.stocks[stock.symbol].map(r=>({date:r[0],open:+r[1],close:+r[2],high:+r[3],low:+r[4],volume:+r[5]}));
 for(const time of ['00:01:00','09:50:00','12:00:00','15:04:59']){
  const done=completedDailyRows(rows,at(time));
  assert.equal(done.at(-1).date,'2026-09-30');
  const tech=technical(done),levels=swingCandidates(done,tech,stock.levels);
  assert.deepEqual(levels.slice(0,2),stock.levels.slice(0,2),'Preserve confirmed baseline buys: '+stock.symbol);
  if(levels[2]){assert(levels[2][0]>=levels[0][1]*1.08);assert(levels[2][0]-levels[0][1]>=tech.atr*3);}
  if(levels[3])assert(levels[3][0]-levels[2][1]>=tech.atr);
  assert.deepEqual(levels,swingCandidates(completedDailyRows(rows.map(r=>r.date==='2026-10-08'?{...r,close:r.close*2,high:r.high*2}:r),at(time)),tech,stock.levels),'Intraday movement must not change tiers');
 }
 assert.equal(completedDailyRows(rows,at('15:05:00')).at(-1).date,'2026-10-08');
 const future=[...rows,{date:'2026-10-09',close:999}];assert.equal(completedDailyRows(future,at('18:00:00')).at(-1).date,'2026-10-08');
 const done=completedDailyRows(rows,at('09:50:00')),tech=technical(done);assert.deepEqual(swingCandidates(done,tech).slice(0,2),candidates(done,tech).slice(0,2));
}
const goldBefore=parseGold(fixture.gold,at('09:50:00'));
const goldWithFuture={...fixture.gold,time:[...fixture.gold.time,['2026-10-08',900,910,890,920],['2026-10-09',900,910,890,920]]};
assert.deepEqual(parseGold(goldWithFuture,at('15:59:59')).levels,goldBefore.levels);
assert.equal(parseGold(goldWithFuture,at('16:00:00')).date,'2026-10-08');
assert.deepEqual(swingCandidates([],null),[null,null,null,null]);
console.log('PASS: all four stocks, baseline buys, all tiers, intraday isolation, Shanghai close boundaries, future dates, gold session');
