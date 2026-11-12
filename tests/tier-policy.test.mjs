import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {priceReview,POLICY} from '../scripts/mon-wed-policy.mjs';
const snapshot=JSON.parse(readFileSync(new URL('../worker/snapshot.json',import.meta.url),'utf8'));
const reviews=JSON.parse(readFileSync(new URL('../worker/tier-reviews.json',import.meta.url),'utf8'));
assert.equal(POLICY,'ma60-trend-final-20261104');
const expected={
 sh600312:{trend:'上升趋势',levels:[19.53,18.60,22.08,23.18],ma5:21.54},
 sz002156:{trend:'下降趋势',levels:[43.17,41.91,54.75,57.49],ma5:42.64},
 sh601138:{trend:'下降趋势',levels:[42.53,41.29,53.30,57.20],ma5:42.95},
 sz002463:{trend:'下降趋势',levels:[77.03,74.79,119.29,125.25],ma5:79.08}
};
for(const stock of snapshot.stocks){
 const result=priceReview(stock.rows,Date.parse('2026-11-09T20:30:00+08:00'),{symbol:stock.symbol,legacyA:stock.symbol==='sh600312'?{date:'2026-11-04',low:18.6}:null});
 const want=expected[stock.symbol];assert(want);
 assert.equal(result.trend,want.trend);
 assert.deepEqual(result.levels.map(x=>x[0]),want.levels);
 assert.equal(result.ma5,want.ma5);
 assert.equal(reviews.stocks[stock.symbol].policyId,POLICY);
 assert(result.levels[1][0]<result.levels[0][0]);
 assert(result.levels[2][0]<result.levels[3][0]);
 assert(!('riskLine' in result));
 assert(!('regime' in result));
 assert(!JSON.stringify(result).includes('cost'));
}
assert.equal(reviews.stocks.sh600312.lowAnchor,18.6);
assert.equal(reviews.stocks.sz002156.possibleLimitUp,false);
assert.equal(reviews.stocks.sz002463.possibleLimitUp,false);
console.log('PASS: final MA60 trends, exact four tiers, MA5, Pinggao exception and public-only sell tiers');
