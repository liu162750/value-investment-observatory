import {readFileSync,writeFileSync} from 'node:fs';
import {reviewTiers,POLICY} from './tier-policy.mjs';
import {stocks,distance} from '../worker/dashboard.js';
const input=process.argv[2];if(!input)throw Error('显式提供带前复权完整日线与来源的本次输入文件');
const data=JSON.parse(readFileSync(input,'utf8')),now=Date.now(),today=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Shanghai'});
if(data.asOf?.slice(0,10)!==today)throw Error('输入日期不是本次复核日期');
const snapshot=JSON.parse(readFileSync('worker/snapshot.json','utf8'));let source=readFileSync('worker/dashboard.js','utf8');
const result={policyId:POLICY,asOf:new Date(now).toISOString(),stocks:{}};
const future=Array.from({length:8},(_,i)=>new Date(now+(i+1)*86400000)).find(d=>[3,5].includes(new Date(d.getTime()+8*3600000).getUTCDay()));
const next=future.toLocaleDateString('sv-SE',{timeZone:'Asia/Shanghai'})+' 16:30';
for(const old of stocks){
 const a=data.stocks[old.symbol];if(!a?.source?.includes('qfq')||a.bars?.length<250)throw Error('缺少前复权输入与来源');
 const r=reviewTiers({bars:a.bars,now,oldLevels:old.levels,newSupportEvidence:a.newSupportEvidence});
 r.source=a.source;r.sourceQuoteTime=a.quote.time;r.nextScheduled=next;
 r.marketGate={...data.marketGate,asOf:a.dataDate};
 const activeBands=r.status==='adopted'?r.candidateBands.map(b=>({low:b.level[0],high:b.level[1],note:b.note})):old.levelReview?.bands||old.levels.map(v=>({low:v?.[0],high:v?.[1],note:'旧档参考'}));
 r.bands=activeBands;
 const sellReview={asOf:r.asOf,dataDate:r.dataDate,policy:POLICY,levels:r.levels.slice(2),status:r.status};
 const sellReference={price:r.referencePrice,asOf:r.referenceDate,source:'最近完整周前复权收盘基准，非持仓成本'};
 const marker=`{symbol:'${old.symbol}',`,start=source.indexOf(marker),end=source.indexOf('\n',start),original=source.slice(start,end),nameAt=original.indexOf('name:');
 let block=marker+`sellReview:${JSON.stringify(sellReview)},levelReview:${JSON.stringify(r)},sellReference:${JSON.stringify(sellReference)},`+original.slice(nameAt);
 block=block.slice(0,block.lastIndexOf('levels:'))+`levels:${JSON.stringify(r.levels)}},`;
 source=source.slice(0,start)+block+source.slice(end);
 const s=snapshot.stocks.find(s=>s.symbol===old.symbol);Object.assign(s,{levels:r.levels,levelReview:r,sellReview,sellReference,levelDate:r.referenceDate,levelType:'完整周收盘基准 · ATR20统一四档 · 技术触价非交易许可',distances:r.levels.map(v=>distance(s.quote.price,v))});
 result.stocks[old.symbol]=r;
}
source=source.replace("levelDate:s.levelReview?.dataDate||s.sellReview?.dataDate", "levelDate:s.levelReview?.referenceDate||s.levelReview?.dataDate||s.sellReview?.dataDate");
source=source.replace("levelType:'ATR20波动率与技术锚点复核；通道不是已确认支撑/压力；基本面估值待核验'","levelType:'完整周收盘基准 · ATR20统一四档 · 技术触价非交易许可'");
// Complete all calculations before writing any production file.
writeFileSync('worker/dashboard.js',source);writeFileSync('worker/snapshot.json',JSON.stringify(snapshot,null,2)+'\n');
writeFileSync('worker/tier-reviews.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(Object.fromEntries(Object.entries(result.stocks).map(([k,r])=>[k,{P:r.referencePrice,referenceDate:r.referenceDate,atr:r.atr20,stage:r.stage.name,status:r.status,levels:r.levels,candidate:r.candidateBands.map(b=>b.level)}])),null,2));
