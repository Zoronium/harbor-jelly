// Headless choreography test: runs the shipped core from index.html for two ship's days.
// node test/choreo.test.mjs
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const src = html.match(/<script id="core">([\s\S]*?)<\/script>/)[1];
const HJ = new Function(src.replace('if (typeof module', 'if (false && typeof module') + '\nreturn HJCore;')();

function run({ castEarlyAt = -1, hurryAt = -1, seconds = 240 } = {}) {
  const S = HJ.create({ seed: 7 });
  const dt = 1 / 60, log = [];
  let minShip = Infinity, minTug = Infinity, maxPen = -Infinity, minGround = Infinity, minCrane = Infinity, maxSim = 0, worst = {};
  const sims = []; let lastPhase = S.phase, cycleStart = 0, cycles = [];
  for (let i = 0; i < seconds / dt; i++) {
    const t = i * dt;
    if (castEarlyAt >= 0 && Math.abs(t - castEarlyAt) < dt / 2) assert.ok(HJ.castOff(S), 'cast off accepted while working');
    if (hurryAt >= 0 && S.phase === 'atSea' && !S.hurry && S.ship.s / S.path.L > 0.2) HJ.castOff(S);
    HJ.step(S, dt);
    if (t > 2) sims.push(S.simMs);
    if (S.phase !== lastPhase) { log.push([+t.toFixed(1), S.phase]); if (S.phase === 'unload') { cycles.push(t - cycleStart); cycleStart = t; } lastPhase = S.phase; }
    const c = HJ.clearance(S);
    if (c.ship < minShip) { minShip = c.ship; worst.ship = [t.toFixed(1), S.phase, c.shipAt]; }
    if (c.tug < minTug) { minTug = c.tug; worst.tug = [t.toFixed(1), S.phase, c.tugAt]; }
    const pushing = S.phase === 'berthing' && S.sub === 2;
    if (!pushing && c.shipTug > maxPen) { maxPen = c.shipTug; worst.pen = [t.toFixed(1), S.phase, S.sub]; }
    minGround = Math.min(minGround, c.ground);
    minCrane = Math.min(minCrane, Math.abs(S.cranes[0].x - S.cranes[1].x));
  }
  sims.sort((a, b) => a - b); maxSim = sims[(sims.length * 0.95) | 0];
  return { S, log, minShip, minTug, maxPen, minGround, minCrane, maxSim, worst, cycles };
}

const r = run();
console.log('phases', r.log.map(l => l.join(':')).join('  '));
console.log({ minShip: r.minShip.toFixed(3), minTug: r.minTug.toFixed(3), shipTugPen: r.maxPen.toFixed(3), ground: r.minGround.toFixed(3), minCrane: r.minCrane.toFixed(3), cycles: r.cycles.map(c => c.toFixed(1)), simMs: r.maxSim.toFixed(2) });
console.log('worst', JSON.stringify(r.worst));

const order = ['load', 'boomsUp', 'tugComing', 'castOff', 'release', 'atSea', 'berthing', 'boomsDown', 'unload'];
assert.deepEqual(r.log.slice(0, 9).map(l => l[1]), order, 'phase order');
assert.ok(r.cycles.length >= 2, 'at least two full days');
for (const c of r.cycles) assert.ok(c > 80 && c < 130, `cycle about 100 s, got ${c.toFixed(1)}`);
assert.ok(r.minShip > 0, `ship clear of quay/breakwater/pier/yachts/buoys (${r.minShip.toFixed(3)})`);
assert.ok(r.minTug > 0, `tug clear (${r.minTug.toFixed(3)})`);
assert.ok(r.maxPen < 0.006, `ship and tug never overlap (${r.maxPen.toFixed(3)})`);
assert.ok(r.minGround > 0, 'no grounding');
assert.ok(r.minCrane >= HJ.CRANE.min - 1e-6, `cranes keep leg width apart (${r.minCrane.toFixed(3)})`);
assert.ok(r.S.boxesMoved >= 32, 'boxes moved over two cycles');
assert.equal(r.S.voyages, r.cycles.length, 'voyage per cycle');

// every box exactly once
const seen = new Set();
for (const b of r.S.shipSlots.flat(2)) if (b >= 0) { assert.ok(!seen.has(b)); seen.add(b); }
for (const b of r.S.yard.flat(2)) { assert.ok(!seen.has(b)); seen.add(b); }
for (const c of r.S.cranes) if (c.carry >= 0) seen.add(c.carry);
assert.equal(seen.size, r.S.boxes.length, 'box bookkeeping');

// cast off early: cranes finish the box in hand, ship leaves sooner
const e = run({ castEarlyAt: 8, seconds: 60 });
const tBooms = e.log.find(l => l[1] === 'boomsUp');
assert.ok(tBooms && tBooms[0] < 25, 'cast off sends her early');
assert.ok(e.S.cranes.every(c => c.carry < 0), 'no box left dangling');
// call her in: hurried voyage
const h = run({ hurryAt: 1, seconds: 130 });
const at = l => (l.find(x => x[1] === 'atSea') || [0])[0], be = l => (l.find(x => x[1] === 'berthing') || [0])[0];
assert.ok(be(h.log) - at(h.log) < be(r.log) - at(r.log) - 4, 'call her in hurries');
assert.ok(h.minShip > 0 && h.minTug > 0, 'hurried voyage still clear');
assert.ok(r.maxSim < 2, `sim p95 under 2 ms (${r.maxSim.toFixed(2)})`);
console.log('choreography OK');
