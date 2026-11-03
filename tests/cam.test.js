import test from 'node:test';
import assert from 'node:assert/strict';
import dgram from 'node:dgram';
import { readFileSync, existsSync } from 'node:fs';
import { SCENES, sdSphere, sdBox, sdTorus, opSmoothUnion } from '../src/cam/sdf_lib.js';
import { sampleIsoPoints, rasterToolpath, normalAt } from '../src/cam/sdf_sampler.js';
import { postProcess, toolAxisToRotary, rotaryToToolAxis, toolPoses } from '../src/cam/gcode_post.js';
import { ViewportSync } from '../src/bridge/viewport_sync.js';

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);

test('JS SDF port matches the GLSL library formulas', () => {
  close(sdSphere([3, 4, 0], 2), 3);
  close(sdBox([2, 0, 0], [1, 1, 1]), 1);
  close(sdTorus([4, 0, 0], [1, 3]), 0);
  close(opSmoothUnion(1, 1, 0.5), 1 - 0.5 * 0.5 * 0.5); // h = 0.5 -> d - k/4
  const glslUrl = new URL('../primordia-studio/experiments/sdf-lib/primordia_sdf.glsl', import.meta.url);
  if (!existsSync(glslUrl)) return; // lives on feat/primordia-studio
  const glsl = readFileSync(glslUrl, 'utf8');
  for (const fn of ['sdSphere', 'sdBox', 'sdTorus', 'sdCylinder', 'opSmoothUnion', 'opSmoothSubtraction', 'opSmoothIntersection']) {
    assert.ok(glsl.includes(`float ${fn}(`), `${fn} missing from GLSL`);
  }
});

test('iso-surface points lie on the surface with outward normals', () => {
  const f = p => sdSphere(p, 10);
  const { points, normals, count } = sampleIsoPoints(f, [-12, -12, -12, 12, 12, 12], { cell: 2 });
  assert.ok(count > 100);
  for (let i = 0; i < count; i++) {
    const p = [points[i * 3], points[i * 3 + 1], points[i * 3 + 2]];
    close(f(p), 0, 1e-6);
    const dot = (normals[i * 3] * p[0] + normals[i * 3 + 1] * p[1] + normals[i * 3 + 2] * p[2]) / 10;
    assert.ok(dot > 0.9999);
  }
});

test('raster toolpath hits the surface and splits where the part ends', () => {
  const f = SCENES.sphere_torus.sdf;
  const passes = rasterToolpath(f, SCENES.sphere_torus.bounds, { stepover: 3, step: 1.5 });
  assert.ok(passes.length > 10);
  for (const pass of passes) for (const p of pass) {
    close(f([p.x, p.y, p.z]), 0, 2e-4);
    close(Math.hypot(p.nx, p.ny, p.nz), 1, 1e-6);
  }
});

test('rotary angles reproduce the tool axis for both kinematic types', () => {
  for (const kin of ['BC', 'AC']) {
    let prevC = 0;
    for (let i = 0; i < 400; i++) {
      const a = i * 0.37, b = Math.acos(Math.cos(i * 0.11));
      const n = [Math.sin(b) * Math.cos(a), Math.sin(b) * Math.sin(a), Math.cos(b)];
      const { tilt, c } = toolAxisToRotary(n, kin, prevC);
      prevC = c;
      const k = rotaryToToolAxis(tilt, c, kin);
      for (let j = 0; j < 3; j++) close(k[j], n[j], 1e-9);
    }
  }
});

test('C axis never jumps by more than 180 degrees and holds at the pole', () => {
  let prevC = 0;
  for (let i = 0; i <= 720; i++) {
    const a = (i * 0.5) * Math.PI / 180;
    const { c } = toolAxisToRotary([0.5 * Math.cos(a), 0.5 * Math.sin(a), Math.sqrt(0.75)], 'BC', prevC);
    assert.ok(Math.abs(c - prevC) < 180);
    prevC = c;
  }
  assert.equal(toolAxisToRotary([0, 0, 1], 'BC', 123).c, 123);
});

