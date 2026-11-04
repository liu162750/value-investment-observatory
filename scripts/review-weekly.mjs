import {readFileSync,writeFileSync} from 'node:fs';
import {priceReview,reviewDay,weeklyMarketGate,POLICY} from './mon-wed-policy.mjs';
import {stocks,distance} from '../worker/dashboard.js';

const input=process.argv[2];
if(!input)throw Error('需要本次取得的完整前复权日线JSON');
if(process.argv.includes('--check-freeze'))throw Error('新规则不支持旧版冻结检查；请运行正式复核并核对周线许可');
const data=JSON.parse(readFileSync(input,'utf8'));
const now=Date.now(),today=new Date(now).toLocaleDateString('sv-SE',{timeZone:'Asia/Shanghai'});
if(data.asOf?.slice(0,10)!==today)throw Error('输入不是本次复核日期');
if(!data.previousReview||typeof data.previousReview!=='object')throw Error('缺少previousReview，拒绝无状态复核');
const snapshot=JSON.parse(readFileSync('worker/snapshot.json','utf8'));

const weeklyRows=data.market?.weekly?.rows;
if(!Array.isArray(weeklyRows))throw Error('缺少上证完整周线，市场周线状态待核验');
const weekly=weeklyMarketGate(weeklyRows,now);
if(weekly.status==='pending')throw Error('上证周线待核验：'+weekly.reason);
const monthly=data.market?.monthly;
if(!Array.isArray(monthly?.rows))throw Error('缺少上证月线，市场月线状态待核验');
const monthKey=today.slice(0,7);
const previousMonth=new Date(Date.UTC(Number(today.slice(0,4)),Number(today.slice(5,7))-2,1)).toISOString().slice(0,7);
const completedMonths=monthly.rows.filter(r=>Array.isArray(r)&&/^\d{4}-\d{2}-\d{2}$/.test(r[0])&&r[0].slice(0,7)<monthKey).slice(-20);
if(completedMonths.length!==20||completedMonths.some((r,i)=>!(Number(r[2])>0)||(i&&r[0]<=completedMonths[i-1][0]))||completedMonths.at(-1)[0].slice(0,7)!==previousMonth)throw Error('上证连续20个完整月线不足或过期');
const monthlyClose=Number(completedMonths.at(-1)[2]),monthlyMA20=completedMonths.reduce((sum,r)=>sum+Number(r[2]),0)/20;
const marketGate={policyId:'completed-month-ma20-v1',asOf:today,checkedAt:new Date(now).toISOString(),dataDate:completedMonths.at(-1)[0],lastCompleteMonth:completedMonths.at(-1)[0],monthCount:20,ma20month:monthlyMA20,indexClose:monthlyClose,frozen:!(monthlyClose>monthlyMA20),source:monthly.source,reason:monthlyClose>monthlyMA20?'最近完整月收盘高于20个完整月收盘均值':'最近完整月收盘未高于20个完整月收盘均值',weekly};

const result={policyId:POLICY,asOf:new Date(now).toISOString(),previousReviewAsOf:data.previousReview.asOf||null,marketGate,stocks:{}};
snapshot.marketGate=marketGate;
for(const stock of stocks){
 const source=data.stocks?.[stock.symbol];
 if(!source?.source?.includes('qfq')||!Array.isArray(source.bars))throw Error(stock.symbol+'缺少前复权来源或日线');
 if(source.bars.length<120)throw Error(stock.symbol+'前复权完整日线少于120根');
 const saved=snapshot.stocks.find(s=>s.symbol===stock.symbol);
 if(!saved)throw Error(stock.symbol+'快照缺失');
 const prior=data.previousReview.stocks?.[stock.symbol]||saved.levelReview||null;
 const review=priceReview(source.bars,now,{symbol:stock.symbol,previous:prior,legacyA:stock.symbol==='sh600312'?{date:'2026-11-04',low:18.60}:null});
 review.source=source.source;
 review.marketGate=marketGate;
 if(reviewDay(now)===today&&source.quote?.time?.slice(0,10)===today&&review.referenceDate!==today)throw Error(stock.symbol+'当日完整日线尚未更新');
 result.stocks[stock.symbol]=review;
 saved.rows=source.bars.slice(-250);
 saved.levels=review.levels;
 saved.levelReview=review;
 saved.quote=source.quote;
 saved.price=source.quote?.price??saved.price;
 saved.sellReview={asOf:review.asOf,dataDate:review.referenceDate,policy:POLICY,levels:review.levels.slice(2),status:'adopted'};
 saved.sellReference={price:review.referencePrice,asOf:review.referenceDate,source:'最近复核日收盘基准，非持仓成本'};
 saved.levelDate=review.referenceDate;
 saved.levelType='上升趋势回踩 / 下降趋势收盘企稳 · 周一/周三复核 · 触价不等于成交';
 saved.distances=review.levels.map(level=>distance(saved.quote?.price,level));
}
snapshot.date=today;
snapshot.generated=new Date(now).toISOString();
writeFileSync('worker/snapshot.json',JSON.stringify(snapshot,null,2)+'\n');
writeFileSync('worker/tier-reviews.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({policyId:POLICY,asOf:result.asOf,previousReviewAsOf:result.previousReviewAsOf,marketGate,stocks:Object.fromEntries(Object.entries(result.stocks).map(([symbol,r])=>[symbol,{trend:r.trend,referenceDate:r.referenceDate,referencePrice:r.referencePrice,ma5:r.ma5,ma20:r.ma20,ma60:r.ma60,lowAnchor:r.lowAnchor,levels:r.levels,nextScheduled:r.nextScheduled}]))},null,2));
