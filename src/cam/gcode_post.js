// 5-axis post-processor: contact points + surface normals -> G-code (.nc).
//
// Machine model: tool-tilting head ("head-head"), with the tool axis k pointing from the
// tip up into the spindle. Holding the tool perpendicular to the surface means k = N,
// where N is the outward unit surface normal. Table-tilting machines would also need the
// XYZ coordinates rotated by the table motion, which this post does not do.
//
//   BC head (B tilts about Y, C rotates about Z):  k = Rz(C) Ry(B) [0,0,1]
//       Ry(B)[0,0,1] = [sinB, 0, cosB]
//       k = [sinB cosC, sinB sinC, cosB]   =>   B = acos(Nz),  C = atan2(Ny, Nx)
//
//   AC head (A tilts about X, C rotates about Z):  k = Rz(C) Rx(A) [0,0,1]
//       Rx(A)[0,0,1] = [0, -sinA, cosA]
//       k = [sinA sinC, -sinA cosC, cosA]  =>   A = acos(Nz),  C = atan2(Nx, -Ny)
//
// Singularity: at Nz = +-1 the tilt is 0 or 180 deg and C is undefined, so C holds its
// previous value. C is also unwrapped (+-360 deg) to stay nearest the previous C, which
// avoids full-turn flips between neighbouring points.
//
// Tip vs pivot: with TCP on (G43.4) the control compensates for tool length, so XYZ is the
// tool tip. With TCP off, XYZ is the pivot point = tip + L * k, where L is `pivotLength`.

const DEG = 180 / Math.PI;

export const DEFAULT_MACHINE = {
  kinematics: 'BC',   // 'BC' or 'AC'
  feed: 800,          // F for cutting moves, mm/min
  plunge: 300,        // F for the entry move
  spindle: 12000,     // S, rpm
  zSafe: 60,          // retract clearance (machine Z)
  approach: 5,        // entry offset along the tool axis
  tcp: true,          // emit tool-centre-point control
  tcpOn: 'G43.4 H1',
  tcpOff: 'G49',
  pivotLength: 0,     // gauge length for the pivot offset when tcp is false
  maxTiltDeg: 90,     // tilt from vertical is clamped to this
  decimals: 3,
  toolNumber: 1,
  program: 1001,
  percentSigns: true,
};

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

/**
 * Converts a tool axis (surface normal) to rotary angles in degrees.
 * @returns {{tilt:number, c:number}} tilt is B for BC machines and A for AC machines
 */
export function toolAxisToRotary(n, kinematics = 'BC', prevC = 0) {
  const len = Math.hypot(n[0], n[1], n[2]) || 1;
  const nx = n[0] / len, ny = n[1] / len, nz = n[2] / len;
  const tilt = Math.acos(clamp(nz, -1, 1)) * DEG;
  let c;
  if (Math.hypot(nx, ny) < 1e-9) c = prevC;
  else c = (kinematics === 'BC' ? Math.atan2(ny, nx) : Math.atan2(nx, -ny)) * DEG;
  c += 360 * Math.round((prevC - c) / 360);
  return { tilt, c };
}

// Inverse of toolAxisToRotary; used to verify a program and to drive viewports.
export function rotaryToToolAxis(tiltDeg, cDeg, kinematics = 'BC') {
  const t = tiltDeg / DEG, c = cDeg / DEG;
  const s = Math.sin(t);
  return kinematics === 'BC'
    ? [s * Math.cos(c), s * Math.sin(c), Math.cos(t)]
    : [s * Math.sin(c), -s * Math.cos(c), Math.cos(t)];
}

/**
 * Posts passes of {x,y,z,nx,ny,nz} to G-code.
 * Per pass: retract to zSafe, rapid (G00) to the start XY with rotaries set, rapid down to
 * the approach point, plunge-feed (G01) to the surface, cut (G01) along the pass, retract.
 * Only words that changed since the previous block are written (modal output).
 * With simultaneous rotary motion F is the tip feed only when TCP is on.
 */
