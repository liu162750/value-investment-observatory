import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const page=readFileSync(new URL('../worker/page.html',import.meta.url),'utf8');
const source=page.slice(page.indexOf('function confirmedReplacement('),page.indexOf('function accountDayChange('));
function render(stocks,industryReview){const nodes=new Map();const $=id=>{if(!nodes.has(id))nodes.set(id,{});return nodes.get(id);};new Function('model','$','esc',source+';renderThesisAlerts();')({stocks,industryReview},$,String);return {summary:$('#monitor-status').textContent,html:$('#thesis-alerts').innerHTML};}
const pending=render([{name:'持仓',longTermReview:{status:'pending'},replacementReview:{status:'pending',candidate:{name:'不应显示'},reason:'未确认研究'}}]);
assert(pending.summary.includes('暂无已确认换股需要'));
assert(!pending.html.includes('不应显示')&&!pending.html.includes('未确认研究'));
assert(pending.html.includes('待核验不等于全部通过'));
const qualified={status:'qualified',candidate:{name:'确认候选',symbol:'sample'},reason:'已核验比较',asOf:'2026-10-23',source:'https://example.test/report'};
assert(render([{name:'持仓',replacementReview:qualified}]).html.includes('确认候选'));
assert(!render([{replacementReview:{...qualified,source:null}}]).html.includes('确认候选'));
assert(render([{name:'风险持仓',longTermReview:{status:'invalidated',reason:'现金持续恶化'}}]).html.includes('现金持续恶化'));
assert(render([], {status:'invalidated',reason:'行业失效'}).html.includes('行业失效'));
assert(page.indexOf('id="replacement-monitor"')>page.indexOf('id="cards"'));
assert(!page.slice(page.indexOf('id="replacement-monitor"'),page.indexOf('</main>')).includes('<table>'));
console.log('PASS: compact bottom monitor hides unconfirmed candidates and surfaces confirmed replacements or invalidations');
