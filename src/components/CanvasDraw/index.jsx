"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { globalToLocal, pointInSquareLocal } from "./triangleUtils";
import useHistory from "./useHistory";

export default function CanvasDraw({ strokeStyle = "#000", lineWidth = 2 }) {
  // Canvas size
  const [canvasSize, setCanvasSize] = useState({ width: 360, height: 600 });
  const { width, height } = canvasSize;

  // Refs
  const canvasRef = useRef(null);
  const offscreenRef = useRef(null);
  const offscreenCtxRef = useRef(null);
  const backgroundImageRef = useRef(null);

  const isDrawing = useRef(false);
  const isDragging = useRef(false);
  const isRotating = useRef(false);
  const dragShapeIndex = useRef(-1);
  const rotateShapeIndex = useRef(-1);
  const dragOffset = useRef([0, 0]);
  const rotateStartAngle = useRef(0);
  const rotateStartPointerAngle = useRef(0);
  const lastPos = useRef([0, 0]);

  // Initial shapes
  const initialShapes = [
    {
      id: "t1",
      x: 0.35,
      y: 0.25,
      size: 0.25,
      src: "/yellow.png",
      angle: Math.PI,
    },
    {
      id: "t2",
      x: 0.7,
      y: 0.25,
      size: 0.25,
      src: "/yellow.png",
      angle: Math.PI,
    },
    { id: "t3", x: 0.35, y: 0.82, size: 0.25, src: "/blue.png", angle: 0 },
    { id: "t4", x: 0.7, y: 0.82, size: 0.25, src: "/blue.png", angle: 0 },
  ];

  const [shapes, setShapes] = useState(
    initialShapes.map((s) => ({
      ...s,
      x: s.x * width,
      y: s.y * height,
      size: s.size * Math.min(width, height),
    }))
  );

  // Responsive canvas
  useEffect(() => {
    const handleResize = () => {
      const isMobile = window.innerWidth <= 768;
      const paddingRight = 16; // gap from right edge in px

      let w, h;
      if (isMobile) {
        w = Math.min(window.innerWidth - paddingRight, 480);
        h = Math.min(window.innerHeight - 30, 700);
      } else {
        w = Math.min(window.innerWidth, 480);
        h = Math.min(window.innerHeight - 120, 700);
      }

      setCanvasSize({ width: w, height: h });

      // Rescale shapes proportionally
      setShapes((prev) =>
        prev.map((s) => ({
          ...s,
          x: (s.x / width) * w,
          y: (s.y / height) * h,
          size: (s.size / Math.min(width, height)) * Math.min(w, h),
        }))
      );
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [width, height]);

  // Load images and background
  useEffect(() => {
    const loadImages = async () => {
      const loadedShapes = await Promise.all(
        shapes.map(
          (s) =>
            new Promise((res) => {
              const img = new Image();
              img.src = s.src;
              img.onload = () => res({ ...s, imgObj: img });
            })
        )
      );
      setShapes(loadedShapes);

      const bg = new Image();
      bg.src = "/my-bg.png";
      bg.onload = () => {
        backgroundImageRef.current = bg;
        redraw(loadedShapes);
      };
    };
    loadImages();
  }, []);

  // Offscreen canvas for freehand drawing
  useEffect(() => {
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
  }, [width, height, strokeStyle, lineWidth]);

  // Redraw function
  const redraw = useCallback(
    (arr = shapes) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (backgroundImageRef.current)
        ctx.drawImage(
          backgroundImageRef.current,
          0,
          0,
          canvas.width,
          canvas.height
        );
      if (offscreenRef.current) ctx.drawImage(offscreenRef.current, 0, 0);

      arr.forEach((s) => {
        if (s.imgObj) {
          ctx.save();
          ctx.translate(s.x, s.y);
          ctx.rotate(s.angle || 0);
          ctx.drawImage(s.imgObj, -s.size / 2, -s.size / 2, s.size, s.size);
          ctx.restore();
        }
      });
    },
    [shapes]
  );

  const history = useHistory(offscreenRef, setShapes, redraw);

  // Get canvas pointer position
  const getPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const touch = e.touches?.[0] || e.changedTouches?.[0];
    const clientX = touch?.clientX ?? e.clientX;
    const clientY = touch?.clientY ?? e.clientY;
    return [clientX - rect.left, clientY - rect.top];
  };

  // Hit test
  const hitTest = (px, py) => {
    for (let i = shapes.length - 1; i >= 0; i--) {
      const s = shapes[i];

      // Convert mouse to square-local coordinates
      const [lx, ly] = globalToLocal(px, py, s);

      // 1️⃣ Top-right quarter = rotation handle
      if (
        lx >= 0 && // right half
        ly <= 0 && // top half
        Math.abs(lx) <= s.size / 2 &&
        Math.abs(ly) <= s.size / 2
      ) {
        return { type: "rotate", index: i };
      }

      // 2️⃣ Rest of square = body
      if (pointInSquareLocal(lx, ly, s.size)) {
        return { type: "body", index: i };
      }
    }

    return null;
  };

  // Pointer handlers
  const pointerDown = (e) => {
    e.preventDefault();
    const [x, y] = getPos(e);

    // Reset all actions
    isRotating.current = false;
    isDragging.current = false;
    isDrawing.current = false;

    const hit = hitTest(x, y);

    if (hit?.type === "rotate") {
      console.log("rotating");
      isRotating.current = true;
      rotateShapeIndex.current = hit.index;
      rotateStartAngle.current = shapes[hit.index].angle || 0;
      rotateStartPointerAngle.current = Math.atan2(
        y - shapes[hit.index].y,
        x - shapes[hit.index].x
      );
    } else if (hit?.type === "body") {
      console.log("aaaa");
      isDragging.current = true;
      dragShapeIndex.current = hit.index;
      const s = shapes[hit.index];
      dragOffset.current = [x - s.x, y - s.y];
    } else {
      console.log("abbb");
      isDrawing.current = true;
      lastPos.current = [x, y];
      const ctx = offscreenCtxRef.current;
      ctx.beginPath();
      ctx.moveTo(x, y);
      history.saveSnapshot();
    }
  };

  const pointerMove = (e) => {
    if (!isDrawing.current && !isDragging.current && !isRotating.current)
      return;
    e.preventDefault();
    const [x, y] = getPos(e);

    if (isRotating.current && rotateShapeIndex.current !== -1) {
      const i = rotateShapeIndex.current;
      const s = shapes[i];
      const delta =
        Math.atan2(y - s.y, x - s.x) - rotateStartPointerAngle.current;
      const newAngle = rotateStartAngle.current + delta;
      setShapes((prev) => {
        const next = [...prev];
        next[i] = { ...next[i], angle: newAngle };
        redraw(next); // <-- pass updated shapes
        return next;
      });
    } else if (isDragging.current && dragShapeIndex.current !== -1) {
      const i = dragShapeIndex.current;
      setShapes((prev) => {
        const next = [...prev];
        next[i] = {
          ...next[i],
          x: x - dragOffset.current[0],
          y: y - dragOffset.current[1],
        };
        redraw(next); // <-- pass updated shapes
        return next;
      });
    } else if (isDrawing.current) {
      const ctx = offscreenCtxRef.current;
      ctx.lineTo(x, y);
      ctx.stroke();
      redraw();
      lastPos.current = [x, y];
    }
  };

  const pointerUp = (e) => {
    e.preventDefault();
    isRotating.current = false;
    rotateShapeIndex.current = -1;
    isDragging.current = false;
    dragShapeIndex.current = -1;
    if (isDrawing.current) {
      isDrawing.current = false;
      history.saveSnapshot();
    }
  };

  const undo = () => history.undo();
  const redo = () => history.redo();
  const clearAll = () => {
    history.saveSnapshot();
    const ctx = offscreenCtxRef.current;
    ctx?.clearRect(0, 0, width, height);
    history.saveSnapshot();
    redraw();
  };

  useEffect(() => {
    redraw();
  }, [shapes]);

  return (
    <div className="p-4 max-w-full text-black">
      <div className="mb-3 flex flex-wrap justify-center gap-2">
        <button
          onClick={undo}
          disabled={!history.canUndo()}
          className="px-4 py-2 border border-black rounded text-black bg-white disabled:opacity-50"
        >
          Undo
        </button>
        <button
          onClick={redo}
          disabled={!history.canRedo()}
          className="px-4 py-2 border border-black rounded text-black bg-white disabled:opacity-50"
        >
          Redo
        </button>
        <button
          onClick={clearAll}
          className="px-4 py-2 border border-black rounded text-black bg-white"
        >
          Clear
        </button>
      </div>

      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="block mx-auto max-w-full touch-none bg-white rounded border border-gray-300"
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
        onPointerLeave={pointerUp}
        onMouseDown={pointerDown}
        onMouseMove={pointerMove}
        onMouseUp={pointerUp}
        onMouseLeave={pointerUp}
        onTouchStart={pointerDown}
        onTouchMove={pointerMove}
        onTouchEnd={pointerUp}
      />
    </div>
  );
}
