import test from 'node:test';
import assert from 'node:assert/strict';
import { cruiseOver, diversifyOver, followSpeed, blockingPacks, shearPack, LANE_OVER } from './traffic.js';

const MPH = 0.44704;
const lim = 70 * MPH;

test('a comfortable gap keeps the follower on its own cruise', () => {
  const cruise = lim + 10 * MPH;
  const leadV = lim + 1 * MPH;
  const r = followSpeed({ cruise, lim, clear: 12, leadV, egoLead: false, opening: false, beside: false, moto: false });
  assert.ok(r.vt > lim + 8 * MPH, `expected own cruise, got ${r.vt}`);
  assert.equal(r.opening, false);
});

test('a tight gap falls back instead of locking to the leader', () => {
  const leadV = lim + 2 * MPH;
  const r = followSpeed({ cruise: lim + 12 * MPH, lim, clear: 4, leadV, egoLead: false, opening: false, beside: false, moto: false });
  assert.ok(r.vt < leadV - 1, `expected slower than leader, got ${r.vt}`);
  assert.equal(r.opening, true);
});

test('same-lane follower does not stay glued to the leader speed', () => {
  const leadV = lim + 1 * MPH;
  let sL = 100, sF = 100 - 4.8 - 6, vF = leadV, opening = false, maxDiff = 0;
  for (let i = 0; i < 8 * 30; i++) {
    const clear = (sL - sF) - 4.8;
    const r = followSpeed({ cruise: lim + 12 * MPH, lim, clear, leadV, egoLead: false, opening, beside: false, moto: false });
    opening = r.opening;
    const dt = 1 / 30;
    vF += Math.max(-10 * dt, Math.min(4 * dt, r.vt - vF));
    sL += leadV * dt;
    sF += vF * dt;
    maxDiff = Math.max(maxDiff, Math.abs(vF - leadV));
  }
  assert.ok(maxDiff > 2, `speed never diverged (max diff ${maxDiff.toFixed(2)} m/s)`);
});

test('an open lane is not a blocking pack', () => {
  const cars = [0, 1].map(lane => ({ s: 200, lane, v: lim, over: 1, type: 'sedan' }));
  assert.equal(blockingPacks(cars, () => 3).length, 0);
});

test('a full-width pack gets different speeds and drifts apart', () => {
  const base = (70 + 1) * MPH;
  const cars = [0, 1, 2].map(lane => ({ s: 200, lane, d: (lane + 0.5) * 3.7, v: base, over: 1, type: 'sedan' }));
  const packs = blockingPacks(cars, () => 3);
  assert.equal(packs.length, 1);
  assert.equal(shearPack(packs[0], { now: 1000, limitMph: 70, playerS: 100, playerD: 5, playerV: base }), true);
  const mph = cars.map(c => c.v / MPH);
  assert.ok(Math.max(...mph) - Math.min(...mph) >= 6, `spread ${mph}`);
  assert.deepEqual(cars.map(c => c.over), LANE_OVER.slice(0, 3));
  for (let t = 0; t < 4; t += 0.05) for (const c of cars) c.s += c.v * 0.05;
  const ss = cars.map(c => c.s);
  assert.ok(Math.max(...ss) - Math.min(...ss) > 15, `only separated ${Math.max(...ss) - Math.min(...ss)} m`);
});

test('shear does not brake-check the car directly in front of a fast player', () => {
  const playerV = 100 * MPH;
  const cars = [0, 1, 2].map(lane => ({ s: 120, lane, d: (lane + 0.5) * 3.7, v: lim, over: 0, type: 'sedan' }));
  const playerD = (1 + 0.5) * 3.7;
  assert.equal(shearPack(cars, { now: 1, limitMph: 70, playerS: 110, playerD, playerV }), true);
  assert.ok(cars[1].v > lim, 'lane in front of the player should not be dropped');
  const mph = cars.map(c => c.v / MPH);
  assert.ok(Math.max(...mph) - Math.min(...mph) >= 6, `spread collapsed ${mph}`);
});

test('a second shear during the hold does not reshuffle a still-tight pack', () => {
  const cars = [0, 1, 2].map(lane => ({ s: 200, lane, d: (lane + 0.5) * 3.7, v: lim, over: 1, type: 'sedan' }));
  shearPack(cars, { now: 1000, limitMph: 70, playerS: 0, playerD: 0, playerV: lim });
  const overs = cars.map(c => c.over);
  for (const c of cars) c.v = lim;
  assert.equal(shearPack(cars, { now: 1500, limitMph: 70, playerS: 0, playerD: 0, playerV: lim }), false);
  assert.deepEqual(cars.map(c => c.over), overs);
});

test('diversify rerolls a cruise that matches the car alongside', () => {
  let k = 0;
  const values = [0.5, 0.2, 0.9, 0];
  const rnd = () => values[k++];
  const over = diversifyOver('sedan', 100, 1, [{ s: 100, lane: 0, over: 4 }], rnd);
  assert.equal(over, 9);
  assert.notEqual(cruiseOver('moto', () => 0), cruiseOver('sedan', () => 0));
});
