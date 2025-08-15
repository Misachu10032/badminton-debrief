// src/components/Canvas/imageUtils.js
// Helpers for square images

// Convert global coordinates to local coordinates relative to a square image
export function globalToLocal(px, py, s) {
  const dx = px - s.x;
  const dy = py - s.y;
  const cos = Math.cos(-s.angle || 0);
  const sin = Math.sin(-s.angle || 0);
  const lx = dx * cos - dy * sin;
  const ly = dx * sin + dy * cos;
  return [lx, ly];
}

// Check if a point is inside the square image
export function pointInSquareLocal(px, py, size) {
  const half = size / 2;
  return px >= -half && px <= half && py >= -half && py <= half;
}

// Get rotation handle at the top-right corner of the square
// src/components/Canvas/rectangleUtils.js

export function getRotationHandleGlobal(s) {

  const half = s.size / 2;

  // Top-right corner in local coordinates
  let hx = half;
  let hy = -half;



  // Rotate around the center
  const cos = Math.cos(s.angle || 0);
  const sin = Math.sin(s.angle || 0);
  const gx = hx * cos - hy * sin + s.x;
  const gy = hx * sin + hy * cos + s.y;

  return [gx, gy];
}
