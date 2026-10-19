export const POLICY='weekly-close-atr20-v1';
export const PARAMETERS={multipliers:[-1,-2.2,1.8,3.2],anchorWindow:.005,halfWidthPrice:.006,halfWidthATR:.15,minGapATR:.9975,minBuyEdge:.03,minSellEdge:.05,tick:.01,changeThreshold:.03};
const cent=x=>Math.round((x+Number.EPSILON)*100)/100;
const shift=(r,d)=>r.map(v=>cent(v+d));
const iso=d=>d.toISOString().slice(0,10);
export function completedWeekFriday(now){
 const local=new Date(now+8*3600000),day=local.getUTCDay(),minutes=local.getUTCHours()*60+local.getUTCMinutes();
 let back=(day-5+7)%7;if(day===5&&minutes<905)back=7;
 return iso(new Date(Date.UTC(local.getUTCFullYear(),local.getUTCMonth(),local.getUTCDate()-back)));
}
export function indicators(bars){
 if(bars.length<250)throw Error('至少250根前复权完整日线');
 for(let i=0;i<bars.length;i++){const r=bars[i];if(![r.open,r.high,r.low,r.close].every(x=>Number.isFinite(x)&&x>0)||r.low>Math.min(r.open,r.close)||r.high<Math.max(r.open,r.close)||(i&&r.date<=bars[i-1].date))throw Error('日线无效/乱序');}
 const trs=bars.slice(1).map((r,i)=>Math.max(r.high-r.low,Math.abs(r.high-bars[i].close),Math.abs(r.low-bars[i].close)));
 const atr=trs.slice(-20).reduce((s,x)=>s+x,0)/20;if(!(atr>0))throw Error('ATR20不可用');
 const mean=n=>bars.slice(-n).reduce((s,r)=>s+r.close,0)/n;
 return {atr,ma60:mean(60),ma120:mean(120),ma250:mean(250),h60:Math.max(...bars.slice(-60).map(r=>r.high)),l60:Math.min(...bars.slice(-60).map(r=>r.low)),h120:Math.max(...bars.slice(-120).map(r=>r.high)),l120:Math.min(...bars.slice(-120).map(r=>r.low))};
}
export function stageOf(bars,metrics){
 const p=bars.at(-1).close,r20=p/bars.at(-21).close-1,r60=p/bars.at(-61).close-1,prior17=bars.at(-4).close/bars.at(-21).close-1;
 return {name:(r20>=.10||r60>=.10)&&p>=metrics.ma60&&prior17>=.05?'rising':(r20<=-.10||r60<=-.15)&&p<metrics.ma60?'falling':'range',return20:r20,return60:r60,returnBeforeLast3:prior17};
}
export function anchorsOf(m){
 const pool=[['MA60',m.ma60,5],['MA120',m.ma120,6],['MA250',m.ma250,7],['近60日高点',m.h60,8],['近60日低点',m.l60,8],['近120日高点',m.h120,9],['近120日低点',m.l120,9]];
 for(const f of [.382,.5,.618,.786]){const weight=[.5,.618].includes(f)?7:6;pool.push([`Fib${f*100}%回撤`,m.h120-(m.h120-m.l120)*f,weight],[`Fib${f*100}%反弹`,m.l120+(m.h120-m.l120)*f,weight]);}
 return pool.map(([name,price,weight])=>({name,price,weight}));
}
export function validate(levels,{p,atr,buyEdge}){
 const errors=[];
 if(!levels||levels.length!==4||levels.some(r=>!r||r.length!==2||!r.every(Number.isFinite)||r[0]<=0||r[0]>=r[1]))return ['四档缺失/非正价/区间倒挂'];
 if(!(levels[1][1]<levels[0][0]&&levels[0][1]<p&&p<levels[2][0]&&levels[2][1]<levels[3][0]))errors.push('方向或交叉错误');
 if(levels[0][0]-levels[1][1]<atr*.9975-1e-8||levels[3][0]-levels[2][1]<atr*.9975-1e-8)errors.push('价格带净间距不足');
 if(levels[0][1]>p*(1-buyEdge)+1e-8)errors.push('买T1边沿过近');
 if(levels[2][0]<p*1.05-1e-8)errors.push('卖T1边沿过近');
 return errors;
}
export function reviewTiers({bars,now=Date.now(),oldLevels=null,newSupportEvidence=null}){
 const localDate=iso(new Date(now+8*3600000)),minute=+(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Shanghai',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(now)).replace(':',''));
 const done=bars.filter(r=>r.date<localDate||r.date===localDate&&minute>=1505);
 const m=indicators(done),stage=stageOf(done,m),friday=completedWeekFriday(now),monday=iso(new Date(Date.parse(friday+'T00:00:00Z')-4*86400000));
 const weekly=done.filter(r=>r.date>=monday&&r.date<=friday).at(-1);if(!weekly)throw Error('最近完整周无有效收盘，待核验');
 const p=weekly.close,atr=m.atr,halfWidth=Math.max(.006*p,.15*atr),pool=anchorsOf(m),buyEdge=stage.name==='rising'?Math.max(.03,1.5*atr/p):.03;
 const candidate=PARAMETERS.multipliers.map((mult,k)=>{
  const target=p+mult*atr;const eligible=pool.filter(a=>Math.abs(a.price/target-1)<=.005&&(k<2?a.price<p:a.price>p)).sort((a,b)=>b.weight-a.weight||Math.abs(a.price-target)-Math.abs(b.price-target));
  const anchor=eligible[0],center=anchor?.price??target;
  return {level:[cent(center-halfWidth),cent(center+halfWidth)],target,anchor:anchor||null,note:anchor?anchor.name:'ATR测算通道（非确认支撑/压力）'};
 });
 const levels=candidate.map(c=>c.level);
 const moveUntil=(k,condition,d)=>{for(let n=0;condition()&&n<20000;n++)levels[k]=shift(levels[k],d);if(condition())throw Error('校正未收敛');};
 moveUntil(0,()=>levels[0][1]>p*(1-buyEdge)+1e-8,-.01);
 moveUntil(2,()=>levels[2][0]<p*1.05-1e-8,.01);
 moveUntil(1,()=>levels[0][0]-levels[1][1]<atr*.9975-1e-8,-.01);
 moveUntil(3,()=>levels[3][0]-levels[2][1]<atr*.9975-1e-8,.01);
 const errors=validate(levels,{p,atr,buyEdge});if(errors.length)throw Error(errors.join(';'));
 for(let k=0;k<4;k++){candidate[k].level=levels[k];if(candidate[k].anchor&&(candidate[k].anchor.price<levels[k][0]||candidate[k].anchor.price>levels[k][1]))candidate[k].note='边沿/间距校正通道（原锚点已移出）';}
 const oldErrors=oldLevels?validate(oldLevels,{p,atr,buyEdge}):['无旧档'];
 const lowering=oldLevels&&levels.slice(0,2).some((r,i)=>oldLevels[i]&&(r[0]+r[1])<(oldLevels[i][0]+oldLevels[i][1])-.00001);
 const evidenceOK=typeof newSupportEvidence?.source==='string'&&/^https:\/\//.test(newSupportEvidence.source)&&!!newSupportEvidence.reason;
 const blocked=stage.name==='falling'&&lowering&&!evidenceOK;
 const small=oldLevels&&levels.every((r,i)=>oldLevels[i]&&Math.abs((r[0]+r[1])/(oldLevels[i][0]+oldLevels[i][1])-1)<=.03);
 const retain=blocked||small&&!oldErrors.length;
 return {policyId:POLICY,asOf:new Date(now).toISOString(),dataDate:done.at(-1).date,referenceDate:weekly.date,referenceWeekEnding:friday,referencePrice:p,atr20:atr,halfWidth,stage,parameters:PARAMETERS,buyEdge,candidateBands:candidate,levels:retain?oldLevels:levels,status:blocked?'pending-support':retain?'retained':'adopted',priceValidation:retain?oldErrors:[],newCandidateValidation:errors,reason:blocked?'下跌阶段无独立新支撑依据，保留整组旧档供历史参考；禁止据此买入':retain?'整组变动≤3%且旧组校验通过':'整组候选通过定价校验后替换',newSupportEvidence:evidenceOK?newSupportEvidence:null};
}
