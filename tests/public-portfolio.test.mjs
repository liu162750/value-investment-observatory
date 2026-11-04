import assert from 'node:assert/strict';
import {publicPortfolio} from '../worker/dashboard.js';

const account={holdingsAsOf:'2026-11-04 14:00',cash:100,positions:[
 {symbol:'sh600312',shares:1,costPrice:10},{symbol:'sh601138',shares:1,costPrice:20},
 {symbol:'sz002463',shares:1,costPrice:30},{symbol:'sz002156',shares:1,costPrice:40}
]};
const stocks=account.positions.map((p,i)=>({symbol:p.symbol,name:'测试'+i,quote:{price:[20,30,40,50][i],time:'2026-11-04 14:00:00'}}));
const result=publicPortfolio(stocks,account);
assert.equal(result.status,'ok');
assert.equal(result.cashWeight,100/240);
assert(Math.abs(result.investedWeight-140/240)<1e-12);
assert(Math.abs(result.floatingPnlRatio-.4)<1e-12);
assert.deepEqual(result.positions.map(x=>x.weight),[20,30,40,50].map(x=>x/240));
assert(!JSON.stringify(result).includes('shares')&&!JSON.stringify(result).includes('costPrice')&&!JSON.stringify(result).includes('cash":100'));
assert.equal(publicPortfolio(stocks,{...account,positions:account.positions.map(({costPrice,...p})=>p)}).floatingPnlRatio,null);
const aggregate=publicPortfolio(stocks,{...account,costBasisTotal:120,positions:account.positions.map(({costPrice,...p})=>p)});
assert(Math.abs(aggregate.floatingPnlRatio-20/120)<1e-12);
assert.equal(aggregate.holdingsDateVerified,false);
assert(!JSON.stringify(aggregate).includes('costBasisTotal'));
console.log('PASS: public portfolio exposes ratios only and does not invent P/L without costs');
