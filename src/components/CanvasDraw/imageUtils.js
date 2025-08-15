export function drawImageShape(ctx, s, drawHandle = true, opacity = 1, loadedImages = {}) {
  const { x, y, size, imgSrc, angle = 0 } = s;
  const img = loadedImages[imgSrc];
  if (!img) return; // image not loaded yet

  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.translate(x, y);
  ctx.rotate(angle);

  // Draw image centered
  ctx.drawImage(img, -size / 2, -size / 2, size, size);

  // Draw rotation handle (same logic as triangle)
  if (drawHandle) {
    const handleDist = size / 2 + 26;
    ctx.beginPath();
    ctx.arc(0, -handleDist, 7, 0, Math.PI * 2);
    ctx.fillStyle = "#111";
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  ctx.restore();
}

// Get rotation handle global position for image
export function getImageRotationHandleGlobal(s) {
  const handleDist = s.size / 2 + 26;
  const angle = s.angle || 0;
  const hx = s.x + Math.sin(angle) * 0 + Math.cos(angle) * 0;
  const hy = s.y + Math.sin(angle) * -handleDist + Math.cos(angle) * 0;
  // Actually, just use polar coordinates:
  return [
    s.x + Math.sin(angle) * 0 + Math.cos(angle) * 0,
    s.y - handleDist * Math.cos(angle) - handleDist * Math.sin(angle) * 0,
  ];
}