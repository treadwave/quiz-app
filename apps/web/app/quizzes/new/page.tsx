"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function NewQuizPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [defaultQuestionTimeSec, setDefaultQuestionTimeSec] = useState(20);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/quizzes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, category, defaultQuestionTimeSec }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Не удалось создать квиз");
        return;
      }
      router.push(`/quizzes/${data.quiz.id}/edit`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 px-4 py-12">
      <h1 className="text-2xl font-semibold">Новый квиз</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Название
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="rounded border border-black/15 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Описание
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="rounded border border-black/15 px-3 py-2"
            rows={3}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Категория
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded border border-black/15 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Время на вопрос по умолчанию (сек)
          <input
            type="number"
            min={5}
            max={300}
            value={defaultQuestionTimeSec}
            onChange={(e) => setDefaultQuestionTimeSec(Number(e.target.value))}
            className="w-32 rounded border border-black/15 px-3 py-2"
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={saving}
          className="self-start rounded bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          {saving ? "Создаём..." : "Создать и перейти к вопросам"}
        </button>
      </form>
    </div>
  );
}
