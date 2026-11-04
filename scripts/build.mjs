await import('../tests/refresh-cache.test.mjs');
await import('../tests/recap.test.mjs');
await import('../tests/recap-sectors.test.mjs');
await import('../tests/turnover.test.mjs');
import {createHash} from 'node:crypto';
await import('../tests/market-gate.test.mjs');
await import('../tests/events.test.mjs');
await import('../tests/recovery.test.mjs');
await import('../tests/position-alerts.test.mjs');
await import('../tests/gold-quote.test.mjs');
await import('../tests/monitor.test.mjs');
await import('../tests/account-day.test.mjs');
await import('../tests/levels.test.mjs');
await import('../tests/tier-policy.test.mjs');
await import('../tests/mon-wed-policy.test.mjs');
await import('../tests/public-page.test.mjs');
await import('../tests/public-portfolio.test.mjs');
import {mkdirSync,copyFileSync,readFileSync,writeFileSync} from 'node:fs';
mkdirSync('dist/server',{recursive:true});
const events=JSON.parse(readFileSync('worker/event-calendar.json','utf8'));
const reviews=JSON.parse(readFileSync('worker/investment-reviews.json','utf8'));
const snapshot=JSON.parse(readFileSync('worker/snapshot.json','utf8'));
// A packaged fallback must never expose the retired price levels as current tiers.
for(const stock of snapshot.stocks){
 stock.levels=[null,null,null,null];stock.distances=[null,null,null,null];
 stock.levelReview={policyId:'mon-wed-close-atr20-v1',status:'pending',reason:'等待本次完整日线复核'};
 stock.sellReview={status:'pending',levels:[null,null]};stock.sellReference=null;
 stock.levelDate='待核验';stock.levelType='新规则档位待核验';
}
snapshot.marketGate.weekly={status:'pending',passed:null,reason:'等待本次完整周线复核'};
const accounts=JSON.parse(process.env.SERVER_ACCOUNTS_JSON || '[]');
const overrides=JSON.parse(process.env.SERVER_ACCOUNT_OVERRIDES_JSON || '[]');
for(const patch of overrides){
 const account=accounts.find(a=>a.id===patch.id);
 if(!account)throw new Error('Private account override has no matching account');
 if(!Number.isFinite(patch.cash)||patch.cash<0||!Array.isArray(patch.positions)||!patch.positions.length||patch.positions.some(p=>!p.symbol||!Number.isInteger(p.shares)||p.shares<0))throw new Error('Invalid private account holdings override');
 Object.assign(account,patch);
 // A new holding snapshot does not confirm remaining stage budgets or floating sell capacity.
 account.allocationConfirmed=false;
 account.stageBudgets={};
 account.sellableShares={};
}
const laoliuSnapshot=process.env.PUBLIC_LAOLIU_SNAPSHOT_JSON?JSON.parse(process.env.PUBLIC_LAOLIU_SNAPSHOT_JSON):null;
if(laoliuSnapshot){
 const account=accounts.find(a=>a.id==='laoliu');
 if(!account||!Number.isFinite(laoliuSnapshot.cash)||laoliuSnapshot.cash<0||!Number.isFinite(laoliuSnapshot.costBasisTotal)||laoliuSnapshot.costBasisTotal<=0||!Array.isArray(laoliuSnapshot.positions)||laoliuSnapshot.positions.length!==4||laoliuSnapshot.positions.some(p=>!p.symbol||!Number.isInteger(p.shares)||p.shares<0))throw new Error('Invalid Lao Liu snapshot configuration');
 Object.assign(account,laoliuSnapshot,{allocationConfirmed:false,stageBudgets:{},sellableShares:{}});
 const dayReference=process.env.PUBLIC_LAOLIU_DAY_REFERENCE_JSON?JSON.parse(process.env.PUBLIC_LAOLIU_DAY_REFERENCE_JSON):null;
 if(dayReference&&/^\d{4}-\d{2}-\d{2}$/.test(dayReference.date)&&Number.isFinite(dayReference.previousAssets)&&dayReference.previousAssets>0)account.dayReference=dayReference;
}
const publicAccountId=process.env.PUBLIC_ACCOUNT_ID;
const publicAccount=publicAccountId?accounts.find(a=>a.id===publicAccountId):accounts.find(a=>String(a.name||'').includes('老刘'))||(accounts.length===1?accounts[0]:null);
const backend=await import('../worker/dashboard.js?build='+Date.now());
const policySource=readFileSync('scripts/mon-wed-policy.mjs','utf8').replace(/export /g,'');
const inlinePolicy=source=>source.replace("import {priceReview,weeklyMarketGate} from '../scripts/mon-wed-policy.mjs';",policySource);
snapshot.accounts=[];
for(const stock of snapshot.stocks){Object.assign(stock,reviews.stocks?.[stock.symbol]||{});}
snapshot.importantEvents={events:events.events,checkedAt:events.checkedAt,stale:true};
snapshot.investmentReviewAsOf=reviews.asOf;
snapshot.cacheRevision=createHash('sha256').update(readFileSync('worker/dashboard.js')).update(readFileSync('scripts/mon-wed-policy.mjs')).update(readFileSync('worker/public-page.html')).update(JSON.stringify(reviews)).update(JSON.stringify(accounts)).digest('hex');
const source=inlinePolicy(readFileSync('worker/dashboard.js','utf8')).replace('const eventCalendar = "__EVENTS__";','const eventCalendar = '+JSON.stringify(events)+';').replace('const investmentReviews = "__REVIEWS__";','const investmentReviews = '+JSON.stringify(reviews)+';').replace('const initialSnapshot = null;', 'const initialSnapshot = '+JSON.stringify(snapshot)+';').replace('const accounts = [];','const accounts = '+JSON.stringify(publicAccount?[publicAccount]:[])+';').replace('const page = "__PAGE__";', 'const page = '+JSON.stringify(readFileSync('worker/public-page.html','utf8'))+';');
writeFileSync('dist/server/index.js',source);
console.log('Worker build complete');
