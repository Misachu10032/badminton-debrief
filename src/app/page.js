// src/app/page.jsx
import CanvasDraw from "../components/CanvasDraw";

export default function Page() {
  return (
    <main className="min-h-screen flex items-start justify-center bg-gray-100 p-2">
      <div style={{ width: "100%", maxWidth: 480 }}>
        <CanvasDraw />
      </div>
    </main>
  );
}