export function postProcess(passes, options = {}) {
  const m = { ...DEFAULT_MACHINE, ...options };
  if (m.kinematics !== 'BC' && m.kinematics !== 'AC') throw new Error(`unsupported kinematics '${m.kinematics}'`);
  const tiltName = m.kinematics === 'BC' ? 'B' : 'A';
  const live = passes.filter(p => p.length > 0);
  if (!live.length) throw new Error('no toolpath points to post');

  let maxZ = -Infinity;
  for (const pass of live) for (const p of pass) maxZ = Math.max(maxZ, p.z);
  const clearance = maxZ + m.approach + (m.tcp ? 0 : m.pivotLength);
  if (m.zSafe <= clearance) throw new Error(`zSafe ${m.zSafe} must exceed ${clearance.toFixed(3)} (highest point + approach)`);

  const fmt = v => { const s = v.toFixed(m.decimals); return /^-0(\.0+)?$/.test(s) ? s.slice(1) : s; };
  const out = [];
  const last = {};
  let lastG = null;
  const block = (g, words) => {
    const parts = [];
    if (g !== lastG) { parts.push(g); lastG = g; }
    for (const [k, v] of Object.entries(words)) {
      const s = fmt(v);
      if (last[k] !== s) { last[k] = s; parts.push(k + s); }
    }
    if (parts.length) out.push(parts.join(' '));
  };

  let prevC = 0, clamped = 0, maxTilt = 0, cutLength = 0, points = 0, cutMoves = 0;
  const bounds = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];

  // Machine pose for a contact point offset by `lift` along the tool axis.
  const pose = (p, lift, count = true) => {
    const n = [p.nx, p.ny, p.nz];
    let { tilt, c } = toolAxisToRotary(n, m.kinematics, prevC);
    if (tilt > m.maxTiltDeg) { tilt = m.maxTiltDeg; if (count) clamped++; }
    prevC = c;
    maxTilt = Math.max(maxTilt, tilt);
    const k = rotaryToToolAxis(tilt, c, m.kinematics); // clamped axis, so the offset matches the output
    const d = lift + (m.tcp ? 0 : m.pivotLength);
    return { x: p.x + k[0] * d, y: p.y + k[1] * d, z: p.z + k[2] * d, tilt, c };
  };
  const axes = q => ({ X: q.x, Y: q.y, Z: q.z, [tiltName]: q.tilt, C: q.c });

  out.push(`O${m.program}`);
  out.push(`(PRIMORDIAOS 5-AXIS POST ${m.kinematics} HEAD ${m.tcp ? 'TCP' : 'PIVOT ' + fmt(m.pivotLength)})`);
  out.push('G90 G94 G21 G17 G40 G49 G80');
  out.push('G54');
  out.push(`T${m.toolNumber} M06`);
  out.push(`S${Math.round(m.spindle)} M03`);
  if (m.tcp) out.push(m.tcpOn);
  block('G00', { Z: m.zSafe });

  for (const pass of live) {
    const first = pose(pass[0], 0);
    block('G00', { X: first.x, Y: first.y, [tiltName]: first.tilt, C: first.c });
    const above = pose(pass[0], m.approach, false);
    block('G00', { X: above.x, Y: above.y, Z: above.z });
    block('G01', { ...axes(first), F: m.plunge });
    let prev = pass[0];
    for (let i = 0; i < pass.length; i++) {
      const p = pass[i];
      const q = pose(p, 0);
      if (i > 0) {
        cutLength += Math.hypot(p.x - prev.x, p.y - prev.y, p.z - prev.z);
        block('G01', { ...axes(q), F: m.feed });
        cutMoves++;
      }
      points++;
      bounds[0] = Math.min(bounds[0], p.x); bounds[1] = Math.min(bounds[1], p.y); bounds[2] = Math.min(bounds[2], p.z);
      bounds[3] = Math.max(bounds[3], p.x); bounds[4] = Math.max(bounds[4], p.y); bounds[5] = Math.max(bounds[5], p.z);
      prev = p;
    }
    block('G00', { Z: m.zSafe });
  }

  if (m.tcp) out.push(m.tcpOff);
  out.push('M05');
  out.push('M30');
  if (m.percentSigns) { out.unshift('%'); out.push('%'); }

  return {
    gcode: out.join('\n') + '\n',
    stats: {
      lines: out.length,
      passes: live.length,
      points,
      cutMoves,
      cutLength,
      estimatedMinutes: cutLength / m.feed,
      maxTiltDeg: maxTilt,
      clampedPoints: clamped,
      bounds,
    },
  };
}

// Machine poses for every point, for streaming to viewports: [{x,y,z,tilt,c,nx,ny,nz}, ...] per pass.
export function toolPoses(passes, kinematics = 'BC') {
  let prevC = 0;
  return passes.map(pass => pass.map(p => {
    const r = toolAxisToRotary([p.nx, p.ny, p.nz], kinematics, prevC);
    prevC = r.c;
    return { x: p.x, y: p.y, z: p.z, tilt: r.tilt, c: r.c, nx: p.nx, ny: p.ny, nz: p.nz };
  }));
}
