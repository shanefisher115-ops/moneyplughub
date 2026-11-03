// JS port of primordia_sdf.glsl (primordia-studio/experiments/sdf-lib) so the CAM pipeline can
// evaluate the same distance fields on the CPU. Every function mirrors its GLSL namesake;
// vec3 arguments are plain [x, y, z] arrays. Units are millimetres in the preset scenes.

const mix = (a, b, t) => a * (1 - t) + b * t;
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

// Primitives (exact distances)

export const sdSphere = (p, r) => Math.hypot(p[0], p[1], p[2]) - r;

// b = half-extents
export function sdBox(p, b) {
  const dx = Math.abs(p[0]) - b[0], dy = Math.abs(p[1]) - b[1], dz = Math.abs(p[2]) - b[2];
  return Math.hypot(Math.max(dx, 0), Math.max(dy, 0), Math.max(dz, 0)) + Math.min(Math.max(dx, Math.max(dy, dz)), 0);
}

// t = [tube radius, major radius]; the ring lies in the xz plane, as in the GLSL.
export function sdTorus(p, t) {
  const qx = Math.hypot(p[0], p[2]) - t[1];
  return Math.hypot(qx, p[1]) - t[0];
}

// h = [radius, half-height], axis along y
export function sdCylinder(p, h) {
  const dx = Math.hypot(p[0], p[2]) - h[0], dy = Math.abs(p[1]) - h[1];
  return Math.min(Math.max(dx, dy), 0) + Math.hypot(Math.max(dx, 0), Math.max(dy, 0));
}

// CSG operators

export const opUnion = (d1, d2) => Math.min(d1, d2);
export const opSubtraction = (d1, d2) => Math.max(-d1, d2); // carves d1 out of d2
export const opIntersection = (d1, d2) => Math.max(d1, d2);

export function opSmoothUnion(d1, d2, k) {
  const h = clamp(0.5 + 0.5 * (d2 - d1) / k, 0, 1);
  return mix(d2, d1, h) - k * h * (1 - h);
}

export function opSmoothSubtraction(d1, d2, k) {
  const h = clamp(0.5 - 0.5 * (d2 + d1) / k, 0, 1);
  return mix(d2, -d1, h) + k * h * (1 - h);
}

export function opSmoothIntersection(d1, d2, k) {
  const h = clamp(0.5 - 0.5 * (d2 - d1) / k, 0, 1);
  return mix(d2, d1, h) + k * h * (1 - h);
}

// CAM convention is Z-up, so the torus ring is laid in the XY plane by swizzling y and z.
const torusZUp = (p, tube, major) => sdTorus([p[0], p[2], p[1]], [tube, major]);

// bounds = [xmin, ymin, zmin, xmax, ymax, zmax]
export const SCENES = {
  sphere: {
    bounds: [-26, -26, -26, 26, 26, 26],
    sdf: p => sdSphere(p, 24),
  },
  torus: {
    bounds: [-42, -42, -12, 42, 42, 12],
    sdf: p => torusZUp(p, 8, 30),
  },
  // Sphere r24 and a ring (major 30, tube 8) overlap, welded with a 3 mm smooth union.
  sphere_torus: {
    bounds: [-42, -42, -26, 42, 42, 26],
    sdf: p => opSmoothUnion(sdSphere(p, 24), torusZUp(p, 8, 30), 3),
  },
};
