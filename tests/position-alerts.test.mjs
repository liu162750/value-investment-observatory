import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const page=readFileSync(new URL('../worker/page.html',import.meta.url),'utf8');
const source=page.slice(page.indexOf('function accountView('),page.indexOf('const previewAccounts='));
const calculate=new Function('model',source+';return accountView;')({stale:false});
const stocks=[{symbol:'sample',quote:{time:'2026-10-08 10:00:00'},distances:[{inside:true},{inside:true}],tradeChecks:[]}];
const now=Date.parse('2026-10-08T10:00:01+08:00');
for(const weight of [.85,.9]){
 const account={weight,rulesConfirmed:false,positions:[{symbol:'sample',budgetAvailable:[true,true]}]};
 const alerts=calculate(account,stocks,now).positions[0].alerts;
 assert(alerts[0].text.includes('已达八五仓'));assert.equal(alerts[0].flash,false);
 assert(alerts[1].text.startsWith('买T2'));assert.equal(alerts[1].flash,true);
}
assert(!calculate({weight:.849,positions:[{symbol:'sample',budgetAvailable:[true,true]}]},stocks,now).positions[0].alerts[0].text.includes('八五仓'));
console.log('PASS: 85% boundary blocks T1 only, applies to either account without prior rule flag');
