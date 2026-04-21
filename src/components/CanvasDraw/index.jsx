"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { globalToLocal, pointInSquareLocal } from "./triangleUtils";

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

  // Flip groups (declarative)
  const FLIP_GROUPS = {
    yellow: ["t1", "t2"],
    blue: ["t3", "t4"],
  };

  // Initial shapes
  const initialShapes = [
    { id: "t1", x: 0.35, y: 0.25, size: 0.25, src: "/yellow.png", angle: Math.PI },
    { id: "t2", x: 0.7, y: 0.25, size: 0.25, src: "/yellow.png", angle: Math.PI },
    { id: "t3", x: 0.35, y: 0.82, size: 0.25, src: "/blue.png", angle: 0 },
    { id: "t4", x: 0.7, y: 0.82, size: 0.25, src: "/blue.png", angle: 0 },
    { id: "t5", x: 0.8, y: 0.5, size: 0.2, src: "/shuttle.png", angle: 0 },
  ];

  const [shapes, setShapes] = useState(
    initialShapes.map((s) => ({
      ...s,
      x: s.x * width,
      y: s.y * height,
      size: s.size * Math.min(width, height),
    }))
  );

  // Flip modes per group
  const [flipModes, setFlipModes] = useState({
    yellow: 0,
    blue: 0,
  });

  // Derived flip logic (single source of truth)
  const isFlipped = (s) => {
    return Object.entries(flipModes).some(([key, mode]) => {
      const ids = FLIP_GROUPS[key];
      const index = ids.indexOf(s.id);
      return index !== -1 && mode >= index + 1;
    });
  };

  // Generic flip handler
  const cycleFlip = (groupKey) => {
    setFlipModes((prev) => ({
      ...prev,
      [groupKey]: (prev[groupKey] + 1) % 3,
    }));
  };

  // Responsive resize
  useEffect(() => {
    const handleResize = () => {
      const isMobile = window.innerWidth <= 768;
      const paddingRight = 16;
      const buttonHeight = 56;

      const availableWidth = isMobile
        ? window.innerWidth - paddingRight
        : Math.min(window.innerWidth, 480);

      const availableHeight = isMobile
        ? Math.min(window.innerHeight - buttonHeight - 16, 700)
        : Math.min(window.innerHeight - 120, 700);

      setCanvasSize({ width: availableWidth, height: availableHeight });

      setShapes((prev) =>
        prev.map((s) => ({
          ...s,
          x: (s.x / width) * availableWidth,
          y: (s.y / height) * availableHeight,
          size:
            (s.size / Math.min(width, height)) *
            Math.min(availableWidth, availableHeight),
        }))
      );
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [width, height]);

  // Load images
  useEffect(() => {
    const loadImages = async () => {
      // load shape images
      const loadedShapes = await Promise.all(
        initialShapes.map(
          (s) =>
            new Promise((res) => {
              const img = new Image();
              img.src = s.src;
              img.onload = () =>
                res({
                  ...s,
                  x: s.x * width,
                  y: s.y * height,
                  size: s.size * Math.min(width, height),
                  imgObj: img,
                });
            })
        )
      );

      // load background
      const bg = await new Promise((res) => {
        const img = new Image();
        img.src = "/my-bg.png";
        img.onload = () => res(img);
      });

      // set both together
      backgroundImageRef.current = bg;
      setShapes(loadedShapes); // triggers redraw correctly
    };

    loadImages();
  }, []);

  // Offscreen drawing setup
  useEffect(() => {
    const off = document.createElement("canvas");
    off.width = width;
    off.height = height;
    offscreenRef.current = off;

    const ctx = off.getContext("2d");
    offscreenCtxRef.current = ctx;

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth;
  }, [width, height, strokeStyle, lineWidth]);

  // Render
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (backgroundImageRef.current) {
      ctx.drawImage(
        backgroundImageRef.current,
        0,
        0,
        canvas.width,
        canvas.height
      );
    }

    if (offscreenRef.current) {
      ctx.drawImage(offscreenRef.current, 0, 0);
    }

    shapes.forEach((s) => {
      if (!s.imgObj) return;

      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.angle || 0);

      if (isFlipped(s)) {
        ctx.scale(-1, 1);
      }

      ctx.drawImage(
        s.imgObj,
        -s.size / 2,
        -s.size / 2,
        s.size,
        s.size
      );

      ctx.restore();
    });
  }, [shapes, flipModes]);

  // Pointer helpers
  const getPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const touch = e.touches?.[0] || e.changedTouches?.[0];
    const x = touch?.clientX ?? e.clientX;
    const y = touch?.clientY ?? e.clientY;
    return [x - rect.left, y - rect.top];
  };

  const hitTest = (px, py) => {
    for (let i = shapes.length - 1; i >= 0; i--) {
      const s = shapes[i];
      const [lx, ly] = globalToLocal(px, py, s, isFlipped(s));

      if (lx >= 0 && ly <= 0 && Math.abs(lx) <= s.size / 2 && Math.abs(ly) <= s.size / 2) {
        return { type: "rotate", index: i };
      }

      if (pointInSquareLocal(lx, ly, s.size)) {
        return { type: "body", index: i };
      }
    }
    return null;
  };

  // Pointer events
  const pointerDown = (e) => {
    e.preventDefault();
    const [x, y] = getPos(e);

    isDrawing.current = false;
    isDragging.current = false;
    isRotating.current = false;

    const hit = hitTest(x, y);

    if (hit?.type === "rotate") {
      isRotating.current = true;
      rotateShapeIndex.current = hit.index;
      rotateStartAngle.current = shapes[hit.index].angle || 0;
      rotateStartPointerAngle.current = Math.atan2(
        y - shapes[hit.index].y,
        x - shapes[hit.index].x
      );
    } else if (hit?.type === "body") {
      isDragging.current = true;
      dragShapeIndex.current = hit.index;
      const s = shapes[hit.index];
      dragOffset.current = [x - s.x, y - s.y];
    } else {
      isDrawing.current = true;
      lastPos.current = [x, y];
      const ctx = offscreenCtxRef.current;
      ctx.beginPath();
      ctx.moveTo(x, y);
    }
  };

  const pointerMove = (e) => {
    if (!isDrawing.current && !isDragging.current && !isRotating.current) return;

    e.preventDefault();
    const [x, y] = getPos(e);

    if (isRotating.current) {
      const i = rotateShapeIndex.current;
      const s = shapes[i];
      const delta =
        Math.atan2(y - s.y, x - s.x) - rotateStartPointerAngle.current;

      setShapes((prev) => {
        const next = [...prev];
        next[i] = { ...next[i], angle: rotateStartAngle.current + delta };
        return next;
      });
    } else if (isDragging.current) {
      const i = dragShapeIndex.current;

      setShapes((prev) => {
        const next = [...prev];
        next[i] = {
          ...next[i],
          x: x - dragOffset.current[0],
          y: y - dragOffset.current[1],
        };
        return next;
      });
    } else if (isDrawing.current) {
      const ctx = offscreenCtxRef.current;
      ctx.lineTo(x, y);
      ctx.stroke();
      redraw();
    }
  };

  const pointerUp = (e) => {
    e.preventDefault();
    isDrawing.current = false;
    isDragging.current = false;
    isRotating.current = false;
    dragShapeIndex.current = -1;
    rotateShapeIndex.current = -1;
  };

  const clearAll = () => {
    offscreenCtxRef.current?.clearRect(0, 0, width, height);
    redraw();
  };

  useEffect(() => redraw(), [shapes, flipModes]);

  return (
    <div className="flex flex-col items-center w-full h-screen bg-white">
      <div className="flex gap-2 p-2">
        <button onClick={() => cycleFlip("yellow")} className="px-4 py-2 border rounded">
          Flip Yellow
        </button>
        <button onClick={() => cycleFlip("blue")} className="px-4 py-2 border rounded">
          Flip Blue
        </button>
        <button onClick={clearAll} className="px-4 py-2 border rounded">
          Clear
        </button>
      </div>

      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="border rounded"
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
        onPointerLeave={pointerUp}
      />
    </div>
  );
}