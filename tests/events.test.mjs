import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const page=readFileSync(new URL('../worker/page.html',import.meta.url),'utf8');
const source=page.slice(page.indexOf('function eventDays('),page.indexOf('function newsListHTML('));
const {eventDays,importantEventsHTML}=new Function('esc',source+';return {eventDays,importantEventsHTML};')(String);
const event={name:'样例',title:'三季报预约披露',date:'2026-10-22',sourceUrl:'https://example.test/'};
const at=date=>Date.parse(date+'T23:00:00+08:00');
assert.equal(eventDays(event.date,at('2026-10-15')),7);
assert(importantEventsHTML({events:[event]},at('2026-10-15')).includes('event-title-alert'));
assert(!importantEventsHTML({events:[event]},at('2026-10-14')).includes('event-title-alert'));
assert(!importantEventsHTML({events:[event]},at('2026-10-23')).includes('event-title-alert'));
assert(!importantEventsHTML({events:[{...event,actualDate:event.date}]},at('2026-10-22')).includes('event-title-alert'));
assert.equal(eventDays('unknown',at('2026-10-15')),null);
console.log('PASS: 7-day event reminder, before window, past event, actual disclosure, invalid date');

assert.equal(importantEventsHTML({events:[event]},at('2026-10-14')),'');
assert(!page.includes('<aside class="important-events"'));
