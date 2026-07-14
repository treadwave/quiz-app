"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import QuestionEditor, { QuestionFormValue } from "@/components/QuestionEditor";
import type { QuizDto } from "@/lib/types";

export default function EditQuizPage() {
  const params = useParams<{ quizId: string }>();
  const router = useRouter();
  const quizId = params.quizId;

  const [quiz, setQuiz] = useState<QuizDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [defaultQuestionTimeSec, setDefaultQuestionTimeSec] = useState(20);
  const [savingSettings, setSavingSettings] = useState(false);

  const [addingQuestion, setAddingQuestion] = useState(false);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const loadQuiz = useCallback(async () => {
    const res = await fetch(`/api/quizzes/${quizId}`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Не удалось загрузить квиз");
      return;
    }
    setQuiz(data.quiz);
    setTitle(data.quiz.title);
    setDescription(data.quiz.description ?? "");
    setCategory(data.quiz.category ?? "");
    setDefaultQuestionTimeSec(data.quiz.defaultQuestionTimeSec);
  }, [quizId]);

  useEffect(() => {
    setLoading(true);
    loadQuiz().finally(() => setLoading(false));
  }, [loadQuiz]);

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const res = await fetch(`/api/quizzes/${quizId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, category, defaultQuestionTimeSec }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Не удалось сохранить настройки");
        return;
      }
      await loadQuiz();
    } finally {
      setSavingSettings(false);
    }
  }

  async function handleCreateQuestion(value: QuestionFormValue) {
    const res = await fetch(`/api/quizzes/${quizId}/questions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(value),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error ?? "Не удалось добавить вопрос");
    }
    setAddingQuestion(false);
    await loadQuiz();
  }

  async function handleUpdateQuestion(questionId: string, value: QuestionFormValue) {
    const res = await fetch(`/api/quizzes/${quizId}/questions/${questionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(value),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error ?? "Не удалось сохранить вопрос");
    }
    setEditingQuestionId(null);
    await loadQuiz();
  }

  async function handleDeleteQuestion(questionId: string) {
    if (!confirm("Удалить вопрос?")) return;
    await fetch(`/api/quizzes/${quizId}/questions/${questionId}`, { method: "DELETE" });
    await loadQuiz();
  }

  async function handleStartQuiz() {
    setStarting(true);
    setError(null);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quizId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Не удалось запустить квиз");
        return;
      }
      router.push(`/host/${data.session.id}`);
    } finally {
      setStarting(false);
    }
  }

  if (loading) return <p className="p-8">Загрузка...</p>;
  if (!quiz) return <p className="p-8 text-red-600">{error ?? "Квиз не найден"}</p>;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{quiz.title}</h1>
        <button
          onClick={handleStartQuiz}
          disabled={starting || !quiz.questions?.length}
          className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
          title={!quiz.questions?.length ? "Добавьте хотя бы один вопрос" : undefined}
        >
          {starting ? "Запускаем..." : "Запустить квиз"}
        </button>
      </div>

      <form onSubmit={handleSaveSettings} className="flex flex-col gap-4 rounded border border-black/15 p-4">
        <h2 className="font-medium">Настройки</h2>
        <label className="flex flex-col gap-1 text-sm">
          Название
          <input
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
            rows={2}
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
        <button
          type="submit"
          disabled={savingSettings}
          className="self-start rounded border border-black/20 px-4 py-2 text-sm disabled:opacity-50"
        >
          {savingSettings ? "Сохраняем..." : "Сохранить настройки"}
        </button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex flex-col gap-4">
        <h2 className="font-medium">Вопросы ({quiz.questions?.length ?? 0})</h2>

        {quiz.questions?.map((question, index) =>
          editingQuestionId === question.id ? (
            <QuestionEditor
              key={question.id}
              initial={question}
              defaultQuestionTimeSec={quiz.defaultQuestionTimeSec}
              onSubmit={(value) => handleUpdateQuestion(question.id, value)}
              onCancel={() => setEditingQuestionId(null)}
            />
          ) : (
            <div key={question.id} className="flex items-start justify-between gap-4 rounded border border-black/15 p-4">
              <div>
                <p className="text-sm text-black/60">
                  Вопрос {index + 1} · {question.contentType === "IMAGE" ? "изображение" : "текст"} ·{" "}
                  {question.answerType === "MULTIPLE" ? "несколько ответов" : "один ответ"} ·{" "}
                  {question.points} баллов
                </p>
                <p className="font-medium">{question.text}</p>
                <ul className="mt-2 list-disc pl-5 text-sm text-black/70">
                  {question.options.map((o) => (
                    <li key={o.id} className={o.isCorrect ? "font-semibold" : undefined}>
                      {o.text}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex shrink-0 gap-3 text-sm">
                <button onClick={() => setEditingQuestionId(question.id)} className="underline">
                  Изменить
                </button>
                <button
                  onClick={() => handleDeleteQuestion(question.id)}
                  className="text-red-600 underline"
                >
                  Удалить
                </button>
              </div>
            </div>
          )
        )}

        {addingQuestion ? (
          <QuestionEditor
            defaultQuestionTimeSec={quiz.defaultQuestionTimeSec}
            onSubmit={handleCreateQuestion}
            onCancel={() => setAddingQuestion(false)}
          />
        ) : (
          <button
            onClick={() => setAddingQuestion(true)}
            className="self-start rounded border border-black/20 px-4 py-2 text-sm"
          >
            + Добавить вопрос
          </button>
        )}
      </div>
    </div>
  );
}
