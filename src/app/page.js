// src/app/page.jsx
import CanvasDraw from "../components/CanvasDraw";

export default function Page() {
  return (
    <main className="min-h-screen flex items-start justify-center bg-gray-100 p-8">
      <div style={{ width: 960 }}>
        <h1 className="text-2xl mb-4">Canvas draw (no Konva) — Undo / Redo</h1>
     <CanvasDraw />
      </div>
    </main>
  );
}
