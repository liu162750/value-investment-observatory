import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const page=readFileSync(new URL('../worker/page.html',import.meta.url),'utf8');
const helpers=page.slice(page.indexOf('const dashboardCacheKey='),page.indexOf('let goldBusy=false;'));
let stored=null;
const storage={getItem:()=>stored,setItem:(key,value)=>{stored=value;}};
const context=vm.createContext({localStorage:storage});vm.runInContext(helpers,context);
const seed={cacheRevision:'a',generated:'2026-10-20T00:00:00Z',stocks:[{symbol:'x',quote:{price:1}}]};
const fresh={...seed,generated:'2026-10-22T03:00:00Z',stocks:[{symbol:'x',quote:{price:2}}]};
context.seed=seed;context.fresh=fresh;
vm.runInContext('saveDashboard(fresh)',context);
let restored=vm.runInContext('restoreDashboard(seed)',context);
assert.equal(restored.stocks[0].quote.price,2,'Reload must immediately recover the last successful data');
assert.equal(restored.stale,true,'Restored data must not grant live trading permission');
context.changed={...seed,cacheRevision:'b'};
assert.equal(vm.runInContext('restoreDashboard(changed)',context).stocks[0].quote.price,1,'A deployment or holding change invalidates the previous revision');
context.failed={...seed,stale:true};vm.runInContext('saveDashboard(failed)',context);
assert.equal(JSON.parse(stored).stocks[0].quote.price,2,'A failed refresh cannot overwrite good cached data');
stored='broken';assert.equal(vm.runInContext('restoreDashboard(seed)',context).stocks[0].quote.price,1);
storage.getItem=()=>{throw Error('Storage unavailable');};
assert.equal(vm.runInContext('restoreDashboard(seed)',context).stocks[0].quote.price,1);
const mergeHelpers=page.slice(page.indexOf('function newerGold('),page.indexOf('const dashboardCacheKey='));
const merge=new Function(mergeHelpers+';return mergeDashboardData;')();
assert.equal(merge({...seed,stale:true},fresh).stocks[0].quote.price,2,'A server fallback must not roll back a newer browser view');
assert.equal(merge({...seed,cacheRevision:'b',stale:true},fresh).cacheRevision,'b','New server rules must supersede cached old rules');
console.log('PASS: refresh restores latest success; cached signals stale; new rules invalidate cache; failures and unavailable storage are safe');
let source=readFileSync(new URL('../worker/dashboard.js',import.meta.url),'utf8');
source=source.replace('const initialSnapshot = null;','const initialSnapshot = '+JSON.stringify(seed)+';')
 .replace('const page = "__PAGE__";', 'const page = "<script></script>";')
 .replace('async function dashboard(){','async function unusedDashboard(){');
source+='\nasync function dashboard(){if(globalThis.__dashboardFailure)throw Error("Test outage");return structuredClone(globalThis.__dashboardFixture);}';
const worker=(await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))).default;
globalThis.__dashboardFixture=fresh;
try{
 await worker.fetch(new Request('https://test/api/dashboard'),{});
 const html=await(await worker.fetch(new Request('https://test/'),{})).text();
 assert(html.includes('"price":2'),'Server reload seed must use its last successful response');
 globalThis.__dashboardFailure=true;
 const failed=await(await worker.fetch(new Request('https://test/api/dashboard'),{})).json();
 assert.equal(failed.stocks[0].quote.price,2,'Server outage must preserve the last successful response');
 assert.equal(failed.stale,true);
 const denied=await worker.fetch(new Request('https://test/api/dashboard'),{PHONE_GATE_ENABLED:'1'});
 assert.equal(denied.status,503,'Cached responses must remain behind access protection');
}finally{delete globalThis.__dashboardFixture;delete globalThis.__dashboardFailure;}
console.log('PASS: server reload and outage retain latest data; access protection remains enforced');
