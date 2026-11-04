import {readFileSync,writeFileSync} from 'node:fs';
import {priceReview,reviewDay,POLICY} from './mon-wed-policy.mjs';
import {stocks,distance} from '../worker/dashboard.js';
const input=process.argv[2];if(!input)throw Error('需要本次取得的完整前复权日线JSON');
if(process.argv.includes('--check-freeze'))throw Error('新规则不支持旧版冻结检查；请运行正式复核并核对周线许可');
const data=JSON.parse(readFileSync(input,'utf8')),now=Date.now(),today=new Date(now).toLocaleDateString('sv-SE',{timeZone:'Asia/Shanghai'});
if(data.asOf?.slice(0,10)!==today)throw Error('输入不是本次复核日期');
const snapshot=JSON.parse(readFileSync('worker/snapshot.json','utf8'));
const result={policyId:POLICY,asOf:new Date(now).toISOString(),stocks:{}};
for(const stock of stocks){
 const source=data.stocks?.[stock.symbol];
 if(!source?.source?.includes('qfq')||!Array.isArray(source.bars))throw Error(stock.symbol+'缺少前复权来源或日线');
 const review=priceReview(source.bars,now);review.source=source.source;
 if(reviewDay(now)===today&&source.quote?.time?.slice(0,10)===today&&review.referenceDate!==today)throw Error(stock.symbol+'当日完整日线尚未更新');
 result.stocks[stock.symbol]=review;
 const saved=snapshot.stocks.find(s=>s.symbol===stock.symbol);
 if(!saved)throw Error(stock.symbol+'快照缺失');
 saved.rows=source.bars.slice(-60);saved.levels=review.levels;saved.levelReview=review;
 saved.sellReview={asOf:review.asOf,dataDate:review.dataDate,policy:POLICY,levels:review.levels.slice(2),status:'adopted'};
 saved.sellReference={price:review.referencePrice,asOf:review.referenceDate,source:'最近复核日收盘基准，非持仓成本'};
 saved.levelDate=review.referenceDate;saved.levelType='周一/周三收盘基准 · ATR20限幅四档 · 技术触价非交易许可';
 saved.distances=review.levels.map(level=>distance(saved.quote?.price,level));
}
snapshot.date=today;snapshot.generated=new Date(now).toISOString();
writeFileSync('worker/snapshot.json',JSON.stringify(snapshot,null,2)+'\n');
writeFileSync('worker/tier-reviews.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(Object.fromEntries(Object.entries(result.stocks).map(([symbol,r])=>[symbol,{referenceDate:r.referenceDate,referencePrice:r.referencePrice,atr20:r.atr20,levels:r.levels,nextScheduled:r.nextScheduled}])),null,2));
