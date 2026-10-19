import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stocks} from '../worker/dashboard.js';
const fixture=JSON.parse(readFileSync(new URL('./fixtures/atr20-review-20261019.json',import.meta.url),'utf8'));
const page=readFileSync(new URL('../worker/page.html',import.meta.url),'utf8');
new Function(page.slice(page.indexOf('const $='),page.lastIndexOf('</script>')));
for(const stock of stocks){
 const a=fixture.stocks[stock.symbol];assert(a.bars.length>=250);
 const bars=a.bars,trs=bars.slice(1).map((r,i)=>Math.max(r.high-r.low,Math.abs(r.high-bars[i].close),Math.abs(r.low-bars[i].close)));
 const atr=trs.slice(-20).reduce((x,y)=>x+y)/20;assert(Math.abs(atr-a.atr)<.00006);
 const levels=[...a.buy,...a.sell].map(t=>[t.low,t.high]);assert.deepEqual(stock.levels,levels);
 assert(levels[0][1]<=a.quote.price*(fixture.userRequestedBuyAdjustment?.99:.975));assert(levels[2][0]>=a.quote.price*1.05);
 if(fixture.userRequestedBuyAdjustment){for(let i=0;i<2;i++)assert(levels[i][1]>a.previousBuy[i].high);assert.deepEqual(levels.slice(2),stock.sellReview.levels);}
 assert(levels[0][0]-levels[1][1]>=atr*1.05*.95-1e-8);assert(levels[3][0]-levels[2][1]>=atr*1.05*.95-1e-8);
 assert.equal(stock.levelReview.nextScheduled,'2026-10-21 16:30');
}
assert.equal(fixture.marketGate.frozen,true);
const calc=new Function('model',page.slice(page.indexOf('function accountView('),page.indexOf('const previewAccounts='))+';return accountView;')({stale:false});
const stock={symbol:'x',quote:{time:'2026-10-19 10:00:00'},distances:[{inside:true},{inside:true}],levelReview:{policyId:'ATR20-handoff-v1',marketGate:{asOf:'2026-10-19',frozen:true}}};
const account={weight:.7,positions:[{symbol:'x',budgetAvailable:[true,true]}]};
assert(calc(account,[stock],Date.parse('2026-10-19T10:00:01+08:00')).positions[0].alerts.every(a=>a.text.includes('大盘买入冻结')&&!a.flash));
console.log('PASS: ATR20 arithmetic, final band edges/gaps, saved tiers, frozen market gate and script syntax');
