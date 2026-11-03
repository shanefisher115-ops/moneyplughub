#!/usr/bin/env node
// PrimordiaOS CAM CLI: sample an SDF scene and post 5-axis G-code.
//
//   node src/cam/cam_cli.js --scene sphere_torus --out out/sphere_torus.nc
//   node src/cam/cam_cli.js --scene sphere_torus --cloud out/part.xyz --sync   (live viewport bus)

import { parseArgs } from 'node:util';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { SCENES } from './sdf_lib.js';
import { sampleIsoPoints, rasterToolpath } from './sdf_sampler.js';
import { postProcess, toolPoses } from './gcode_post.js';
import { ViewportSync } from '../bridge/viewport_sync.js';

const HELP = `usage: cam_cli.js [options]
  --scene <name>     ${Object.keys(SCENES).join(' | ')} (default sphere_torus)
  --bounds a,b,c,d,e,f   override xmin,ymin,zmin,xmax,ymax,zmax (mm)
  --res <mm>         point-cloud grid cell (default 2)
  --stepover <mm>    raster line spacing (default 1.5)
  --step <mm>        point spacing along a line (default 0.75)
  --out <file>       G-code output (default primordia_part.nc)
  --cloud <file>     also write the point cloud as "x y z nx ny nz"
  --kin BC|AC        rotary axes of the tilting head (default BC)
  --feed --plunge --spindle --zsafe --approach   machine parameters
  --pivot <mm>       gauge length; if set, TCP is off and XYZ is the pivot point
  --sync             stream to UDP 9021 (UE5) and WebSocket 9022 (viewport); Ctrl+C to stop
  --udp-host --udp-port --ws-port --hz`;

const { values: v } = parseArgs({
  options: {
    scene: { type: 'string', default: 'sphere_torus' }, bounds: { type: 'string' },
    res: { type: 'string', default: '2' }, stepover: { type: 'string', default: '1.5' }, step: { type: 'string', default: '0.75' },
    out: { type: 'string', default: 'primordia_part.nc' }, cloud: { type: 'string' },
    kin: { type: 'string', default: 'BC' }, feed: { type: 'string', default: '800' }, plunge: { type: 'string', default: '300' },
    spindle: { type: 'string', default: '12000' }, zsafe: { type: 'string', default: '60' }, approach: { type: 'string', default: '5' },
    pivot: { type: 'string', default: '0' }, sync: { type: 'boolean', default: false },
    'udp-host': { type: 'string', default: '127.0.0.1' }, 'udp-port': { type: 'string', default: '9021' },
    'ws-port': { type: 'string', default: '9022' }, hz: { type: 'string', default: '200' },
    help: { type: 'boolean', default: false },
  },
});

if (v.help) { console.log(HELP); process.exit(0); }
const scene = SCENES[v.scene];
if (!scene) { console.error(`unknown scene '${v.scene}'\n${HELP}`); process.exit(1); }
const bounds = v.bounds ? v.bounds.split(',').map(Number) : scene.bounds;
if (bounds.length !== 6 || bounds.some(Number.isNaN)) { console.error('--bounds needs six numbers'); process.exit(1); }

const t0 = performance.now();
const cloud = sampleIsoPoints(scene.sdf, bounds, { cell: +v.res });
const passes = rasterToolpath(scene.sdf, bounds, { stepover: +v.stepover, step: +v.step });
const pivot = +v.pivot;
const { gcode, stats } = postProcess(passes, {
  kinematics: v.kin.toUpperCase(), feed: +v.feed, plunge: +v.plunge, spindle: +v.spindle,
  zSafe: +v.zsafe, approach: +v.approach, tcp: !(pivot > 0), pivotLength: pivot,
});

mkdirSync(dirname(v.out) || '.', { recursive: true });
writeFileSync(v.out, gcode);
if (v.cloud) {
  mkdirSync(dirname(v.cloud) || '.', { recursive: true });
  const rows = [];
  for (let i = 0; i < cloud.count; i++) {
    const j = i * 3;
    rows.push([...cloud.points.subarray(j, j + 3), ...cloud.normals.subarray(j, j + 3)].map(x => x.toFixed(4)).join(' '));
  }
  writeFileSync(v.cloud, rows.join('\n') + '\n');
}

console.log(`scene ${v.scene}: ${cloud.count} iso-surface points, ${stats.passes} passes, ${stats.points} toolpath points`);
console.log(`wrote ${v.out} (${stats.lines} lines) | cut ${stats.cutLength.toFixed(1)} mm | ~${stats.estimatedMinutes.toFixed(1)} min @ F${v.feed} | max tilt ${stats.maxTiltDeg.toFixed(1)} deg | clamped ${stats.clampedPoints}`);
console.log(`done in ${(performance.now() - t0).toFixed(0)} ms`);

if (v.sync) {
  const sync = new ViewportSync({ udpHost: v['udp-host'], udpPort: +v['udp-port'], wsPort: +v['ws-port'] });
  const info = await sync.start();
  const poses = toolPoses(passes, v.kin.toUpperCase());
  sync.publishScene({ mesh: cloud, toolpaths: poses });
  console.log(`viewport bus: WebSocket ws://127.0.0.1:${info.wsPort}, UDP ${info.udpHost}:${info.udpPort}. Streaming tool poses; Ctrl+C to stop.`);
  process.on('SIGINT', async () => { await sync.close(); process.exit(0); });
  for (;;) await sync.streamPoses(poses.flat(), { hz: +v.hz }); // loops so late-joining viewports see motion
}
