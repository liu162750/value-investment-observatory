import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {priceReview,POLICY} from '../scripts/mon-wed-policy.mjs';
const snapshot=JSON.parse(readFileSync(new URL('../worker/snapshot.json',import.meta.url),'utf8'));
const reviews=JSON.parse(readFileSync(new URL('../worker/tier-reviews.json',import.meta.url),'utf8'));
assert.equal(POLICY,'ma60-trend-final-20261104');
const expected={
 sh600312:{trend:'上升趋势',levels:[19.53,18.60,22.08,23.18],ma5:21.07},
 sz002156:{trend:'下降趋势',levels:[42.29,41.06,47.28,56.60],ma5:40.98},
 sh601138:{trend:'下降趋势',levels:[45.21,43.89,48.28,58.44],ma5:44.36},
 sz002463:{trend:'下降趋势',levels:[85.87,83.37,104.21,115.78],ma5:86.32}
};
for(const stock of snapshot.stocks){
 const result=priceReview(stock.rows,Date.parse('2026-11-04T20:30:00+08:00'),{symbol:stock.symbol,legacyA:stock.symbol==='sh600312'?{date:'2026-11-04',low:18.6}:null});
 const want=expected[stock.symbol];assert(want);
 assert.equal(result.trend,want.trend);
 assert.deepEqual(result.levels.map(x=>x[0]),want.levels);
 assert.equal(result.ma5,want.ma5);
 assert.deepEqual(stock.levels,result.levels);
 assert.deepEqual(reviews.stocks[stock.symbol].levels,result.levels);
 assert(result.levels[1][0]<result.levels[0][0]);
 assert(result.levels[2][0]<result.levels[3][0]);
 assert(!('riskLine' in result));
 assert(!('regime' in result));
 assert(!JSON.stringify(result).includes('cost'));
}
assert.equal(reviews.stocks.sh600312.lowAnchor,18.6);
assert.equal(reviews.stocks.sz002156.possibleLimitUp,true);
assert.equal(reviews.stocks.sz002463.possibleLimitUp,true);
console.log('PASS: final MA60 trends, exact four tiers, MA5, Pinggao exception and public-only sell tiers');
