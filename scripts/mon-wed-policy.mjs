export const POLICY='ma60-trend-final-20261104';
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
export function priceReview(rows,now=Date.now(),options={}){
 const today=dateOf(now),local=new Date(now+8*3600000),minute=local.getUTCHours()*60+local.getUTCMinutes(),cutoff=reviewDay(now);
 const daily=rows.filter(b=>b.date<today||minute>=905&&b.date<=today),bars=daily.filter(b=>b.date<=cutoff);
 if(bars.length<120)throw Error('完整前复权日线不足120根');
 if(daily.some((b,i)=>![b.open,b.high,b.low,b.close].every(n=>Number.isFinite(n)&&n>0)||b.low>Math.min(b.open,b.close)||b.high<Math.max(b.open,b.close)||(i&&b.date<=daily[i-1].date)))throw Error('日线无效或乱序');
 const recent=bars.slice(-21),last=recent.at(-1);
 if(Date.parse(cutoff+'T00:00:00Z')-Date.parse(last.date+'T00:00:00Z')>4*dayMs)throw Error('复核基准日行情过期');
 const atr=recent.slice(1).reduce((sum,b,i)=>sum+Math.max(b.high-b.low,Math.abs(b.high-recent[i].close),Math.abs(b.low-recent[i].close)),0)/20;
 if(!(atr>0))throw Error('ATR20无效');
 const p=last.close,average=n=>bars.slice(-n).reduce((sum,b)=>sum+b.close,0)/n;
 const ma5=average(5),ma20=average(20),ma60=average(60);
 const trend=p>ma60?'上升趋势':p<ma60?'下降趋势':null;
 if(!trend)throw Error('复盘收盘价等于MA60，趋势分叉待核验');
 const prior=options?.previous?.policyId===POLICY&&options.previous.trend===trend?options.previous:null;
 let lowAnchor=null,anchorDate=null;
 if(trend==='上升趋势'){
  const legacy=options?.legacyA;
  lowAnchor=prior?.lowAnchor??(legacy?.date&&legacy.date<=last.date?legacy.low:null)??Math.min(...bars.slice(-60).map(b=>b.low));
  anchorDate=prior?.anchorDate??(legacy?.date&&legacy.date<=last.date?legacy.date:last.date);
  for(const bar of bars.filter(b=>b.date>anchorDate))if(bar.low<lowAnchor)lowAnchor=bar.low;
  if(bars.at(-1).date>anchorDate)anchorDate=bars.at(-1).date;
 }
 const low60=Math.min(...bars.slice(-60).map(b=>b.low));
 const buy2=trend==='上升趋势'?lowAnchor:Math.max(low60,p*.97);
 const buy1=trend==='上升趋势'?lowAnchor*1.05:cents(buy2)*1.03;
 const high20=Math.max(...bars.slice(-20).map(b=>b.high));
 const sell1=trend==='上升趋势'&&options.symbol==='sh600312'?high20:ma20;
 const sell2=trend==='上升趋势'&&options.symbol==='sh600312'?cents(sell1)*1.05:ma60;
 const levels=[buy1,buy2,sell1,sell2].map(value=>[cents(value),cents(value)]);
 if(levels.some(b=>b[0]<=0)||levels[1][0]>=levels[0][0]||levels[0][0]>=levels[2][0]||levels[2][0]>=levels[3][0]||(trend==='上升趋势'&&levels[0][0]>=p))throw Error('最终定稿四档顺序不成立，停止展示');
 const previousClose=bars.at(-2).close;
 const possibleLimitUp=options.symbol&&/^(sh60|sz00)/.test(options.symbol)&&p/previousClose-1>=.099;
 const nextComplete=daily.find(b=>b.date>last.date);
 const limitUpConfirmation=possibleLimitUp?(nextComplete?{status:nextComplete.close>=p*.97?'passed':'failed',date:nextComplete.date,close:nextComplete.close}: {status:'pending',date:null,close:null}):null;
 const latestClose=daily.at(-1).close,latestMA5=daily.slice(-5).reduce((sum,b)=>sum+b.close,0)/5;
 return {policyId:POLICY,asOf:new Date(now).toISOString(),dataDate:daily.at(-1).date,referenceDate:last.date,referencePrice:p,atr20:atr,trend,ma5:cents(ma5),ma20:cents(ma20),ma60:cents(ma60),signalDate:daily.at(-1).date,signalClose:latestClose,signalMA5:cents(latestMA5),low60:cents(low60),lowAnchor:lowAnchor===null?null:cents(lowAnchor),anchorDate,high20:cents(high20),possibleLimitUp:Boolean(possibleLimitUp),limitUpConfirmation,levels,bands:levels.map((b,i)=>({low:b[0],high:b[1],note:i<2?trend==='上升趋势'?'确认前低计算':'近60日低点与复盘收盘计算':i===2?options.symbol==='sh600312'&&trend==='上升趋势'?'近20日最高价':'MA20':options.symbol==='sh600312'&&trend==='上升趋势'?'平高确认档':'MA60'})),status:'adopted',nextScheduled:nextReviewDay(now),source:'腾讯财经前复权日线',reason:'复盘收盘与MA60比较；下降趋势买①需完整收盘站上MA5，涨停次日复核；价格条件不等于成交或账户许可'};
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
