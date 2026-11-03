// SDF sampler: turns a signed distance function into surface data for CAM.
//   sampleIsoPoints  - zero-isosurface point cloud + normals (grid edge crossings, Newton-projected)
//   rasterToolpath   - ordered top-down raster passes (sphere-traced drop rays) with normals
//
// Conventions: f(p) takes [x, y, z] and returns the signed distance (negative inside).
// The surface normal is the normalized gradient, n = grad f / |grad f|, which points
// outward (toward increasing f). Bounds are [xmin, ymin, zmin, xmax, ymax, zmax].

const GRAD_H = 1e-4;

// Central-difference gradient: df/dx ~ (f(x+h) - f(x-h)) / 2h, likewise for y and z.
export function gradient(f, p, h = GRAD_H) {
  const inv = 1 / (2 * h);
  return [
    (f([p[0] + h, p[1], p[2]]) - f([p[0] - h, p[1], p[2]])) * inv,
    (f([p[0], p[1] + h, p[2]]) - f([p[0], p[1] - h, p[2]])) * inv,
    (f([p[0], p[1], p[2] + h]) - f([p[0], p[1], p[2] - h])) * inv,
  ];
}

export function normalAt(f, p, h = GRAD_H) {
  const g = gradient(f, p, h);
  const l = Math.hypot(g[0], g[1], g[2]);
  return l < 1e-12 ? [0, 0, 1] : [g[0] / l, g[1] / l, g[2] / l];
}

// Newton step toward f = 0 along the gradient: p <- p - f(p) * g / |g|^2.
// Exact for a true SDF (|g| = 1); still converges for mildly non-exact fields.
export function projectToSurface(f, p, iters = 3) {
  let q = p;
  for (let i = 0; i < iters; i++) {
    const d = f(q);
    if (Math.abs(d) < 1e-9) break;
    const g = gradient(f, q);
    const gg = g[0] * g[0] + g[1] * g[1] + g[2] * g[2];
    if (gg < 1e-18) break;
    q = [q[0] - d * g[0] / gg, q[1] - d * g[1] / gg, q[2] - d * g[2] / gg];
  }
  return q;
}

/**
 * Samples f on a regular grid and returns one surface point per grid edge whose endpoints
 * straddle zero. The crossing is linearly interpolated, t = f0 / (f0 - f1), then Newton-projected.
 * @returns {{points: Float64Array, normals: Float64Array, count: number}} flat xyz arrays
 */
export function sampleIsoPoints(f, bounds, { cell = 2, project = true } = {}) {
  const [x0, y0, z0, x1, y1, z1] = bounds;
  const nx = Math.max(1, Math.ceil((x1 - x0) / cell));
  const ny = Math.max(1, Math.ceil((y1 - y0) / cell));
  const nz = Math.max(1, Math.ceil((z1 - z0) / cell));
  const total = (nx + 1) * (ny + 1) * (nz + 1);
  if (total > 5e7) throw new Error(`grid of ${total} nodes is too large; increase cell size`);
  const dx = (x1 - x0) / nx, dy = (y1 - y0) / ny, dz = (z1 - z0) / nz;
  const sx = nx + 1, sxy = sx * (ny + 1);
  const v = new Float64Array(total);
  for (let k = 0; k <= nz; k++) for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
    v[k * sxy + j * sx + i] = f([x0 + i * dx, y0 + j * dy, z0 + k * dz]);
  }

  const pts = [], nrm = [];
  const emit = (a, b, pa, pb) => {
    const t = a / (a - b);
    let p = [pa[0] + (pb[0] - pa[0]) * t, pa[1] + (pb[1] - pa[1]) * t, pa[2] + (pb[2] - pa[2]) * t];
    if (project) p = projectToSurface(f, p);
    const n = normalAt(f, p);
    pts.push(p[0], p[1], p[2]);
    nrm.push(n[0], n[1], n[2]);
  };
  for (let k = 0; k <= nz; k++) for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
    const a = v[k * sxy + j * sx + i];
    const pa = [x0 + i * dx, y0 + j * dy, z0 + k * dz];
    if (i < nx) { const b = v[k * sxy + j * sx + i + 1]; if ((a < 0) !== (b < 0)) emit(a, b, pa, [pa[0] + dx, pa[1], pa[2]]); }
    if (j < ny) { const b = v[k * sxy + (j + 1) * sx + i]; if ((a < 0) !== (b < 0)) emit(a, b, pa, [pa[0], pa[1] + dy, pa[2]]); }
    if (k < nz) { const b = v[(k + 1) * sxy + j * sx + i]; if ((a < 0) !== (b < 0)) emit(a, b, pa, [pa[0], pa[1], pa[2] + dz]); }
  }
  return { points: Float64Array.from(pts), normals: Float64Array.from(nrm), count: pts.length / 3 };
}

// Sphere-traces a vertical ray down from zmax. Each step moves by the field value, which never
// overshoots a (lower-bound) distance field. Returns the hit z, or null if the ray misses.
function dropRay(f, x, y, zmin, zmax, tol, maxIter) {
  let z = zmax;
  for (let i = 0; i < maxIter; i++) {
    const d = f([x, y, z]);
    if (d < tol) return i === 0 ? null : z; // starting inside the solid means the bounds are too low
    z -= Math.max(d * 0.9, tol);
    if (z < zmin) return null;
  }
  return null;
}

/**
 * Top-down raster scan: lines along X spaced by `stepover` in Y, points every `step` in X.
 * Lines alternate direction (zigzag). A line is split into separate passes wherever the ray
 * misses the part, so no pass ever crosses air. Only surfaces visible from +Z are reached;
 * undercuts and the underside need a re-fixture or a different approach axis.
 * @returns {Array<Array<{x,y,z,nx,ny,nz}>>} passes of ordered contact points
 */
export function rasterToolpath(f, bounds, { stepover = 1.5, step = 0.75, tol = 1e-4, maxIter = 400, zigzag = true } = {}) {
  const [x0, y0, z0, x1, y1, z1] = bounds;
  const passes = [];
  const xSteps = Math.floor((x1 - x0) / step);
  let line = 0;
  for (let y = y0; y <= y1 + 1e-9; y += stepover, line++) {
    const reverse = zigzag && (line & 1) === 1;
    let seg = [];
    for (let s = 0; s <= xSteps; s++) {
      const x = reverse ? x1 - s * step : x0 + s * step;
      const z = dropRay(f, x, y, z0, z1, tol, maxIter);
      if (z === null) {
        if (seg.length) { passes.push(seg); seg = []; }
        continue;
      }
      const n = normalAt(f, [x, y, z]);
      seg.push({ x, y, z, nx: n[0], ny: n[1], nz: n[2] });
    }
    if (seg.length) passes.push(seg);
  }
  return passes;
}
