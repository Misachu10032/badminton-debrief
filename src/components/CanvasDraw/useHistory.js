// src/components/Canvas/useHistory.js
import { useRef, useCallback, useState } from "react";

/**
 * useHistory(offscreenRef, setShapes, redraw)
 * - offscreenRef: ref to the offscreen canvas element
 * - setShapes: setter to update shapes state
 * - redraw: function to redraw main canvas
 *
 * Returns: { init, saveSnapshot, undo, redo, canUndo, canRedo, clear }
 */
export default function useHistory(offscreenRef, setShapes, redraw) {
  const undoRef = useRef([]);
  const redoRef = useRef([]);
  const [, setVersion] = useState(0);
  const bump = useCallback(() => setVersion((v) => v + 1), []);

  const init = useCallback(() => {
    const off = offscreenRef.current;
    if (!off) return;
    undoRef.current = [off.toDataURL()];
    redoRef.current = [];
    bump();
  }, [offscreenRef, bump]);

  const saveSnapshot = useCallback(() => {
    const off = offscreenRef.current;
    if (!off) return;
    undoRef.current.push(off.toDataURL());
    if (undoRef.current.length > 80) undoRef.current.shift();
    redoRef.current = [];
    bump();
  }, [offscreenRef, bump]);

  const undo = useCallback(() => {
    if (undoRef.current.length <= 1) return;
    const cur = undoRef.current.pop();
    redoRef.current.push(cur);
    const prev = undoRef.current[undoRef.current.length - 1];
    const img = new Image();
    img.onload = () => {
      const off = offscreenRef.current;
      const ctx = off.getContext("2d");
      ctx.clearRect(0, 0, off.width, off.height);
      ctx.drawImage(img, 0, 0);
      if (typeof redraw === "function") redraw();
    };
    img.src = prev;
    bump();
  }, [offscreenRef, redraw, bump]);

  const redo = useCallback(() => {
    if (redoRef.current.length === 0) return;
    const nextSnap = redoRef.current.pop();
    undoRef.current.push(nextSnap);
    const img = new Image();
    img.onload = () => {
      const off = offscreenRef.current;
      const ctx = off.getContext("2d");
      ctx.clearRect(0, 0, off.width, off.height);
      ctx.drawImage(img, 0, 0);
      if (typeof redraw === "function") redraw();
    };
    img.src = nextSnap;
    bump();
  }, [offscreenRef, redraw, bump]);

  const clear = useCallback(() => {
    const off = offscreenRef.current;
    if (!off) return;
    undoRef.current = [off.toDataURL()];
    redoRef.current = [];
    if (typeof redraw === "function") redraw();
    bump();
  }, [offscreenRef, redraw, bump]);

  const canUndo = useCallback(() => undoRef.current.length > 1, []);
  const canRedo = useCallback(() => redoRef.current.length > 0, []);

  return { init, saveSnapshot, undo, redo, canUndo, canRedo, clear };
}
