const accounts = [];
const initialSnapshot = null;
const stocks=[
{symbol:'sh600312',sellReference:{price:20.4,asOf:'2026-10-08 11:36',source:'腾讯财经 · 本次固定复核基准，非持仓成本'},name:'平高电气',theme:'电网设备',reason:"扣非盈利改善，但收入下降、经营现金流为负，回款需观察。",logic:'中 · 回款需观察',thesis:'电网建设与特高压订单，关注交付和回款。',evidence:'2026半年报收入−5.64%、扣非利润+20.76%，经营现金流−6.89亿元。盈利改善，收入和现金回款仍需观察。',report:'https://static.cninfo.com.cn/finalpage/2026-08-20/1225483266.PDF',levels:[[19.1,19.4],[18.45,18.75],[20.55,20.85],[21.4,21.7]]},
{symbol:'sz002156',sellReference:{price:56.52,asOf:'2026-10-08 11:36',source:'腾讯财经 · 本次固定复核基准，非持仓成本'},name:'通富微电',theme:'先进封装',reason:"扣非盈利增长，但非经常收益占净利过半，持续性需观察。",logic:'中 · 盈利持续性需观察',thesis:'先进封装与核心客户需求，关注产能利用率、扣非盈利、资本开支和负债。',evidence:'2026半年报收入+23.03%、扣非利润+77.78%，经营现金流29.33亿元、同比+18.25%；非经常收益占净利过半。',report:'https://disc.static.szse.cn/download/disc/disk03/finalpage/2026-08-29/072fbc43-caef-4b31-bf0e-ee19d9fa0459.PDF',levels:[[55.5,57.1],[50.5,52],[59.7,61.3],[65.1,66.7]]},
{symbol:'sh601138',sellReference:{price:56.81,asOf:'2026-10-08 11:36',source:'腾讯财经 · 本次固定复核基准，非持仓成本'},name:'工业富联',theme:'AI服务器',reason:"收入与扣非盈利高增长，经营现金流为正，需求持续性仍需跟踪。",logic:'高 · 经营证据支持',thesis:'AI服务器需求和云服务商客户份额，关注需求持续性、毛利率、库存和回款。',evidence:'2026半年报收入+54.63%、扣非利润+96.99%，经营现金流73.91亿元。增长有经营证据；正常化盈利与合理估值仍待核验。',report:'https://static.cninfo.com.cn/finalpage/2026-08-12/1225468066.PDF',levels:[[57.3,58.4],[53.8,55],[59.8,61],[64.4,65.5]]},
{symbol:'sz002463',sellReference:{price:118.08,asOf:'2026-10-08 11:36',source:'腾讯财经 · 本次固定复核基准，非持仓成本'},name:'沪电股份',theme:'高端PCB',reason:"收入与扣非盈利增长较强，但经营现金流下降，扩产与回款需观察。",logic:'中 · 现金流需观察',thesis:'高速交换机与高性能计算驱动高端PCB需求，关注产品结构、良率、海外扩产。',evidence:'2026半年报收入+61.17%、扣非利润+70.00%，经营现金流11.51亿元、同比−45.14%。增长较强，采购占款与扩产需要跟踪。',report:'https://disc.static.szse.cn/disc/disk03/finalpage/2026-08-26/510ef2bf-102c-47af-aab9-ec715b88b306.PDF',levels:[[110.7,113.8],[102.6,105.8],[118.6,121.8],[128.4,131.5]]}
];
const indices=['sh000001','sz399001','sz399006','sh000688'];
const investmentReviews = "__REVIEWS__";
const eventCalendar = "__EVENTS__";
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
async function get(url,encoding){let last;for(let attempt=0;attempt<2;attempt++){try{const r=await fetch(url,{signal:AbortSignal.timeout(8000),headers:{'User-Agent':'Mozilla/5.0'}});if(!r.ok)throw Error('来源HTTP '+r.status);if(!encoding)return await r.json();const bytes=await r.arrayBuffer();return new TextDecoder(encoding).decode(bytes);}catch(error){last=error;if(attempt===0)await new Promise(resolve=>setTimeout(resolve,250));}}throw last;}
function parseQuotes(raw){const out={};for(const m of raw.matchAll(/v_([a-z0-9]+)="([^"]*)"/g)){const p=m[2].split('~'),t=p[30];if(p.length>32&&+p[3]>0)out[m[1]]={price:+p[3],change:+p[32],time:/^\d{14}$/.test(t)?t.slice(0,4)+'-'+t.slice(4,6)+'-'+t.slice(6,8)+' '+t.slice(8,10)+':'+t.slice(10,12)+':'+t.slice(12,14):null,source:'腾讯财经'};}return out;}
function completedDailyRows(rows,now=Date.now(),closeMinute=905){
 const date=new Date(now).toLocaleDateString('sv-SE',{timeZone:'Asia/Shanghai'});
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Shanghai',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(now));
 const hour=+parts.find(x=>x.type==='hour').value,minute=+parts.find(x=>x.type==='minute').value;
 return rows.filter(r=>r.date<date||(r.date===date&&hour*60+minute>=closeMinute));
}
const historyCache=new Map(),historyPending=new Map();
async function history(symbol){
 const cached=historyCache.get(symbol);if(cached&&Date.now()-cached.checked<300000)return completedDailyRows(cached.rows);
 if(historyPending.has(symbol))return historyPending.get(symbol);
 const task=(async()=>{try{
  let d;try{d=await get('https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param='+symbol+',day,,,150,qfq');}catch{d=await get('https://proxy.finance.qq.com/ifzqgtimg/appstock/app/fqkline/get?param='+symbol+',day,,,150,qfq');}
  const v=d.data?.[symbol],raw=v?.qfqday||v?.day;if(!Array.isArray(raw)||raw.length<120)throw Error('日线不足');
  const rows=raw.map(r=>({date:r[0],open:+r[1],close:+r[2],high:+r[3],low:+r[4],volume:+r[5]})).filter(r=>/^\d{4}-\d{2}-\d{2}$/.test(r.date)&&[r.open,r.close,r.high,r.low].every(x=>Number.isFinite(x)&&x>0));
  if(rows.length<120)throw Error('有效日线不足');historyCache.set(symbol,{rows,checked:Date.now()});return completedDailyRows(rows);
 }catch(error){
  const saved=cached?.rows||[...(initialSnapshot?.stocks||[]),...(initialSnapshot?.market||[])].find(s=>s.symbol===symbol)?.rows;
  const rows=completedDailyRows(saved||[]);console.warn('History source check:',JSON.stringify({symbol,error:error?.message,count:rows.length,date:rows.at(-1)?.date||null,fallback:rows.length>0}));
  if(!rows.length)throw error;rows.historyStale=true;return rows;
 }} )();historyPending.set(symbol,task);try{return await task;}finally{historyPending.delete(symbol);}
}
function technical(rows){if(!rows?.length)return null;const mean=n=>rows.slice(-n).reduce((s,r)=>s+r.close,0)/n;let atr=0;for(let i=1;i<rows.length;i++){const tr=Math.max(rows[i].high-rows[i].low,Math.abs(rows[i].high-rows[i-1].close),Math.abs(rows[i].low-rows[i-1].close));atr=i<=14?atr+tr/14:(atr*13+tr)/14;}const close=rows.at(-1).close,ma20=mean(20),ma60=mean(60);return {date:rows.at(-1).date,count:rows.length,ma20,ma60,atr,state:close>=ma20&&close>=ma60?'相对较强':close<ma20&&close<ma60?'偏弱':'震荡观察',volumeRatio:rows.at(-1).volume/(rows.slice(-21,-1).reduce((s,r)=>s+r.volume,0)/20)};}
// Swing observation policy: filter real historical pivots; never invent distant targets.
function swingCandidates(rows,tech,buyLevels=null,sellReference=null){
 if(!tech||rows.length<120||!Number.isFinite(tech.atr)||tech.atr<=0)return [buyLevels?.[0]??null,buyLevels?.[1]??null,null,null];
 const p=rows.at(-1).close,a=tech.atr,w=a*.25,highs=[];
 if(!Number.isFinite(p)||p<=0)return [null,null,null,null];
 for(let i=Math.max(2,rows.length-60);i<rows.length-2;i++){
  const window=rows.slice(i-2,i+3),r=rows[i];
  if(window.every(x=>x.high<=r.high)&&r.high>p)highs.push(r.high);
 }
 const original=buyLevels||candidates(rows,tech);
 const buyUpper=original?.[0]?.[1]??null;
 const reference=Number.isFinite(sellReference?.price)&&sellReference.price>0?sellReference.price:buyUpper;
 const sellFloor=buyUpper===null?Infinity:Math.max(buyUpper*1.08,buyUpper+a,reference*1.08,reference+a);
 const hi=[...new Set(highs)].filter(x=>Math.floor((x-w)*100)/100>=sellFloor).sort((x,y)=>x-y);
 const band=x=>Number.isFinite(x)?[Math.floor((x-w)*100)/100,Math.ceil((x+w)*100)/100]:null;
 const second=xs=>xs.find(x=>Math.abs(x-xs[0])-2*w-.02>=a);
 return [original?.[0]??null,original?.[1]??null,band(hi[0]),band(second(hi))];
}
function candidates(rows,tech){if(!tech||rows.length<120)return null;const p=rows.at(-1).close,a=tech.atr,lows=[],highs=[];for(let i=Math.max(2,rows.length-120);i<rows.length-2;i++){const w=rows.slice(i-2,i+3);if(w.every(r=>r.low>=rows[i].low)&&rows[i].low<p)lows.push(rows[i].low);if(w.every(r=>r.high<=rows[i].high)&&rows[i].high>p)highs.push(rows[i].high);}const unique=(xs,down)=>[...new Set(xs)].sort((x,y)=>down?y-x:x-y);const lo=unique(lows,true),hi=unique(highs,false),second=xs=>xs.find(x=>Math.abs(x-xs[0])>=a),band=x=>Number.isFinite(x)?[+(x-a*.25).toFixed(2),+(x+a*.25).toFixed(2)]:null;return [band(lo[0]),band(second(lo)),band(hi[0]),band(second(hi))];}
function distance(price,r){if(!r||!Number.isFinite(price)||price<=0)return null;const delta=price<r[0]?r[0]-price:price>r[1]?r[1]-price:0;return {delta,pct:delta/price*100,inside:delta===0};}
function normalizeAnnouncements(list,code){
 return list.filter(a=>a.codes?.some(c=>c.stock_code===code)).map(a=>{
  const noticeDate=a.notice_date?.slice(0,10);
  const publishedAt=/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(a.display_time||'')?a.display_time.slice(0,19):null;
  return {title:a.title,date:publishedAt?.slice(0,10)||noticeDate,noticeDate,publishedAt,dateSource:publishedAt?'实际发布时间':'公告日期（发布时间未取得）',url:'https://data.eastmoney.com/notices/detail/'+code+'/'+a.art_code+'.html',source:'公司公告 · 东方财富转载',important:/业绩|报告|订单|合同|投资|扩产|回购|风险|诉讼|减持/.test(a.title)};
 });
}
async function announcements(symbol){const code=symbol.slice(2),d=await get('https://np-anotice-stock.eastmoney.com/api/security/ann?sr=-1&page_size=100&page_index=1&ann_type=A&stock_list='+code);if(!Array.isArray(d.data?.list))throw Error('公告未返回');return normalizeAnnouncements(d.data.list,code);}
async function pool(date,type){const d=await get('https://push2ex.eastmoney.com/getTopic'+type+'Pool?ut=7eea3edcaed734bea9cbfc24409ed989&dpt=wz.ztzt&Pageindex=0&pagesize=1&sort=fbt:asc&date='+date.replaceAll('-',''));if(!d.data||String(d.data.qdate)!==date.replaceAll('-',''))throw Error('统计未返回');return {count:d.data.tc,date};}
const usAssets=[];
async function usClose([symbol,name]){let d;try{d=await get('https://query1.finance.yahoo.com/v8/finance/chart/'+encodeURIComponent(symbol)+'?interval=1d&range=5d');}catch{const key={'^GSPC':'.INX','^IXIC':'.IXIC','^SOX':'.SOX'}[symbol]||symbol;const raw=await get('https://qt.gtimg.cn/q=us'+key,'gbk');const p=raw.match(/="([^"]*)"/)?.[1]?.split('~');if(!p||!/^\d{4}-\d{2}-\d{2} 16:/.test(p[30])||!(+p[3]>0))throw Error('US close source unavailable');return {symbol,name,price:+p[3],change:+p[32],date:p[30].slice(0,10),time:p[30],session:'已完成常规交易日收盘',source:'腾讯财经美股',currency:p[35]||'USD'};}const r=d.chart?.result?.[0];if(!r)throw Error('US data missing');const times=r.timestamp||[],closes=r.indicators?.quote?.[0]?.close||[],today=new Date().toLocaleDateString('sv-SE',{timeZone:'America/New_York'}),end=r.meta?.currentTradingPeriod?.regular?.end;let rows=times.map((t,i)=>({date:new Date(t*1000).toLocaleDateString('sv-SE',{timeZone:'America/New_York'}),close:closes[i]})).filter(x=>Number.isFinite(x.close));if(end&&Date.now()/1000<end)rows=rows.filter(x=>x.date!==today);if(rows.length<2)throw Error('US close not confirmed');const last=rows.at(-1),prev=rows.at(-2);return {symbol,name,price:last.close,change:(last.close/prev.close-1)*100,date:last.date,session:'已完成常规交易日收盘',source:'Yahoo Finance',currency:r.meta.currency||'USD'};}

const xmlText=s=>s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'");
async function mediaNews(stock){const rss=await get('https://news.google.com/rss/search?q='+encodeURIComponent(stock.name+' when:2d')+'&hl=zh-CN&gl=CN&ceid=CN:zh-Hans','utf-8');const allowed=['stcn.com','cnstock.com','cs.com.cn','xinhuanet.com','news.cn','cctv.com','people.com.cn','yicai.com','ce.cn'];const out=[];for(const match of rss.matchAll(/<item>([\s\S]*?)<\/item>/g)){const item=match[1],tag=t=>xmlText(item.match(new RegExp('<'+t+'[^>]*>([\\s\\S]*?)</'+t+'>'))?.[1]||''),sourceUrl=xmlText(item.match(/<source[^>]*url="([^"]+)"/)?.[1]||'');let host;try{host=new URL(sourceUrl).hostname;}catch{continue;}if(!allowed.some(d=>host===d||host.endsWith('.'+d)))continue;const title=tag('title'),time=Date.parse(tag('pubDate'));if(!title.includes(stock.name)||!Number.isFinite(time))continue;out.push({title,url:tag('link'),date:new Date(time).toLocaleDateString('sv-SE',{timeZone:'Asia/Shanghai'}),source:tag('source')+' · Google新闻索引'});}return out.slice(0,12);}

async function amounts(secid){const d=await get('https://push2his.eastmoney.com/api/qt/stock/kline/get?secid='+secid+'&klt=101&fqt=0&lmt=30&end=20500101&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57');if(!d.data?.klines?.length)throw Error('成交额未返回');return d.data.klines.map(r=>{const a=r.split(',');return {date:a[0],amount:+a[6]};});}
function amountSummary(sh,sz){const matched=sh.map(r=>({date:r.date,amount:r.amount+(sz.find(s=>s.date===r.date)?.amount||NaN)})).filter(r=>Number.isFinite(r.amount)&&r.amount>0);const complete=completedDailyRows(matched);const rows=complete.map((r,i)=>{const prev=complete[i-1],base=complete.slice(Math.max(0,i-20),i),avg=base.length===20?base.reduce((v,s)=>v+s.amount,0)/20:null;return {...r,change:prev?(r.amount/prev.amount-1)*100:null,ratio:avg?r.amount/avg:null};});return {rows:rows.slice(-5),source:'东方财富指数日线',scope:'上证综指＋深证综指成交额（含B股，不含北交所）'};}
async function marketImportantNews(){
 const results=await Promise.allSettled(['A股','资本市场','中国股市'].map(name=>mediaNews({name})));
 if(results.every(r=>r.status==='rejected'))throw Error('A股热点新闻源不可用');
 const seen=new Set();return results.flatMap(r=>r.status==='fulfilled'?r.value:[]).filter(n=>{
  if(!/证监会|国务院|央行|中国人民银行|财政部|交易所|降准|降息|印花税|新规|改革|重大|重组|退市|政策|暴涨|暴跌|大涨|大跌|突破|成交|万亿|历史新高|监管|IPO|再融资/.test(n.title))return false;
  const key=n.url||n.title;if(seen.has(key))return false;seen.add(key);return true;
 }).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,20);
}

let goldCache=null,goldChecked=0,goldLatest=null;
function parseGold(payload,now=Date.now()){
 if(!Array.isArray(payload?.time))throw Error('上金所日线结构改变');
 const rows=completedDailyRows(payload.time.map(r=>({date:r[0],open:+r[1],close:+r[2],low:+r[3],high:+r[4],volume:0})).filter(r=>/^\d{4}-\d{2}-\d{2}$/.test(r.date)&&[r.open,r.close,r.low,r.high].every(p=>Number.isFinite(p)&&p>0)&&r.high>=r.low&&r.close>=r.low&&r.close<=r.high).sort((a,b)=>a.date.localeCompare(b.date)),now,960).slice(-150);
 if(rows.length<60)throw Error('黄金日线不足');
 const tech=technical(rows),last=rows.at(-1),prev=rows.at(-2),levels=candidates(rows,tech);
 return {name:'国内大盘黄金',symbol:'Au99.99',unit:'元/克',date:last.date,price:last.close,change:(last.close/prev.close-1)*100,session:'日线收盘参考',source:'上海黄金交易所',sourceUrl:'https://www.sge.com.cn/graph/Dailyhq',tech:{...tech,volumeRatio:null},levels,distances:(levels||[null,null,null,null]).map(r=>distance(last.close,r)),rows:rows.slice(-60),method:'近120日日线局部支撑／压力，区间为中心±0.25ATR14；技术观察区，非估值或成交信号。',analysis:'价格与20日、60日均线比较趋势；买档需止跌确认，卖档需转弱确认。实际利率、美元与人民币汇率影响黄金，黄金没有经营现金流，不能套用股票盈利估值。'};
}
function parseGoldQuote(payload,now=Date.now()){
 if(payload?.heyue!=='Au99.99'||!Array.isArray(payload.times)||!Array.isArray(payload.data)||payload.times.length!==payload.data.length)throw Error('黄金分时结构或品种不符');
 const match=String(payload.delaystr||'').match(/^(\d{4})年(\d{2})月(\d{2})日 (\d{2}):(\d{2}):(\d{2})$/);
 if(!match)throw Error('黄金报价时间未核验');
 const date=match.slice(1,4).join('-'),time=match.slice(4).join(':'),stamp=Date.parse(date+'T'+time+'+08:00');
 if(!Number.isFinite(stamp)||stamp>now)throw Error('黄金报价时间超前');
 const midnight=Date.parse(date+'T00:00:00+08:00'),night=+match[4]>=20;
 const entries=payload.times.map((t,i)=>{if(!/^\d{2}:\d{2}$/.test(t))return null;const [h,m]=t.split(':').map(Number);if(h>23||m>59)return null;const offset=h>=20?(night?0:-1):(night?1:0),at=midnight+offset*86400000+(h*60+m)*60000,price=+payload.data[i];return Number.isFinite(price)&&price>0&&at<=stamp?{price,at}:null;}).filter(Boolean).sort((a,b)=>a.at-b.at);
 if(!entries.length)throw Error('黄金暂无已发生报价');
 const last=entries.at(-1),pointDate=new Date(last.at+8*3600000).toISOString().slice(0,16).replace('T',' ')+':00';
 return {price:last.price,time:pointDate,updatedAt:date+' '+time,source:'上海黄金交易所延时行情',sourceUrl:'https://www.sge.com.cn/graph/quotations?instid=Au99.99'};
}
let goldQuoteCache=null,goldQuoteChecked=0,goldQuotePending=null;
function parseGoldAlternative(payload,now=Date.now()){
 const data=payload?.data;if(data?.code!=='AU9999'||!Array.isArray(data.trends))throw Error('备用黄金品种或结构不符');
 const points=data.trends.map(row=>{const p=String(row).split(','),stamp=Date.parse(p[0].replace(' ','T')+':00+08:00'),price=+p[2];return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(p[0])&&Number.isFinite(stamp)&&stamp<=now&&Number.isFinite(price)&&price>0?{price,time:p[0]+':00',stamp}:null;}).filter(Boolean).sort((a,b)=>a.stamp-b.stamp);
 if(!points.length)throw Error('备用黄金无有效已发生报价');const last=points.at(-1),previousClose=+data.preClose;
 return {price:last.price,time:last.time,previousClose:Number.isFinite(previousClose)&&previousClose>0?previousClose:null,source:'东方财富上金所Au99.99分时（备用）',sourceUrl:'https://quote.eastmoney.com/globalfuture/AU9999.html'};
}
function parseGoldSina(raw,now=Date.now()){
 const contract=raw.match(/hq_str_SGE_AU9999="([^"]*)"/)?.[1]?.split(',');
 const row=raw.match(/hq_str_gds_AU9999="([^"]*)"/)?.[1]?.split(',');
 if(contract?.[2]!=='Au99.99'||!row||row.length<14)throw Error('新浪黄金品种未确认');
 const price=+row[0],previousClose=+row[7],time=row[12]+' '+row[6],stamp=Date.parse(time.replace(' ','T')+'+08:00');
 if(!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(time)||!Number.isFinite(stamp)||stamp>now||!Number.isFinite(price)||price<=0||!Number.isFinite(previousClose)||previousClose<=0)throw Error('新浪黄金价格或时间未核验');
 return {price,previousClose,time,source:'新浪财经上金所Au99.99报价（备用）',sourceUrl:'https://finance.sina.com.cn/futures/quotes/AU9999.shtml'};
}
async function goldQuote(){
 if(goldQuoteCache&&Date.now()-goldQuoteChecked<120000)return goldQuoteCache;
 if(goldQuotePending)return goldQuotePending;
 goldQuotePending=(async()=>{
  let quote;
  try{const r=await fetch('https://www.sge.com.cn/graph/quotations?instid=Au99.99',{headers:{'Referer':'https://www.sge.com.cn/','User-Agent':'Mozilla/5.0'},signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error('上金所HTTP '+r.status);quote=parseGoldQuote(await r.json());}
  catch(error){console.warn('Gold primary quote unavailable:',error.message);try{const r=await fetch('https://push2his.eastmoney.com/api/qt/stock/trends2/get?secid=118.AU9999&fields1=f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f11&fields2=f51,f52,f53,f54,f55,f56,f57,f58&ndays=1&iscr=0',{signal:AbortSignal.timeout(8000),headers:{'User-Agent':'Mozilla/5.0'}});if(!r.ok)throw Error('备用黄金HTTP '+r.status);quote=parseGoldAlternative(await r.json());}catch(error){console.warn('Gold alternative quote unavailable:',error.message);const r=await fetch('https://hq.sinajs.cn/list=gds_AU9999,SGE_AU9999',{headers:{'Referer':'https://finance.sina.com.cn/','User-Agent':'Mozilla/5.0'},signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error('新浪黄金HTTP '+r.status);quote=parseGoldSina(new TextDecoder('gbk').decode(await r.arrayBuffer()));}}
  goldQuoteCache=quote;goldQuoteChecked=Date.now();return quote;
 })();try{return await goldQuotePending;}finally{goldQuotePending=null;}
}
async function goldDaily(){
 if(goldCache&&Date.now()-goldChecked<900000)return goldCache;
 const r=await fetch('https://www.sge.com.cn/graph/Dailyhq',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded','Referer':'https://www.sge.com.cn/','User-Agent':'Mozilla/5.0'},body:'instid=Au99.99',signal:AbortSignal.timeout(10000)});
 if(!r.ok)throw Error('黄金行情源不可用');
 goldCache=parseGold(await r.json());goldChecked=Date.now();return goldCache;
}

function goldReferenceClose(daily,quote){
 if(Number.isFinite(quote.previousClose)&&quote.previousClose>0)return quote.previousClose;
 const date=quote.time.slice(0,10),night=+quote.time.slice(11,13)>=20;
 const reference=daily.rows?.filter(r=>night?r.date<=date:r.date<date).at(-1);
 return Number.isFinite(reference?.close)&&reference.close>0?reference.close:null;
}
async function goldDashboard(){
 const results=await Promise.allSettled([goldDaily(),goldQuote()]);
 const daily=results[0].status==='fulfilled'?results[0].value:goldCache||initialSnapshot?.gold;
 if(!daily)throw Error('黄金日线不可用，观察档位待核验');
 const quote=results[1].status==='fulfilled'?results[1].value:null;
 if(!quote){console.warn('Gold quote unavailable:',results[1].reason?.message);return goldLatest?{...goldLatest,quoteError:true,session:'报价更新失败 · 保留上次有效报价'}:{...daily,change:null,quoteError:true,levelDate:daily.date,session:'当前报价未取得 · 上次日线收盘参考'};}
 const previousClose=goldReferenceClose(daily,quote);
 goldLatest={...daily,levelDate:daily.date,dailyClose:daily.price,previousClose:previousClose||null,price:quote.price,change:previousClose?(quote.price/previousClose-1)*100:null,date:quote.time.slice(0,10),quoteTime:quote.time,quoteUpdatedAt:quote.updatedAt,session:'延时行情 · 非实时成交价',source:quote.source,sourceUrl:quote.sourceUrl,quoteError:false,dailyError:results[0].status!=='fulfilled',distances:(daily.levels||[null,null,null,null]).map(r=>distance(quote.price,r))};return goldLatest;
}

let appointmentCache=null,appointmentChecked=0;
async function earningsEvents(){
 if(appointmentCache&&Date.now()-appointmentChecked<3600000)return appointmentCache;
 const period=eventCalendar?.reportPeriod||'2026-09-30',filter="(REPORT_DATE='"+period+"')(SECURITY_CODE in ("+stocks.map(s=>'"'+s.symbol.slice(2)+'"').join(',')+"))";
 const url='https://datacenter-web.eastmoney.com/api/data/v1/get?reportName=RPT_PUBLIC_BS_APPOIN&columns=ALL&pageSize=50&pageNumber=1&filter='+encodeURIComponent(filter);
 try{const data=await get(url);if(!data.success||!Array.isArray(data.result?.data))throw Error('预约数据不可用');
 const events=data.result.data.map(r=>{const stock=stocks.find(s=>s.symbol.slice(2)===r.SECURITY_CODE);const date=r.APPOINT_PUBLISH_DATE?.slice(0,10);return stock&&/^\d{4}-\d{2}-\d{2}$/.test(date)?{symbol:stock.symbol,name:stock.name,title:r.REPORT_TYPE_NAME+'预约披露',date,actualDate:r.ACTUAL_PUBLISH_DATE?.slice(0,10)||null,type:'earnings',source:'东方财富预约披露汇总',sourceUrl:'https://data.eastmoney.com/bbsj/'+period.slice(0,7).replace('-','')+'/yysj.html'}:null;}).filter(Boolean);
 if(events.length!==stocks.length)throw Error('四股预约数据不全');
 appointmentCache={events:[...events,...(eventCalendar?.events||[]).filter(e=>e.type!=='earnings')],checkedAt:new Date().toISOString(),stale:false};appointmentChecked=Date.now();return appointmentCache;
 }catch{return {events:eventCalendar?.events||[],checkedAt:eventCalendar?.checkedAt||null,stale:true};}
}
async function dashboard(){const symbols=[...indices,...stocks.map(s=>s.symbol)];const tasks=await Promise.allSettled([get('https://qt.gtimg.cn/q='+symbols.join(','),'gbk'),...symbols.map(history),...stocks.map(s=>announcements(s.symbol)),...usAssets.map(usClose),...stocks.map(mediaNews),amounts('1.000001'),amounts('0.399106'),marketImportantNews(),goldDashboard(),earningsEvents()]);const noticeStart=1+symbols.length,usStart=noticeStart+stocks.length,mediaStart=usStart+usAssets.length,amountStart=mediaStart+stocks.length;const quotes=tasks[0].status==='fulfilled'?parseQuotes(tasks[0].value):{};const data=symbols.map((symbol,i)=>{const r=tasks[i+1];return {symbol,rows:r.status==='fulfilled'?r.value:[],historyStale:r.status!=='fulfilled'||r.value.historyStale===true,quote:quotes[symbol]||null};});const market=data.slice(0,indices.length).map(d=>({...d,tech:technical(d.rows)}));const date=quotes.sh000001?.time?.slice(0,10)||market[0].rows.at(-1)?.date;const pools=date?await Promise.allSettled(['ZT','DT','ZB'].map(t=>pool(date,t))):[];return {generated:new Date().toISOString(),investmentReviewAsOf:investmentReviews?.asOf||null,accounts,date,market,importantEvents:tasks[amountStart+4].status==='fulfilled'?tasks[amountStart+4].value:null,gold:tasks[amountStart+3].status==='fulfilled'?tasks[amountStart+3].value:null,goldError:tasks[amountStart+3].status!=='fulfilled',marketNews:tasks[amountStart+2].status==='fulfilled'?tasks[amountStart+2].value:[],marketNewsError:tasks[amountStart+2].status!=='fulfilled',turnover:tasks[amountStart].status==='fulfilled'&&tasks[amountStart+1].status==='fulfilled'?amountSummary(tasks[amountStart].value,tasks[amountStart+1].value):null,pools:pools.map(r=>r.status==='fulfilled'?r.value:null),us:tasks.slice(usStart,mediaStart).filter(r=>r.status==='fulfilled').map(r=>r.value),stocks:stocks.map((s,i)=>{const d=data[i+indices.length],tech=technical(d.rows),newer=tech?.date>'2026-09-30',levels=swingCandidates(d.rows,tech,s.levels,s.sellReference),news=tasks[noticeStart+i];const q=d.quote||{price:d.rows.at(-1)?.close??null,change:d.rows.length>=2?(d.rows.at(-1).close/d.rows.at(-2).close-1)*100:null,time:d.rows.at(-1)?.date?d.rows.at(-1).date+' 收盘':null,source:'腾讯财经日线 · 历史参考'};return {...s,...d,longTermReview:investmentReviews?.stocks?.[s.symbol]?.longTermReview,replacementReview:investmentReviews?.stocks?.[s.symbol]?.replacementReview,rows:d.rows.slice(-60),quote:q,tech,levels,levelDate:tech?.date||'待核验',levelType:'买档2026-09-30确认 · 卖档对买T1及固定复核价均≥8%且≥1ATR · 近60交易日压力 · 待估值复核',distances:(levels||[null,null,null,null]).map(r=>distance(q.price,r)),notices:news.status==='fulfilled'?news.value:[],newsError:news.status!=='fulfilled',mediaNews:tasks[mediaStart+i].status==='fulfilled'?tasks[mediaStart+i].value:[],mediaError:tasks[mediaStart+i].status!=='fulfilled'};})};}

function publicAccounts(stockData){return accounts.map(a=>{const valid=a.positions.every(p=>Number.isFinite(stockData.find(s=>s.symbol===p.symbol)?.quote?.price));const invested=valid?a.positions.reduce((v,p)=>v+p.shares*stockData.find(s=>s.symbol===p.symbol).quote.price,0):null,total=valid?invested+a.cash:null;const tech=valid?a.positions.filter(p=>p.symbol!=='sh600312').reduce((v,p)=>v+p.shares*stockData.find(s=>s.symbol===p.symbol).quote.price,0)/total:null;return {id:a.id,name:a.name,holdingsAsOf:a.holdingsAsOf,weight:valid?invested/total:null,cashWeight:valid?a.cash/total:null,allocationPolicy:a.allocationPolicy,rules:a.rules,rulesConfirmed:a.rulesConfirmed,allocationConfirmed:a.allocationConfirmed,positions:a.positions.map(p=>{const s=stockData.find(s=>s.symbol===p.symbol),weight=valid?p.shares*s.quote.price/total:null;return {symbol:p.symbol,weight,full:valid&&(p.symbol==='sh600312'?weight>=a.rules.pinggaoMax:tech>=a.rules.techSharedMax),budgetAvailable:[0,1].map(k=>valid&&a.allocationConfirmed&&a.cash>=s.quote.price*100&&(a.stageBudgets[p.symbol]?.[k===0?'t1':'t2']||0)>=s.quote.price*100),sellAvailable:(a.sellableShares[p.symbol]||0)>0};})};});}

const gatePage='<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>授权访问</title><style>body{margin:0;min-height:100dvh;display:grid;place-items:center;background:#0b1421;color:#dfebf8;font:14px system-ui}main{width:min(320px,85vw);padding:25px;border:1px solid #37566f;border-radius:14px;background:#142235}h1{font-size:20px}input,button{box-sizing:border-box;width:100%;padding:12px;margin-top:12px;border-radius:7px;border:1px solid #3b526b;background:#1a2b40;color:inherit;font:inherit}button{background:#24645a;cursor:pointer}p{color:#9fb7ce;font-size:12px}#error{color:#ff9c9c}</style><main><h1>价值投资观察台</h1><p>输入授权手机号，同一浏览器记住30天</p><form id="form"><input id="phone" aria-label="授权手机号" inputmode="tel" autocomplete="tel" required maxlength="20" placeholder="授权手机号"><button>进入网页</button></form><p id="error" role="status"></p></main><script>document.getElementById("form").onsubmit=async e=>{e.preventDefault();const b=e.target.querySelector("button");b.disabled=true;try{const r=await fetch("/access/login",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({phone:document.getElementById("phone").value})});if(!r.ok)throw Error();location.reload();}catch{document.getElementById("error").textContent="号码未获授权，或暂时无法验证，请联系老刘。";}finally{b.disabled=false;}};</script></html>';
const hex=b=>Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,'0')).join('');
async function digest(s){return hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));}
async function signAccess(s,key){const k=await crypto.subtle.importKey('raw',new TextEncoder().encode(key),{name:'HMAC',hash:'SHA-256'},false,['sign']);return hex(await crypto.subtle.sign('HMAC',k,new TextEncoder().encode(s)));}
async function accessGate(req,env){if(env.PHONE_GATE_ENABLED!=='1')return null;const u=new URL(req.url),key=env.PHONE_SESSION_SECRET,allowed=new Set((env.PHONE_ALLOWED_HASHES||'').split(',').filter(Boolean));if(!key||!allowed.size)return new Response('访问名单配置中，请稍后再试',{status:503,headers:{'cache-control':'no-store'}});if(u.pathname==='/access/login'&&req.method==='POST'){if(req.headers.get('origin')!==u.origin)return new Response('Forbidden',{status:403});let data;try{data=await req.json();}catch{return new Response('Bad request',{status:400});}const phone=String(data.phone||'').replace(/[\s-]/g,'').replace(/^\+86/,'');if(!/^1[3-9]\d{9}$/.test(phone))return new Response('Denied',{status:403});const hash=await digest(phone);if(!allowed.has(hash))return new Response('Denied',{status:403});const payload=hash+'.'+(Date.now()+30*86400000),token=payload+'.'+await signAccess(payload,key);return new Response('{}',{headers:{'content-type':'application/json','cache-control':'no-store','set-cookie':'stock_access='+token+'; Path=/; Max-Age=2592000; HttpOnly; Secure; SameSite=Lax'}});}const token=req.headers.get('cookie')?.match(/(?:^|;\s*)stock_access=([^;]+)/)?.[1],parts=token?.split('.');if(parts?.length===3&&allowed.has(parts[0])&&+parts[1]>Date.now()&&parts[2]===await signAccess(parts[0]+'.'+parts[1],key))return null;if(u.pathname==='/')return new Response(gatePage,{headers:{'content-type':'text/html;charset=utf-8','cache-control':'no-store'}});return new Response('{"error":"请先输入授权手机号"}',{status:401,headers:{'content-type':'application/json;charset=utf-8','cache-control':'no-store'}});}

const page = "__PAGE__";
export default {async fetch(request,env,ctx){const gate=await accessGate(request,env||{});if(gate)return gate;const url=new URL(request.url);if(request.method!=='GET')return json({error:'仅支持读取'},405);if(url.pathname==='/api/gold'){try{return json(await goldDashboard());}catch{return json({error:'黄金来源暂不可用'},503);}}if(url.pathname==='/data/dashboard.json'||url.pathname==='/api/dashboard'){try{const data=await dashboard();if(initialSnapshot?.us){data.us=usAssets.map(([symbol,name])=>data.us.find(s=>s.symbol===symbol)||{...initialSnapshot.us.find(s=>s.symbol===symbol),symbol,name,stale:true});}if(!data.turnover&&initialSnapshot?.turnover)data.turnover={...initialSnapshot.turnover,stale:true};if(!data.gold&&initialSnapshot?.gold)data.gold={...initialSnapshot.gold,stale:true};data.accounts=publicAccounts(data.stocks);const usable=data.stocks.some(s=>Number.isFinite(s.quote.price));if(!usable&&initialSnapshot)return json({...initialSnapshot,gold:data.gold||goldLatest||initialSnapshot.gold,stale:true,updateError:'线上来源暂不可用，显示最近核验数据'});return json(data);}catch(error){console.error('dashboard update failed',error?.message);if(initialSnapshot)return json({...initialSnapshot,gold:goldLatest||initialSnapshot.gold,stale:true,updateError:'更新失败，显示最近核验数据'});return json({error:'行情源暂不可用'},503);}}if(url.pathname!=='/')return new Response('Not found',{status:404});const seed=initialSnapshot?'<script>window.initialDashboard='+JSON.stringify({...initialSnapshot,gold:goldLatest||initialSnapshot.gold,stale:true}).replaceAll('<','\u003c')+';</script>':'';return new Response(page.replace('<script>',seed+'<script>'),{headers:{'content-type':'text/html; charset=utf-8','x-content-type-options':'nosniff','cache-control':'no-store'}});}};
export {history,amountSummary,normalizeAnnouncements,parseGold,parseGoldQuote,parseGoldAlternative,parseGoldSina,goldReferenceClose,goldDashboard,accessGate,digest,publicAccounts,stocks,distance,technical,candidates,swingCandidates,completedDailyRows,parseQuotes};
