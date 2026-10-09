import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const page=readFileSync(new URL('../worker/page.html',import.meta.url),'utf8');
const source=page.slice(page.indexOf('function renderMonitorRows('),page.indexOf('function renderThesisAlerts('));
const nodes=new Map();const select=id=>{if(!nodes.has(id))nodes.set(id,{classList:{values:new Map(),toggle(name,enabled){this.values.set(name,enabled)}},setAttribute(){}});return nodes.get(id);};
const model={stocks:[{symbol:'a',longTermReview:{status:'invalidated'}},{symbol:'b',replacementReview:{status:'qualified',candidate:{name:'样例公司',symbol:'sample'},reason:'样例核验原因',source:'https://example.test/report',asOf:'2026-10-08'}},{symbol:'c',replacementReview:{status:'qualified',candidate:{name:'未核验公司'}}}]};
new Function('model','$','esc',source+';renderMonitorRows();')(model,select,String);
assert.equal(select('#review-a').textContent,'逻辑失效 · 需复核');
assert(select('#replacement-a').innerHTML.includes('暂无已核验替代'));
assert(select('#replacement-b').innerHTML.includes('样例公司'));
assert.equal(select('#replacement-c').innerHTML,'暂无已确认更优替代');
assert.equal(select('#monitor-status').textContent,'已核验替代 1 项');
assert.equal((page.match(/class="combined-monitor /g)||[]).length,1);
assert(!page.includes('<h2>持有逻辑验证表</h2>')&&!page.includes('<h2>新价值逻辑投资监控</h2>'));
console.log('PASS: unified monitor, invalidation status, evidenced replacement, incomplete candidate withheld');

assert(!page.includes('<details')&&!page.includes('<summary>'),'All foldouts displayed directly');
assert(page.indexOf('class="inline-candidates"')<page.indexOf('id="thesis-sh601138"'),'Pingao candidates appear inside its row');
assert(page.includes('market-gold')&&!page.includes('</aside></div><section class="stock gold-card"'),'Gold in top market panel only');

assert.equal(select('#replacement-b').classList.values.get('monitor-qualified'),true);
assert.equal(select('#replacement-c').classList.values.get('monitor-qualified'),false);

const reviews=JSON.parse(readFileSync(new URL('../worker/investment-reviews.json',import.meta.url),'utf8'));
const reviewedModel={stocks:Object.entries(reviews.stocks).map(([symbol,value])=>({symbol,...value})),investmentReviewAsOf:reviews.asOf};
const reviewedNodes=new Map();
const node=()=>({children:[],textContent:'',innerHTML:'',classList:{toggle(){}},setAttribute(){},appendChild(child){this.children.push(child)}});
const pick=id=>{if(!reviewedNodes.has(id))reviewedNodes.set(id,node());return reviewedNodes.get(id);};
new Function('model','$','esc','document',source+';renderMonitorRows();')(reviewedModel,pick,String,{createElement:node});
assert.equal(reviewedModel.stocks.length,4);
for(const stock of reviewedModel.stocks){
 assert.equal(stock.longTermReview.status,'pending');
 assert(pick('#review-'+stock.symbol).children.some(n=>n.textContent===stock.longTermReview.evidence[1].finding));
 assert(pick('#replacement-'+stock.symbol).children.some(n=>n.textContent.includes('中国移动')));
 assert(!pick('#replacement-'+stock.symbol).innerHTML.includes('替代候选：'));
}
console.log('PASS: four-stock pending review evidence visible; research candidates never promoted to qualified');
