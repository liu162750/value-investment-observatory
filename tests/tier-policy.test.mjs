import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {priceReview,POLICY} from '../scripts/mon-wed-policy.mjs';
const snapshot=JSON.parse(readFileSync(new URL('../worker/snapshot.json',import.meta.url),'utf8'));
const reviews=JSON.parse(readFileSync(new URL('../worker/tier-reviews.json',import.meta.url),'utf8'));
assert.equal(POLICY,'two-regime-ma60-final-v1');
const expected={
 sh600312:{regime:'A',levels:[19.53,18.04,22.08,23.18],ma5:21.07},
 sz002156:{regime:'B',levels:[51.23,41.48,52.25,56.60],ma5:40.98},
 sh601138:{regime:'B',levels:[52.57,44.35,53.62,58.44],ma5:44.36},
 sz002463:{regime:'B',levels:[94.73,84.23,104.21,115.78],ma5:86.32}
};
for(const stock of snapshot.stocks){
 const result=priceReview(stock.rows,Date.parse('2026-11-04T20:30:00+08:00'),{symbol:stock.symbol,legacyA:stock.symbol==='sh600312'?{date:'2026-11-04',low:18.6}:null});
 const want=expected[stock.symbol];assert(want);
 assert.equal(result.regime,want.regime);
 assert.deepEqual(result.levels.map(x=>x[0]),want.levels);
 assert.equal(result.ma5,want.ma5);
 assert.deepEqual(stock.levels,result.levels);
 assert.deepEqual(reviews.stocks[stock.symbol].levels,result.levels);
 assert(result.levels[1][0]<result.levels[0][0]);
 assert(result.levels[2][0]<result.levels[3][0]);
 assert(!('riskLine' in result));
 assert(!JSON.stringify(result).includes('cost'));
}
assert.equal(reviews.stocks.sh600312.lowAnchor,18.6);
assert.equal(reviews.stocks.sz002156.possibleLimitUp,true);
assert.equal(reviews.stocks.sz002463.possibleLimitUp,true);
assert.equal(reviews.stocks.sh601138.largeRise,true);
console.log('PASS: final two-regime prices, MA5, legacy Pinggao anchor, public-only sell tiers and limit-up observations');
