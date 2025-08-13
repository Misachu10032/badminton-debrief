// src/components/Canvas/triangleUtils.js
// Geometry & drawing helpers for triangle shapes.

export function triangleLocalPoints(size) {
  const h = (Math.sqrt(3) / 2) * size;
  const p1 = [0, -(2 / 3) * h]; // top
  const p2 = [-size / 2, h / 3];
  const p3 = [size / 2, h / 3];
  return [p1, p2, p3];
}

export function drawTriangle(ctx, s, drawHandle = true, opacity = 1) {
  const { x, y, size, fill = "#ff6b6b", stroke = "#333", angle = 0 } = s;
  const [p1, p2, p3] = triangleLocalPoints(size);
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(p1[0], p1[1]);
  ctx.lineTo(p2[0], p2[1]);
  ctx.lineTo(p3[0], p3[1]);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1;
  ctx.stroke();

  if (drawHandle) {
    const handleDist = 26;
    const vx = p1[0], vy = p1[1];
    const vlen = Math.sqrt(vx * vx + vy * vy) || 1;
    const nx = vx / vlen, ny = vy / vlen;
    const hx = p1[0] + nx * -handleDist;
    const hy = p1[1] + ny * -handleDist;
    ctx.beginPath();
    ctx.arc(hx, hy, 7, 0, Math.PI * 2);
    ctx.fillStyle = "#111";
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  ctx.restore();
}

export function globalToLocal(px, py, s) {
  const dx = px - s.x;
  const dy = py - s.y;
  const cos = Math.cos(-s.angle || 0);
  const sin = Math.sin(-s.angle || 0);
  const lx = dx * cos - dy * sin;
  const ly = dx * sin + dy * cos;
  return [lx, ly];
}

export function pointInTriangleLocal(px, py, size) {
  const [A, B, C] = triangleLocalPoints(size);
  const ax = A[0], ay = A[1];
  const bx = B[0], by = B[1];
  const cx = C[0], cy = C[1];
  const v0x = cx - ax, v0y = cy - ay;
  const v1x = bx - ax, v1y = by - ay;
  const v2x = px - ax, v2y = py - ay;
  const den = v0x * v1y - v1x * v0y;
  if (Math.abs(den) < 1e-6) return false;
  const u = (v2x * v1y - v1x * v2y) / den;
  const v = (v0x * v2y - v2x * v0y) / den;
  return u >= 0 && v >= 0 && u + v <= 1;
}

export function getRotationHandleGlobal(s) {
  const [p1] = triangleLocalPoints(s.size);
  const handleDist = 26;
  const vx = p1[0], vy = p1[1];
  const vlen = Math.sqrt(vx * vx + vy * vy) || 1;
  const nx = vx / vlen, ny = vy / vlen;
  const hx = p1[0] + nx * -handleDist;
  const hy = p1[1] + ny * -handleDist;
  const cos = Math.cos(s.angle || 0);
  const sin = Math.sin(s.angle || 0);
  const gx = hx * cos - hy * sin + s.x;
  const gy = hx * sin + hy * cos + s.y;
  return [gx, gy];
}
