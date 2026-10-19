import {readFileSync,writeFileSync} from 'node:fs';
import {stocks,distance,technical} from '../worker/dashboard.js';
import {guardBuyBands} from './buy-stage-policy.mjs';
if(!process.argv[2])throw Error('请显式提供本次已核验的公开行情复核文件，不能默认复用历史样本');
const audit=JSON.parse(readFileSync(process.argv[2],'utf8'));
const today=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Shanghai'});
if(audit.asOf?.slice(0,10)!==today)throw Error('拒绝发布旧日期的复核文件');
const snapshot=JSON.parse(readFileSync('worker/snapshot.json','utf8'));
let src=readFileSync('worker/dashboard.js','utf8');
for(const old of stocks){
 const a=audit.stocks[old.symbol];if(!a?.ok)throw Error('Invalid audit');
 const rawLevels=[...a.buy,...a.sell].map(t=>[t.low,t.high]);
 const guarded=guardBuyBands({bars:a.bars,levels:rawLevels,atr:a.atr,previousBuy:old.levels.slice(0,2),structuralBreakConfirmed:a.structuralBreakConfirmed===true&&!!a.structuralBreakSource,structuralSupportConfirmed:a.structuralSupportConfirmed===true&&!!a.structuralSupportSource});
 const levels=guarded.levels;
 for(let k=0;k<2;k++)if(JSON.stringify(levels[k])!==JSON.stringify(rawLevels[k])){a.buy[k]={...a.buy[k],low:levels[k][0],high:levels[k][1],originalNote:a.buy[k].note,note:guarded.stage.retainedPendingReview?'旧档保留 · 新支撑待复核':'上涨阶段回撤约束通道（非已确认支撑）',edgePct:Math.round((levels[k][1]/a.quote.price-1)*10000)/100};}
 const moved=audit.userRequestedBuyAdjustment===true||levels.some((r,i)=>!old.levels[i]||Math.abs((r[0]+r[1])/(old.levels[i][0]+old.levels[i][1])-1)>.03);
 const adopted=moved?levels:old.levels;
 const review={policyId:'ATR20-handoff-v1',asOf:audit.asOf,dataDate:a.dataDate,nextScheduled:'2026-10-21 16:30',atr20:a.atr,count:a.count,policy:'ATR20×1.0/2.2买档、×1.8/3.2卖档；技术锚点吸附；价格带净间距≥0.9975ATR20；非估值结论',bands:[...a.buy,...a.sell],marketGate:{...audit.marketGate,asOf:a.dataDate},changed:moved,changeRule:'任一档中心变动>3%或补缺档时，整组通过校验后发布；否则保留原组'};
 if(audit.userRequestedBuyAdjustment){review.buyParameters=audit.buyParameters;review.frozenBuyReference=a.quote.price;review.previousBuy=a.previousBuy;review.policy='买档0.5/1.25ATR20人工复核上调；净间距≥0.9975ATR20；卖档保留；非估值结论';}
 if(a.buyModel==='low-vol-anchor-v1'){review.buyParameters={...audit.lowVolatilityCorrection,clamps:[[.03,.08],[.07,.20]],absorbWin:.025};review.policy='低波动股锚点复核；买T1上沿距参考价至少3%且1ATR20；两买档净间距≥0.9975ATR20；卖档保留';review.supersededNearBuy=a.supersededNearBuy;}
 review.stageReview=guarded.stage;
 if(!moved&&old.levelReview?.bands)review.bands=old.levelReview.bands;
 const sellReview=audit.userRequestedBuyAdjustment?old.sellReview:{asOf:audit.asOf,dataDate:a.dataDate,policy:review.policy,levels:adopted.slice(2)};
 const sellReference={price:a.quote.price,asOf:audit.asOf,source:'腾讯财经当日收盘复核基准，非持仓成本'};
 const marker=`{symbol:'${old.symbol}',`,start=src.indexOf(marker),end=src.indexOf('\n',start);
 let block=src.slice(start,end);
 const name=block.indexOf('name:');if(name<0)throw Error('Stock block format');
 block=marker+`sellReview:${JSON.stringify(sellReview)},levelReview:${JSON.stringify(review)},sellReference:${JSON.stringify(sellReference)},`+block.slice(name);
 const p=block.lastIndexOf('levels:');block=block.slice(0,p)+`levels:${JSON.stringify(adopted)}},`;
 src=src.slice(0,start)+block+src.slice(end);
 const s=snapshot.stocks.find(x=>x.symbol===old.symbol);
 Object.assign(s,{levels:adopted,levelReview:review,sellReview,sellReference,rows:a.bars,quote:{...a.quote,time:a.quote.time.slice(0,19)},tech:technical(a.bars),levelDate:a.dataDate,levelType:'ATR20波动率与技术锚点复核；通道不是已确认支撑/压力；基本面估值待核验',distances:adopted.map(r=>distance(a.quote.price,r))});
}
src=src.replace("levelType:'买卖档已按周复核 · 缺少可靠支撑或压力时留空 · 触价仍须估值与走势确认'","levelType:'ATR20波动率与技术锚点复核；通道不是已确认支撑/压力；基本面估值待核验'");
writeFileSync('worker/dashboard.js',src);
writeFileSync('worker/snapshot.json',JSON.stringify(snapshot,null,2)+'\n');
writeFileSync(process.argv[2],JSON.stringify(audit,null,2)+'\n');
