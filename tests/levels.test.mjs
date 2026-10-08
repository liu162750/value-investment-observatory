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
  if(levels[2]){assert(levels[2][0]>=levels[0][1]*1.08);assert(levels[2][0]-levels[0][1]>=tech.atr);}
  if(levels[3])assert(levels[3][0]-levels[2][1]>=tech.atr);
  if(stock.symbol==='sz002156')assert.deepEqual(levels[2],[65.02,66.54],'Do not skip recent Tongfu resistance because of the former 3ATR floor');
  if(levels[2]){
   const pivots=[];
   for(let i=Math.max(2,done.length-60);i<done.length-2;i++)if(done.slice(i-2,i+3).every(r=>r.high<=done[i].high)&&done[i].high>done.at(-1).close)pivots.push(done[i].high);
   const floor=Math.max(stock.levels[0][1]*1.08,stock.levels[0][1]+tech.atr);
   const nearest=Math.min(...pivots.filter(p=>Math.floor((p-tech.atr*.25)*100)/100>=floor));
   assert.equal(levels[2][0],Math.floor((nearest-tech.atr*.25)*100)/100,'Use nearest qualified recent resistance for every stock');
  }
  assert.deepEqual(levels,swingCandidates(completedDailyRows(rows.map(r=>r.date==='2026-10-08'?{...r,close:r.close*2,high:r.high*2}:r),at(time)),tech,stock.levels),'Intraday movement must not change tiers');
 }
 const afterClose=completedDailyRows(rows,at('15:05:00'));
 assert.equal(afterClose.at(-1).date,'2026-10-08');
 assert.deepEqual(swingCandidates(afterClose,technical(afterClose),stock.levels).slice(0,2),stock.levels.slice(0,2),'Confirmed buys remain stable after new close');
 const future=[...rows,{date:'2026-10-09',close:999}];assert.equal(completedDailyRows(future,at('18:00:00')).at(-1).date,'2026-10-08');
 const done=completedDailyRows(rows,at('09:50:00')),tech=technical(done);assert.deepEqual(swingCandidates(done,tech).slice(0,2),candidates(done,tech).slice(0,2));
}
const goldBefore=parseGold(fixture.gold,at('09:50:00'));
const goldWithFuture={...fixture.gold,time:[...fixture.gold.time,['2026-10-08',900,910,890,920],['2026-10-09',900,910,890,920]]};
assert.deepEqual(parseGold(goldWithFuture,at('15:59:59')).levels,goldBefore.levels);
assert.equal(parseGold(goldWithFuture,at('16:00:00')).date,'2026-10-08');
assert.deepEqual(swingCandidates([],null),[null,null,null,null]);
console.log('PASS: all four stocks, baseline buys, all tiers, intraday isolation, Shanghai close boundaries, future dates, gold session');

assert(readFileSync(new URL('../worker/dashboard.js',import.meta.url),'utf8').includes('levels=swingCandidates(d.rows,tech,s.levels)'),'Dashboard must use confirmed buys');
