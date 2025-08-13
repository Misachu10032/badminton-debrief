// src/components/Canvas/CanvasDraw.jsx
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  drawTriangle,
  globalToLocal,
  pointInTriangleLocal,
  getRotationHandleGlobal,
} from "./triangleUtils";
import useHistory from "./useHistory";

export default function CanvasDraw({
  strokeStyle = "#000",
  lineWidth = 2,
}) {
  // Responsive canvas size
  const [canvasSize, setCanvasSize] = useState({ width: 360, height: 600 });

  useEffect(() => {
    function handleResize() {
      const w = Math.min(window.innerWidth, 480);
      const h = Math.min(window.innerHeight - 120, 700);
      setCanvasSize({ width: w, height: h });
    }
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const { width, height } = canvasSize;

  const canvasRef = useRef(null);
  const offscreenRef = useRef(null);
  const offscreenCtxRef = useRef(null);

  const isDrawing = useRef(false);
  const isDragging = useRef(false);
  const dragShapeIndex = useRef(-1);
  const dragOffset = useRef([0, 0]);

  const isRotating = useRef(false);
  const rotateShapeIndex = useRef(-1);
  const rotateStartAngle = useRef(0);
  const rotateStartPointerAngle = useRef(0);
  const backgroundImageRef = useRef(null);
  const lastPos = useRef([0, 0]);

  // initial four triangles: two red (top), two blue (bottom)
  const initialShapes = [
    {
      id: "t1",
      type: "triangle",
      x: width * 0.25,
      y: height * 0.18,
      size: Math.min(width, height) * 0.18,
      fill: "#ef4444",
      angle: Math.PI, // upside down
    },
    {
      id: "t2",
      type: "triangle",
      x: width * 0.75,
      y: height * 0.18,
      size: Math.min(width, height) * 0.18,
      fill: "#ef4444",
      angle: Math.PI, // upside down
    },
    {
      id: "t3",
      type: "triangle",
      x: width * 0.25,
      y: height * 0.82,
      size: Math.min(width, height) * 0.18,
      fill: "#60a5fa",
      angle: 0,
    },
    {
      id: "t4",
      type: "triangle",
      x: width * 0.75,
      y: height * 0.82,
      size: Math.min(width, height) * 0.18,
      fill: "#60a5fa",
      angle: 0,
    },
  ];

  const [shapes, setShapes] = useState(initialShapes);
  const uid = useCallback(() => Math.random().toString(36).slice(2, 9), []);

  // redraw function used by history hook
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background image if loaded
    if (backgroundImageRef.current) {
      ctx.drawImage(
        backgroundImageRef.current,
        0,
        0,
        canvas.width,
        canvas.height
      );
    }

    // Draw saved freehand lines
    if (offscreenRef.current) {
      ctx.drawImage(offscreenRef.current, 0, 0);
    }

    // Draw triangles
    shapes.forEach((s) => drawTriangle(ctx, s, true));
  }, [shapes]);

  // history hook (undo/redo)
  const history = useHistory(offscreenRef, setShapes, redraw);
  useEffect(() => {
    const canvas = canvasRef.current;
    canvas.width = width;
    canvas.height = height;

    const off = document.createElement("canvas");
    off.width = width;
    off.height = height;
    offscreenRef.current = off;
    offscreenCtxRef.current = off.getContext("2d");
    const ctx = offscreenCtxRef.current;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth;

    history.init();
    history.saveSnapshot();

    // Load background image
    const img = new Image();
    img.src = "/my-bg.png"; // put your PNG inside public/ folder
    img.onload = () => {
      backgroundImageRef.current = img;
      redraw(); // draw once loaded
    };

    setTimeout(redraw, 0);
  }, []);

  // hit test: rotation handle first, then body
  const hitTest = (px, py) => {
    const hr = 9;
    for (let i = shapes.length - 1; i >= 0; i--) {
      const s = shapes[i];
      const [hx, hy] = getRotationHandleGlobal(s);
      const d2 = (px - hx) * (px - hx) + (py - hy) * (py - hy);
      if (d2 <= hr * hr) return { type: "rotate", index: i };
    }
    for (let i = shapes.length - 1; i >= 0; i--) {
      const s = shapes[i];
      const [lx, ly] = globalToLocal(px, py, s);
      if (pointInTriangleLocal(lx, ly, s.size))
        return { type: "body", index: i };
    }
    return null;
  };

  // Utility to get position from mouse or touch event
  const getPos = (e) => {
    let clientX, clientY;
    if (e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if (e.changedTouches && e.changedTouches.length > 0) {
      clientX = e.changedTouches[0].clientX;
      clientY = e.changedTouches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    const rect = canvasRef.current.getBoundingClientRect();
    return [clientX - rect.left, clientY - rect.top];
  };

  const saveSnapshot = useCallback(
    () => {
      history.saveSnapshot();
    },
    [history]
  );

  // ----- Canvas pointer handlers -----
  const pointerDown = (e) => {
    e.preventDefault();
    const [x, y] = getPos(e);
    const hit = hitTest(x, y);
    if (hit) {
      if (hit.type === "rotate") {
        isRotating.current = true;
        rotateShapeIndex.current = hit.index;
        const s = shapes[hit.index];
        rotateStartAngle.current = s.angle || 0;
        rotateStartPointerAngle.current = Math.atan2(y - s.y, x - s.x);
        return;
      } else if (hit.type === "body") {
        isDragging.current = true;
        dragShapeIndex.current = hit.index;
        const s = shapes[hit.index];
        dragOffset.current = [x - s.x, y - s.y];
        return;
      }
    }
    // freehand drawing
    isDrawing.current = true;
    lastPos.current = [x, y];
    const ctx = offscreenCtxRef.current;
    ctx.beginPath();
    ctx.moveTo(x, y);
    history.saveSnapshot();
  };

  const pointerMove = (e) => {
    if (
      !(isDrawing.current || isDragging.current || isRotating.current)
    ) return;
    e.preventDefault();
    const [x, y] = getPos(e);

    if (isRotating.current && rotateShapeIndex.current !== -1) {
      const i = rotateShapeIndex.current;
      const s = shapes[i];
      const currentPointerAngle = Math.atan2(y - s.y, x - s.x);
      const delta = currentPointerAngle - rotateStartPointerAngle.current;
      const newAngle = rotateStartAngle.current + delta;
      setShapes((prev) => {
        const next = prev.slice();
        next[i] = { ...next[i], angle: newAngle };
        return next;
      });
      redraw();
      return;
    }

    if (isDragging.current && dragShapeIndex.current !== -1) {
      const i = dragShapeIndex.current;
      setShapes((prev) => {
        const next = prev.slice();
        next[i] = {
          ...next[i],
          x: x - dragOffset.current[0],
          y: y - dragOffset.current[1],
        };
        return next;
      });
      redraw();
      return;
    }

    if (isDrawing.current) {
      const ctx = offscreenCtxRef.current;
      ctx.lineTo(x, y);
      ctx.stroke();
      redraw();
      lastPos.current = [x, y];
    }
  };

  const pointerUp = (e) => {
    e.preventDefault();
    if (isRotating.current) {
      isRotating.current = false;
      rotateShapeIndex.current = -1;
      return;
    }
    if (isDragging.current) {
      isDragging.current = false;
      dragShapeIndex.current = -1;
      return;
    }
    if (isDrawing.current) {
      isDrawing.current = false;
      history.saveSnapshot();
    }
  };

  const undo = () => history.undo();
  const redo = () => history.redo();
  const clearAll = () => {
    // Save current state so user can undo the clear
    history.saveSnapshot();

    // Clear only the drawing pixels on the offscreen canvas
    const off = offscreenRef.current;
    const octx = offscreenCtxRef.current;
    if (off && octx) {
      octx.clearRect(0, 0, off.width, off.height);
    }

    // Reset shapes to the initial positions (do not remove them)
    setShapes(initialShapes);

    // Push the cleared snapshot (blank drawing + initial shapes) to the history
    // so that the clear action itself is undoable.
    history.saveSnapshot();

    // Repaint
    redraw();
  };
  const exportPNG = () => {
    const temp = document.createElement("canvas");
    temp.width = width;
    temp.height = height;
    const tctx = temp.getContext("2d");
    tctx.drawImage(offscreenRef.current, 0, 0);
    shapes.forEach((s) => drawTriangle(tctx, s, true));
    const url = temp.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = "drawing.png";
    a.click();
  };

  useEffect(() => {
    redraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shapes]);

  return (
    <div>
      <div className="mb-3 flex gap-2">
        <button
          className="px-3 py-1 border rounded"
          onClick={undo}
          disabled={!history.canUndo()}
        >
          Undo
        </button>
        <button
          className="px-3 py-1 border rounded"
          onClick={redo}
          disabled={!history.canRedo()}
        >
          Redo
        </button>
        <button className="px-3 py-1 border rounded" onClick={clearAll}>
          Clear
        </button>
        {/* <button className="px-3 py-1 border rounded" onClick={exportPNG}>
          Export PNG
        </button> */}
      </div>

      <div style={{ width, height }}>
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          style={{
            touchAction: "none",
            background: "#fff",
            borderRadius: 6,
            display: "block",
            border: "1px solid #ddd",
          }}
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={pointerUp}
          onPointerLeave={pointerUp}
          // Fallback for browsers without pointer events
          onMouseDown={pointerDown}
          onMouseMove={pointerMove}
          onMouseUp={pointerUp}
          onMouseLeave={pointerUp}
          onTouchStart={pointerDown}
          onTouchMove={pointerMove}
          onTouchEnd={pointerUp}
        />
      </div>
    </div>
  );
}
