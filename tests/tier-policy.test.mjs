import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {priceReview,POLICY} from '../scripts/mon-wed-policy.mjs';
const snapshot=JSON.parse(readFileSync(new URL('../worker/snapshot.json',import.meta.url),'utf8'));
assert.equal(POLICY,'swing-atr-two-tier-20261112');
const recent={
 sh600312:[[21.25,21.23,21.35,20.95],[21.23,20.87,21.26,20.8]],
 sz002156:[[46.38,44.5,46.98,44.34],[44.48,45.9,46.15,44.11]],
 sh601138:[[44.14,43.18,44.55,43],[42.84,45.56,45.81,42.57]],
 sz002463:[[81.64,81.3,84.47,80.82],[81.3,89.43,89.43,81.07]]
};
const expected={
 sh600312:{trend:'上升趋势',levels:[19.47,18.67,22.08,23.18],ma5:21.33},
 sz002156:{trend:'下降趋势',levels:[44.44,41.52,51.16,55.16],ma5:44.56},
 sh601138:{trend:'下降趋势',levels:[44.20,41.48,50.48,56.42],ma5:43.26},
 sz002463:{trend:'下降趋势',levels:[85.59,77.91,118.89,124.83],ma5:80.41}
};
for(const stock of snapshot.stocks){
 const rows=[...stock.rows,...recent[stock.symbol].map((v,i)=>({date:'2026-11-'+(10+i),open:v[0],close:v[1],high:v[2],low:v[3]}))];
 const result=priceReview(rows,Date.parse('2026-11-12T12:00:00+08:00'),{symbol:stock.symbol});
 const want=expected[stock.symbol];assert(want);
 assert.equal(result.trend,want.trend);
 assert.deepEqual(result.levels.map(x=>x[0]),want.levels);
 assert.equal(result.ma5,want.ma5);
 assert.equal(result.referenceDate,'2026-11-11');
 assert(result.levels[1][0]<result.levels[0][0]);
 assert(result.levels[2][0]<result.levels[3][0]);
 assert(!('riskLine' in result));
 assert(!('regime' in result));
 assert(!JSON.stringify(result).includes('cost'));
}
console.log('PASS: independent swing/ATR buy tiers and confirmed daily inputs for four stocks');
