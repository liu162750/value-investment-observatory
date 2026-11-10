import assert from 'node:assert/strict';
import {evaluateCapitalFlow} from '../worker/dashboard.js';

const dates=['2026-11-05','2026-11-06','2026-11-09'];
const rows=['2026-11-05,1,0,0,0,0','2026-11-06,-2,0,0,0,0','2026-11-09,3,0,0,0,0'];
const mixed=evaluateCapitalFlow(rows,dates,'2026-11-09T08:00:00.000Z');
assert.equal(mixed.status,'ok');
assert.equal(mixed.positiveDays,2);
assert.equal(mixed.consecutivePositive,false);
assert.equal(mixed.asOf,'2026-11-09');
assert.match(mixed.classification,/非真实机构账户/);
assert.equal(evaluateCapitalFlow(['2026-11-06,-2,0,0,0,0','2026-11-09,3,0,0,0,0'],dates).status,'pending');
assert.equal(evaluateCapitalFlow(rows,['2026-11-06','2026-11-09']).status,'pending');
console.log('PASS: capital-flow streak requires three aligned complete sessions and remains labeled as provider estimate');
