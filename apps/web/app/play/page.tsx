"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function JoinPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const roomCode = code.trim().toUpperCase();
    if (!roomCode) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/sessions/by-code/${roomCode}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Комната не найдена");
        return;
      }
      router.push(`/play/${roomCode}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-16">
      <h1 className="text-2xl font-semibold">Присоединиться к квизу</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Код комнаты
          <input
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="rounded border border-black/15 px-3 py-3 text-center text-2xl tracking-widest uppercase"
            maxLength={6}
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          {loading ? "Проверяем..." : "Войти в комнату"}
        </button>
      </form>
    </div>
  );
}
