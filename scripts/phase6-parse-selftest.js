/**
 * Quick self-test for shared Claude JSON parsing (no API, no DB).
 * Run: node scripts/phase6-parse-selftest.js
 */
const { parseModelJson } = require('../lib/claudeJson');

const o1 = parseModelJson('Sure. Here you go: {"claim_present":true,"n":1} thanks.');
if (o1.claim_present !== true || o1.n !== 1) throw new Error('embedded json fail');

const o2 = parseModelJson('```json\n{"a":2}\n```');
if (o2.a !== 2) throw new Error('fence fail');

console.log('phase6-parse-selftest: ok');
