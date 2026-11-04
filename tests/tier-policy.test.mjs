import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {priceReview,POLICY} from '../scripts/mon-wed-policy.mjs';

const snapshot=JSON.parse(readFileSync(new URL('../worker/snapshot.json',import.meta.url),'utf8'));
const reviews=JSON.parse(readFileSync(new URL('../worker/tier-reviews.json',import.meta.url),'utf8'));
assert.equal(POLICY,'fixed-high-250-buy-v1');
assert.equal(snapshot.date,'2026-11-04');
for(const saved of snapshot.stocks){
 const review=reviews.stocks[saved.symbol];
 assert.equal(review.policyId,POLICY);
 assert.equal(saved.levelReview.policyId,POLICY);
 assert.equal(review.referenceDate,'2026-11-04');
 assert.equal(review.dataDate,'2026-11-04');
 assert.deepEqual(saved.levels,review.levels);
 assert.equal(review.levels[0][0],Math.round(review.buyAnchorHigh*.70*100)/100);
 assert.equal(review.levels[1][0],Math.round(review.buyAnchorHigh*.50*100)/100);
 assert(review.levels[2][0]>review.referencePrice);
 assert(review.levels[2][1]<review.levels[3][0]);
 assert(review.nextScheduled.endsWith('16:30'));
 assert(review.source.includes('qfq'));
}
assert.equal(snapshot.marketGate.monthCount,20);
assert.equal(snapshot.marketGate.dataDate,'2026-10-30');
assert.equal(snapshot.marketGate.frozen,true);
assert.equal(snapshot.marketGate.weekly.status,'weak');

const bars=[];
for(let day=new Date('2025-11-05T00:00:00Z');bars.length<260;day.setUTCDate(day.getUTCDate()+1))if(day.getUTCDay()!==0&&day.getUTCDay()!==6)bars.push({date:day.toISOString().slice(0,10),open:100,high:102,low:98,close:100});
bars.at(-1).date='2026-11-04';
const now=Date.parse('2026-11-04T20:30:00+08:00');
const first=priceReview(bars,now);
assert.equal(first.buyAnchorHigh,102);
assert.deepEqual(first.levels.slice(0,2),[[71.4,71.4],[51,51]]);
const anchored=priceReview([...bars,{date:'2026-11-05',open:100,high:103,low:99,close:101}],Date.parse('2026-11-05T20:30:00+08:00'),{policyId:POLICY,buyAnchorHigh:102,buyAnchorDate:'2026-11-04'});
assert.equal(anchored.buyAnchorHigh,103,'The saved fixed high only rises on a later new high');
assert.equal(anchored.buyAnchorDate,'2026-11-05');
const noNewHigh=priceReview(bars,now,{policyId:POLICY,buyAnchorHigh:110,buyAnchorDate:'2026-11-03'});
assert.equal(noNewHigh.buyAnchorHigh,110,'The fixed high must not roll down');
assert.throws(()=>priceReview(bars.slice(-249),now),/250/);
console.log('PASS: fixed-high buy tiers, Mon/Wed ATR20 sell review, previous-review anchoring, 250-bar gate and separate market gates');
