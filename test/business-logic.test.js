// Regression tests for Ytel_Daily_Monitor_v2.html's pure business-logic helpers.
//
// These functions are extracted DIRECTLY from the live HTML file (balanced-brace scan, not a
// copy pasted into this test) so there is zero drift risk — if someone edits stateOf() or
// bumpBracket() in the dashboard, this test runs against the new source automatically.
//
// Each fixture below encodes a real bug that shipped to production and was only caught by a
// human noticing a wrong number in a live report (see Ytel_Daily_Monitor_v2.html's CLAUDE.md
// changelog, "July 2026" entries). The point of this file is that the next regression fails
// here instead of in front of a customer/agent.
//
// Run: node test/business-logic.test.js

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const HTML_PATH = path.join(__dirname, '..', 'Ytel_Daily_Monitor_v2.html');
const html = fs.readFileSync(HTML_PATH, 'utf8');

// Extracts a top-level `function NAME(...){ ... }` from the HTML's inline <script> via a
// balanced-brace scan (robust to nested if/else blocks; the naive regex used by the repo's
// syntax-check one-liner isn't safe for functions with nested braces like bumpBracket()).
function extractFunction(src, name) {
  const marker = 'function ' + name + '(';
  const start = src.indexOf(marker);
  if (start === -1) throw new Error('function not found in ' + HTML_PATH + ': ' + name);
  const braceStart = src.indexOf('{', start);
  let depth = 0, i = braceStart;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  return src.slice(start, i);
}

const FN_NAMES = ['stateOf', 'normWaitingPayment', 'isAlreadyEnrolledElsewhere', 'bumpBracket', 'bumpCampBracket'];
const source = FN_NAMES.map(n => extractFunction(html, n)).join('\n\n');
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(source, sandbox);
const { stateOf, normWaitingPayment, isAlreadyEnrolledElsewhere, bumpBracket, bumpCampBracket } = sandbox;
FN_NAMES.forEach(n => assert.ok(typeof sandbox[n] === 'function', 'failed to extract function: ' + n));

let passed = 0, failed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  ok -', name);
  } catch (err) {
    failed++;
    console.log('  FAIL -', name);
    console.log('   ', err.message);
  }
}

console.log('stateOf() — State/CRM_State column fallback (CA escrow bug, July 2026)');
test('reads State when present', () => {
  assert.strictEqual(stateOf({ State: 'CA' }), 'CA');
});
test('falls back to CRM_State when State is missing — the actual bug: only State was read', () => {
  assert.strictEqual(stateOf({ CRM_State: 'CA' }), 'CA');
});
test('State wins when both columns are populated', () => {
  assert.strictEqual(stateOf({ State: 'TX', CRM_State: 'CA' }), 'TX');
});
test('trims whitespace', () => {
  assert.strictEqual(stateOf({ State: '  CA  ' }), 'CA');
});
test('returns empty string when neither column exists', () => {
  assert.strictEqual(stateOf({}), '');
});

console.log('\nnormWaitingPayment() — snake_case/spaced CRM Status bug (July 2026)');
test('normalizes snake_case — the actual bug: only the spaced form matched', () => {
  assert.strictEqual(normWaitingPayment('waiting_for_first_payment'), 'waiting for first payment');
});
test('normalizes the already-spaced form', () => {
  assert.strictEqual(normWaitingPayment('Waiting for First Payment'), 'waiting for first payment');
});
test('collapses repeated whitespace', () => {
  assert.strictEqual(normWaitingPayment('waiting   for  first_payment'), 'waiting for first payment');
});
test('does not match an unrelated status', () => {
  assert.notStrictEqual(normWaitingPayment('approved'), 'waiting for first payment');
});

console.log('\nisAlreadyEnrolledElsewhere() — Conv% denominator exclusion bug (July 2026)');
test('excludes a phone enrolled in a different report window — the actual bug scenario', () => {
  const anyEnrolledPhone = new Set(['5551234567']);
  const enrolledPhoneAgent = {}; // no credit landed for the CURRENT range
  assert.strictEqual(isAlreadyEnrolledElsewhere('5551234567', anyEnrolledPhone, enrolledPhoneAgent), true);
});
test('does not exclude a phone that enrolled within the current range', () => {
  const anyEnrolledPhone = new Set(['5551234567']);
  const enrolledPhoneAgent = { '5551234567': { agent: 'jane', debt: 1000 } };
  assert.strictEqual(isAlreadyEnrolledElsewhere('5551234567', anyEnrolledPhone, enrolledPhoneAgent), false);
});
test('does not exclude a phone with no enrollment signal at all', () => {
  const anyEnrolledPhone = new Set();
  const enrolledPhoneAgent = {};
  assert.strictEqual(isAlreadyEnrolledElsewhere('5551234567', anyEnrolledPhone, enrolledPhoneAgent), false);
});
test('handles an empty phone safely', () => {
  assert.strictEqual(isAlreadyEnrolledElsewhere('', new Set(['x']), {}), false);
});