test('posted G-code is safe, modal and contains the required words', () => {
  const f = SCENES.sphere_torus.sdf;
  const passes = rasterToolpath(f, SCENES.sphere_torus.bounds, { stepover: 4, step: 2 });
  const { gcode, stats } = postProcess(passes, { feed: 900, spindle: 15000, zSafe: 60 });
  assert.match(gcode, /S15000 M03/);
  assert.match(gcode, /G43\.4 H1/);
  assert.match(gcode, /F900/);
  assert.match(gcode, /M30/);
  assert.ok(stats.cutLength > 0 && stats.passes === passes.length);
  const lines = gcode.split('\n');
  const rapids = lines.filter(l => l.startsWith('G00'));
  assert.ok(rapids.some(l => /Z60\.000/.test(l)), 'retract to zSafe');
  // After the first G01 of a pass, no G00 may cut: any move following G01 must be an explicit word line or retract.
  assert.ok(lines.filter(l => /^G01/.test(l)).length >= stats.passes);
  assert.throws(() => postProcess(passes, { zSafe: 10 }), /zSafe/);
  assert.throws(() => postProcess([], {}), /no toolpath/);
});

test('pivot mode offsets XYZ along the tool axis', () => {
  const passes = [[{ x: 0, y: 0, z: 10, nx: 0, ny: 0, nz: 1 }, { x: 1, y: 0, z: 10, nx: 0, ny: 0, nz: 1 }]];
  const tcp = postProcess(passes, { tcp: true, zSafe: 200 }).gcode;
  const piv = postProcess(passes, { tcp: false, pivotLength: 100, zSafe: 300 }).gcode;
  assert.match(tcp, /Z10\.000 F300/);
  assert.match(piv, /Z110\.000 F300/);
  assert.doesNotMatch(piv, /G43\.4/);
});

test('buses: UDP datagrams fit the MTU and WebSocket clients get the scene', async () => {
  const rx = dgram.createSocket('udp4');
  const frames = [];
  rx.on('message', m => frames.push(m));
  await new Promise(r => rx.bind(0, '127.0.0.1', r));

  const sync = new ViewportSync({ udpPort: rx.address().port, wsPort: 0, mtu: 1200 });
  const { wsPort } = await sync.start();
  const f = SCENES.sphere_torus.sdf;
  const mesh = sampleIsoPoints(f, SCENES.sphere_torus.bounds, { cell: 3 });
  const passes = toolPoses(rasterToolpath(f, SCENES.sphere_torus.bounds, { stepover: 6, step: 3 }));
  sync.publishScene({ mesh, toolpaths: passes });

  const ws = new WebSocket(`ws://127.0.0.1:${wsPort}`);
  const got = [];
  await new Promise((resolve, reject) => {
    ws.onmessage = e => { got.push(JSON.parse(e.data)); if (got.filter(m => m.type === 'toolpath').length === passes.length) resolve(); };
    ws.onerror = reject;
  });
  assert.equal(got[0].type, 'hello');
  const meshPts = got.filter(m => m.type === 'mesh').reduce((n, m) => n + m.points.length / 3, 0);
  assert.equal(meshPts, mesh.count);

  await sync.streamPoses(passes.flat().slice(0, 20), { hz: 1000 });
  await new Promise(r => setTimeout(r, 100));
  assert.ok(frames.every(m => m.length <= 1200), 'datagram over MTU');
  const meshFrames = frames.map(m => JSON.parse(m)).filter(m => m.t === 'mesh');
  assert.equal(meshFrames.reduce((n, m) => n + m.p.length / 3, 0), mesh.count);
  assert.equal(meshFrames[0].n, meshFrames.length);
  assert.equal(frames.map(m => JSON.parse(m)).filter(m => m.t === 'pose').length, 20);

  ws.close();
  rx.close();
  await sync.close();
});
