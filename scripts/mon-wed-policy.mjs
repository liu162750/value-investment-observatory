export const POLICY='fixed-high-250-buy-v1';
const dayMs=86400000;
const dateOf=now=>new Date(now+8*3600000).toISOString().slice(0,10);
const cents=n=>Math.round((n+Number.EPSILON)*100)/100;
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));

export function reviewDay(now=Date.now()){
 const local=new Date(now+8*3600000),weekday=local.getUTCDay(),minute=local.getUTCHours()*60+local.getUTCMinutes();
 const today=dateOf(now);let back=0;
 if(weekday===0)back=4;else if(weekday===1)back=minute>=905?0:5;
 else if(weekday===2)back=1;else if(weekday===3)back=minute>=905?0:2;
 else back=weekday-3;
 return new Date(Date.parse(today+'T00:00:00Z')-back*dayMs).toISOString().slice(0,10);
}
export function nextReviewDay(now=Date.now()){
 const local=new Date(now+8*3600000),today=dateOf(now),minute=local.getUTCHours()*60+local.getUTCMinutes();
 for(let n=0;n<8;n++){
  const d=new Date(Date.parse(today+'T00:00:00Z')+n*dayMs),w=d.getUTCDay();
  if((w===1||w===3)&&(n>0||minute<990))return d.toISOString().slice(0,10)+' 16:30';
 }
 throw Error('下次复核日计算失败');
}
export function priceReview(rows,now=Date.now(),anchor=null){
 const today=dateOf(now),local=new Date(now+8*3600000),minute=local.getUTCHours()*60+local.getUTCMinutes(),cutoff=reviewDay(now);
 const daily=rows.filter(b=>b.date<today||minute>=905&&b.date<=today),bars=daily.filter(b=>b.date<=cutoff);
 if(bars.length<250)throw Error('完整前复权日线不足250根');
 if(daily.some((b,i)=>![b.open,b.high,b.low,b.close].every(n=>Number.isFinite(n)&&n>0)||b.low>Math.min(b.open,b.close)||b.high<Math.max(b.open,b.close)||(i&&b.date<=daily[i-1].date)))throw Error('日线无效或乱序');
 const recent=bars.slice(-21),last=recent.at(-1);
 if(Date.parse(cutoff+'T00:00:00Z')-Date.parse(last.date+'T00:00:00Z')>4*dayMs)throw Error('复核基准日行情过期');
 const atr=recent.slice(1).reduce((sum,b,i)=>sum+Math.max(b.high-b.low,Math.abs(b.high-recent[i].close),Math.abs(b.low-recent[i].close)),0)/20;
 if(!(atr>0))throw Error('ATR20无效');
 const p=last.close,ar=atr/p;
 const anchored=anchor?.policyId===POLICY||Number.isFinite(anchor?.high);
 const anchorDate=anchor?.buyAnchorDate||anchor?.date||null;
 let high=anchored?(anchor.buyAnchorHigh??anchor.high):Math.max(...daily.slice(-250).map(b=>b.high));
 let highDate=anchored?anchorDate:null;
 if(!(high>0))throw Error('250日固定高点无法核验');
 if(!highDate)highDate=daily.slice(-250).filter(b=>b.high===high).at(-1)?.date||last.date;
 for(const bar of daily.filter(b=>b.date>(anchored?anchorDate||'':cutoff))){if(bar.high>high){high=bar.high;highDate=bar.date;}}
 if(anchored&&anchorDate&&daily.at(-1).date<anchorDate)throw Error('固定高点锚点日期晚于日线');
 const buy1=high*.70,buy2=high*.50;
 let sell1=p*(1+clamp(1.8*ar,.06,.12)),sell2=p*(1+clamp(3.2*ar,.10,.26));
 if(sell2<=sell1)sell2=sell1*1.03;
 const levels=[[cents(buy1),cents(buy1)],[cents(buy2),cents(buy2)],[cents(sell1),cents(sell1+.3*atr)],[cents(sell2),cents(sell2+.3*atr)]];
 if(levels.some(b=>b[0]<=0||b[0]>b[1])||levels[1][1]>=levels[0][0]||levels[2][0]<=p||levels[2][1]>=levels[3][0])throw Error('四档价格校验失败，待人工复核');
 return {policyId:POLICY,asOf:new Date(now).toISOString(),dataDate:daily.at(-1).date,referenceDate:last.date,referencePrice:p,atr20:atr,buyAnchorHigh:high,buyAnchorDate:highDate,levels,bands:levels.map((b,i)=>({low:b[0],high:b[1],note:i===0?'250日高点×70%':i===1?'250日高点×50%；另需完整周线转强或强势':'复核价加ATR20，幅度限幅'})),status:'adopted',priceValidation:[],nextScheduled:nextReviewDay(now),source:'腾讯财经前复权日线',reason:'买①/买②锚定固定250日高点×70%/50%；新高只上移锚点，买②另需完整周线转强或强势；卖档按周一/周三复核，技术触价非交易许可'};
}
export function weeklyMarketGate(raw,now=Date.now()){
 const today=dateOf(now),local=new Date(now+8*3600000),weekday=local.getUTCDay();
 const monday=new Date(Date.parse(today+'T00:00:00Z')-((weekday+6)%7)*dayMs).toISOString().slice(0,10);
 const complete=weekday===6||weekday===0||weekday===5&&local.getUTCHours()*60+local.getUTCMinutes()>=905;
 const rows=(raw||[]).filter(r=>Array.isArray(r)&&/^\d{4}-\d{2}-\d{2}$/.test(r[0])&&r[0]<=today&&(complete||r[0]<monday)).slice(-20);
 const pending=reason=>({policyId:'weekly-ma10-ma20-three-state-v1',status:'pending',passed:null,asOf:today,checkedAt:new Date(now).toISOString(),reason});
 if(rows.length<20||rows.some((r,i)=>!(Number(r[2])>0)||(i&&r[0]<=rows[i-1][0])))return pending('完整周线不足20根或数据无效');
 const expected=new Date(Date.parse(monday+'T00:00:00Z')-(complete?0:7)*dayMs).toISOString().slice(0,10);
 if(rows.at(-1)[0]<expected)return pending('最新完整周线未齐');
 const close=Number(rows.at(-1)[2]),ma10=rows.slice(-10).reduce((s,r)=>s+Number(r[2]),0)/10,ma20=rows.reduce((s,r)=>s+Number(r[2]),0)/20;
 const status=close>ma10?'strong':close>ma20?'improving':'weak';
 return {policyId:'weekly-ma10-ma20-three-state-v1',status,passed:status!=='weak',asOf:today,checkedAt:new Date(now).toISOString(),dataDate:rows.at(-1)[0],indexClose:close,ma10,ma20,maxTotalWeight:{strong:.85,improving:.70,weak:.60}[status],maxSingleWeight:{strong:.25,improving:.21,weak:.18}[status],allowedBuyTiers:status==='weak'?[0]:[0,1],source:'https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=sh000001,week,,,40,qfq'};
}
