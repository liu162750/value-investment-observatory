await import('../tests/refresh-cache.test.mjs');
await import('../tests/recap.test.mjs');
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
import {mkdirSync,copyFileSync,readFileSync,writeFileSync} from 'node:fs';
mkdirSync('dist/server',{recursive:true});
const events=JSON.parse(readFileSync('worker/event-calendar.json','utf8'));
const reviews=JSON.parse(readFileSync('worker/investment-reviews.json','utf8'));
const snapshot=JSON.parse(readFileSync('worker/snapshot.json','utf8'));
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
const backend=await import('../worker/dashboard.js?build='+Date.now());
const accountSource=readFileSync('worker/dashboard.js','utf8').replace('const accounts = [];','const accounts = '+JSON.stringify(accounts)+';');
const privateModule=await import('data:text/javascript;base64,'+Buffer.from(accountSource).toString('base64'));snapshot.accounts=privateModule.publicAccounts(snapshot.stocks);
for(const stock of snapshot.stocks){Object.assign(stock,reviews.stocks?.[stock.symbol]||{});}
snapshot.importantEvents={events:events.events,checkedAt:events.checkedAt,stale:true};
snapshot.investmentReviewAsOf=reviews.asOf;
snapshot.cacheRevision=createHash('sha256').update(readFileSync('worker/dashboard.js')).update(readFileSync('worker/page.html')).update(JSON.stringify(reviews)).update(JSON.stringify(accounts)).digest('hex');
const source=readFileSync('worker/dashboard.js','utf8').replace('const eventCalendar = "__EVENTS__";','const eventCalendar = '+JSON.stringify(events)+';').replace('const investmentReviews = "__REVIEWS__";','const investmentReviews = '+JSON.stringify(reviews)+';').replace('const initialSnapshot = null;', 'const initialSnapshot = '+JSON.stringify(snapshot)+';').replace('const accounts = [];','const accounts = '+JSON.stringify(accounts)+';').replace('const page = "__PAGE__";', 'const page = '+JSON.stringify(readFileSync('worker/page.html','utf8'))+';');
writeFileSync('dist/server/index.js',source);
console.log('Worker build complete');
