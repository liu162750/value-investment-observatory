import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseGoldQuote,parseGoldAlternative,goldReferenceClose,goldDashboard} from '../worker/dashboard.js';
const now=Date.parse('2026-10-08T10:05:00+08:00');
const quote=JSON.parse(readFileSync(new URL('./fixtures/gold-quote.json',import.meta.url),'utf8'));
const actual=parseGoldQuote(quote,now);
assert.equal(actual.price,893.4);
assert.equal(actual.time,'2026-10-08 10:00:00');
assert.notEqual(actual.price,+quote.data.at(-1),'Future placeholders must be excluded');
assert.throws(()=>parseGoldQuote({...quote,heyue:'Au(T+D)'},now));
assert.throws(()=>parseGoldQuote({...quote,delaystr:'2026年10月09日 10:00:59'},now));
assert.throws(()=>parseGoldQuote({...quote,data:[]},now));
const night={heyue:'Au99.99',delaystr:'2026年10月08日 21:01:00',times:['20:00','21:00','00:00','09:00'],data:[910,920,999,999]};
assert.equal(parseGoldQuote(night,Date.parse('2026-10-08T22:00:00+08:00')).price,920);
assert.equal(parseGoldQuote({...night,delaystr:'2026年10月09日 00:01:00'},Date.parse('2026-10-09T00:05:00+08:00')).price,999);
// Exercise the complete dashboard path with public fixed responses, no network.
const daily=JSON.parse(readFileSync(new URL('./fixtures/daily-audit.json',import.meta.url),'utf8')).gold;
const originalFetch=globalThis.fetch,originalNow=Date.now;
try{
 Date.now=()=>now;
 globalThis.fetch=async url=>new Response(JSON.stringify(String(url).includes('quotations')?quote:daily),{headers:{'content-type':'application/json'}});
 const gold=await goldDashboard();
 assert.equal(gold.price,893.4);assert.equal(gold.levelDate,'2026-09-30');assert.equal(gold.dailyClose,907.32);
 assert.equal(gold.distances[0].pct,gold.distances[0].delta/893.4*100);
 Date.now=()=>now+121000;
 globalThis.fetch=async()=>{throw Error('Unavailable');};
 const fallback=await goldDashboard();assert.equal(fallback.quoteError,true);assert(fallback.session.includes('更新失败'));assert.equal(fallback.price,893.4);assert(fallback.change<0,'Do not replace current decline with old daily gain');
}finally{globalThis.fetch=originalFetch;Date.now=originalNow;}
console.log('PASS: gold current quote, future placeholders, night date rollover, separate daily tiers and explicit fallback');

const alt=JSON.parse(readFileSync(new URL('./fixtures/gold-alternative.json',import.meta.url),'utf8'));const alternate=parseGoldAlternative(alt,Date.parse('2026-10-08T11:00:30+08:00'));assert.equal(alternate.price,893.5);assert.equal(alternate.time,'2026-10-08 11:00:00');assert.equal(alternate.previousClose,907.32);assert.throws(()=>parseGoldAlternative({...alt,data:{...alt.data,code:'AUTD'}},now));

const dayModel={rows:[{date:'2026-09-30',close:907.32},{date:'2026-10-08',close:893.5}]};assert.equal(goldReferenceClose(dayModel,{time:'2026-10-08 16:05:00'}),907.32);assert.equal(goldReferenceClose(dayModel,{time:'2026-10-08 21:00:00'}),893.5);assert.equal(goldReferenceClose(dayModel,{time:'2026-10-08 10:00:00',previousClose:910}),910);
