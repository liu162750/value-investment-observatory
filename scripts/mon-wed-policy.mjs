export const POLICY='mon-wed-close-atr20-v1';
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
  if((w===1||w===3)&&(n>0||minute<905))return d.toISOString().slice(0,10)+' 15:05';
 }
 throw Error('下次复核日计算失败');
}
export function priceReview(rows,now=Date.now()){
 const cutoff=reviewDay(now),bars=rows.filter(b=>b.date<=cutoff&&b.date<=dateOf(now));
 if(bars.length<21)throw Error('完整前复权日线不足21根');
 if(bars.some((b,i)=>![b.open,b.high,b.low,b.close].every(n=>Number.isFinite(n)&&n>0)||b.low>Math.min(b.open,b.close)||b.high<Math.max(b.open,b.close)||(i&&b.date<=bars[i-1].date)))throw Error('日线无效或乱序');
 const recent=bars.slice(-21),last=recent.at(-1);
 if(Date.parse(cutoff+'T00:00:00Z')-Date.parse(last.date+'T00:00:00Z')>4*dayMs)throw Error('复核基准日行情过期');
 const atr=recent.slice(1).reduce((sum,b,i)=>sum+Math.max(b.high-b.low,Math.abs(b.high-recent[i].close),Math.abs(b.low-recent[i].close)),0)/20;
 if(!(atr>0))throw Error('ATR20无效');
 const p=last.close,ar=atr/p;
 let buy1=p*(1-clamp(ar,.03,.08)),buy2=p*(1-clamp(1.8*ar,.07,.18));
 let sell1=p*(1+clamp(1.8*ar,.06,.12)),sell2=p*(1+clamp(3.2*ar,.10,.26));
 if(buy2>=buy1)buy2=buy1*.98;
 if(sell2<=sell1)sell2=sell1*1.03;
 const levels=[[cents(buy1-.3*atr),cents(buy1)],[cents(buy2-.3*atr),cents(buy2)],[cents(sell1),cents(sell1+.3*atr)],[cents(sell2),cents(sell2+.3*atr)]];
 if(levels.some(b=>b[0]<=0||b[0]>b[1])||levels[1][1]>=levels[0][0]||levels[0][1]>=p||levels[2][0]<=p||levels[2][1]>=levels[3][0])throw Error('四档价格带交叉，待人工复核');
 return {policyId:POLICY,asOf:new Date(now).toISOString(),dataDate:last.date,referenceDate:last.date,referencePrice:p,atr20:atr,levels,bands:levels.map((b,i)=>({low:b[0],high:b[1],note:i<2?'复核价减ATR20，幅度限幅':'复核价加ATR20，幅度限幅'})),status:'adopted',priceValidation:[],nextScheduled:nextReviewDay(now),source:'腾讯财经前复权日线',reason:'周一/周三最近已完成收盘基准；技术测算，不代表估值或交易许可'};
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
 return {policyId:'weekly-ma10-ma20-three-state-v1',status,passed:status!=='weak',asOf:today,checkedAt:new Date(now).toISOString(),dataDate:rows.at(-1)[0],indexClose:close,ma10,ma20,maxTotalWeight:{strong:.85,improving:.70,weak:.60}[status],maxSingleWeight:{strong:.25,improving:.21,weak:.18}[status],allowedBuyTiers:status==='strong'?[0,1]:status==='improving'?[0]:[],source:'https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=sh000001,week,,,40,qfq'};
}