console.log('\nbumpBracket() — shared agentMap/agentDirMap/agentCampDataMap accumulator');
function emptyBracketStats() {
  return { calls: 0, short: 0, sec: 0, lt2m: 0, gt2m: 0, r1to2m: 0, r5to10: 0, r10to15: 0, r15to20: 0, r20to30: 0, gt30m: 0,
    phones: new Set(), phonesGt2m: new Set(),
    funnelRecords: { short: [], lt2m: [], r1to2m: [], r5to10: [], r10to15: [], r15to20: [], r20to30: [], gt30m: [] } };
}
test('buckets a short call (<=30s) into short + lt2m and records it with its debt', () => {
  const d = emptyBracketStats();
  const r = { _sec: 12, _phone: '5550001111' };
  bumpBracket(d, r, () => ({ phone: r._phone, debt: 250 }), false);
  assert.strictEqual(d.calls, 1);
  assert.strictEqual(d.short, 1);
  assert.strictEqual(d.lt2m, 1);
  assert.strictEqual(d.funnelRecords.short.length, 1);
  assert.strictEqual(d.funnelRecords.short[0].debt, 250, 'the July 2026 bug: debt hardcoded to 0 in one of the 3 duplicated copies');
  assert.ok(d.phones.has('5550001111'));
});
test('a call >=120s counts toward gt2m but NOT phonesGt2m when excluded (already-enrolled-elsewhere)', () => {
  const d = emptyBracketStats();
  const r = { _sec: 400, _phone: '5550002222' };
  bumpBracket(d, r, () => ({ phone: r._phone }), true /* excludeFromGt2m */);
  assert.strictEqual(d.gt2m, 1, 'gt2m should still count the call');
  assert.strictEqual(d.phonesGt2m.has('5550002222'), false, 'phonesGt2m should exclude it — this is the Conv% denominator fix');
  assert.strictEqual(d.r5to10, 1);
});
test('a call >=120s adds to phonesGt2m when not excluded', () => {
  const d = emptyBracketStats();
  const r = { _sec: 400, _phone: '5550003333' };
  bumpBracket(d, r, () => ({ phone: r._phone }), false);
  assert.ok(d.phonesGt2m.has('5550003333'));
});
test('30+ minute call lands in gt30m only (mutually exclusive else-if chain)', () => {
  const d = emptyBracketStats();
  const r = { _sec: 2000, _phone: '5550004444' };
  bumpBracket(d, r, () => ({ phone: r._phone }), false);
  assert.strictEqual(d.gt30m, 1);
  assert.strictEqual(d.r20to30, 0);
  assert.strictEqual(d.r10to15, 0);
});

console.log('\nbumpCampBracket() — shared campMap/campDirMap accumulator');
function emptyCampStats() {
  return { calls: 0, short: 0, sec: 0, lt2m: 0, gt2m: 0, r5to10: 0, r10to15: 0, r15to20: 0, r20to30: 0, gt30m: 0,
    drops: 0, enroll: 0, phonesGt2m: new Set(), enrolledPhones: new Set(), phones: new Set(), phonesContacted: new Set() };
}
test('a DROP call increments drops', () => {
  const d = emptyCampStats();
  bumpCampBracket(d, { _sec: 45, _phone: '5550005555', _status: 'DROP' });
  assert.strictEqual(d.drops, 1);
});
test('a call over 30s counts as contacted, a call at or under 30s does not', () => {
  const d = emptyCampStats();
  bumpCampBracket(d, { _sec: 31, _phone: '5550006666', _status: '' });
  bumpCampBracket(d, { _sec: 30, _phone: '5550007777', _status: '' });
  assert.strictEqual(d.phonesContacted.size, 1);
  assert.ok(d.phonesContacted.has('5550006666'));
});
test('an enrolled row credits enroll + enrolledPhones', () => {
  const d = emptyCampStats();
  bumpCampBracket(d, { _sec: 600, _phone: '5550008888', _status: '', _enrolled: true });
  assert.strictEqual(d.enroll, 1);
  assert.ok(d.enrolledPhones.has('5550008888'));
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed > 0) process.exit(1);
