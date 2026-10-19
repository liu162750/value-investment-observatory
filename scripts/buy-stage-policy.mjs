// Review-time only. Strategy thresholds, not predictive accuracy claims.
export function assessStage(bars,levels,atr){
 if(!Array.isArray(bars)||bars.length<61||!(atr>0))throw Error('趋势复核完整日线不足');
 const p=bars.at(-1).close,ret=n=>p/bars.at(-1-n).close-1;
 const r20=ret(20),r60=ret(60),r3=ret(3),prior17=bars.at(-4).close/bars.at(-21).close-1;
 const slice=bars.slice(-20),bottom=Math.min(...slice.map(r=>r.close)),age=19-slice.findIndex(r=>r.close===bottom);
 const ma60=bars.slice(-60).reduce((v,r)=>v+r.close,0)/60;
 const rising=(r20>=.10||r60>=.10)&&prior17>=.05&&age>=10&&p>=ma60;
 const falling=(r20<=-.10||r60<=-.15)&&p<ma60;
 const nearSell=!!levels[2]&&levels[2][0]-p<=Math.max(2*atr,.04*p);
 return {regime:rising?'sustained-rise':falling?'extended-decline':'mixed',return20:r20,return60:r60,return3:r3,returnBeforeLast3:prior17,bottomAge:age,ma60,nearSell,dataDate:bars.at(-1).date,policy:'20/60日累计≥10%且前17日已涨≥5%、低点距今≥10交易日、收盘≥MA60才认定明显上涨；两三日单独上涨不切换'};
}
export function guardBuyBands({bars,levels,atr,previousBuy,structuralBreakConfirmed=false,structuralSupportConfirmed=false}){
 const stage=assessStage(bars,levels,atr),p=bars.at(-1).close;
 const out=levels.map(r=>r&&[...r]);let minEdge=null,retained=false;
 if(stage.regime==='sustained-rise'){
  if(previousBuy&&!structuralSupportConfirmed&&out.slice(0,2).some((r,i)=>r&&previousBuy[i]&&(r[0]+r[1])/(previousBuy[i][0]+previousBuy[i][1])>1.03)){
   out[0]=[...previousBuy[0]];out[1]=[...previousBuy[1]];retained=true;
  }
  minEdge=Math.max(.04,1.5*atr/p);
  const step=p<10?.05:p<30?.1:p<100?.5:1;
  const shift=(r,d)=>r.map(v=>Math.round((v+d)*100)/100);
  for(let n=0;out[0]&&out[0][1]>p*(1-minEdge)+1e-8&&n<500;n++)out[0]=shift(out[0],-step);
  for(let n=0;out[1]&&out[0][0]-out[1][1]<atr*.9975-1e-8&&n<500;n++)out[1]=shift(out[1],-step);
  if(out[0]?.[1]>p*(1-minEdge)+1e-8)throw Error('上涨阶段买档距离校验失败');
 }
 if(stage.regime==='extended-decline'&&previousBuy&&!structuralBreakConfirmed){
  const chase=out.slice(0,2).some((r,i)=>r&&previousBuy[i]&&(r[0]+r[1])/(previousBuy[i][0]+previousBuy[i][1])<.97);
  if(chase){out[0]=[...previousBuy[0]];out[1]=[...previousBuy[1]];retained=true;}
 }
 if(out.slice(0,2).some(r=>!r||r[0]<=0||r[0]>=r[1])||out[0][0]-out[1][1]<atr*.9975-1e-8)throw Error('买档净间距/正价校验失败');
 return {levels:out,stage:{...stage,minT1Edge:minEdge,retainedPendingReview:retained,adoption:retained?'旧档优先并执行回撤约束，破位/新支撑待复核':'阶段校验通过；仅技术观察，不代表估值通过'}};
}
