"use client";

import { useState } from "react";
import type { AnswerType, QuestionContentType, QuestionDto } from "@/lib/types";

export interface QuestionFormValue {
  text: string;
  contentType: QuestionContentType;
  imageUrl: string | null;
  answerType: AnswerType;
  points: number;
  timeLimitSec: number | null;
  options: { text: string; isCorrect: boolean }[];
}

interface QuestionEditorProps {
  initial?: QuestionDto;
  defaultQuestionTimeSec: number;
  onSubmit: (value: QuestionFormValue) => Promise<void>;
  onCancel: () => void;
}

function emptyOptions() {
  return [
    { text: "", isCorrect: false },
    { text: "", isCorrect: false },
  ];
}

export default function QuestionEditor({
  initial,
  defaultQuestionTimeSec,
  onSubmit,
  onCancel,
}: QuestionEditorProps) {
  const [text, setText] = useState(initial?.text ?? "");
  const [contentType, setContentType] = useState<QuestionContentType>(
    initial?.contentType ?? "TEXT"
  );
  const [imageUrl, setImageUrl] = useState<string | null>(initial?.imageUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const [answerType, setAnswerType] = useState<AnswerType>(initial?.answerType ?? "SINGLE");
  const [points, setPoints] = useState(initial?.points ?? 1000);
  const [timeLimitSec, setTimeLimitSec] = useState<number | "">(
    initial?.timeLimitSec ?? ""
  );
  const [options, setOptions] = useState(
    initial
      ? initial.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect }))
      : emptyOptions()
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/uploads", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Не удалось загрузить изображение");
        return;
      }
      setImageUrl(data.url);
    } finally {
      setUploading(false);
    }
  }

  function updateOptionText(index: number, value: string) {
    setOptions((prev) => prev.map((o, i) => (i === index ? { ...o, text: value } : o)));
  }

  function toggleOptionCorrect(index: number) {
    setOptions((prev) =>
      prev.map((o, i) => {
        if (answerType === "SINGLE") {
          return { ...o, isCorrect: i === index };
        }
        return i === index ? { ...o, isCorrect: !o.isCorrect } : o;
      })
    );
  }

  function addOption() {
    if (options.length >= 6) return;
    setOptions((prev) => [...prev, { text: "", isCorrect: false }]);
  }

  function removeOption(index: number) {
    if (options.length <= 2) return;
    setOptions((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!text.trim()) {
      setError("Укажите текст вопроса");
      return;
    }
    if (contentType === "IMAGE" && !imageUrl) {
      setError("Загрузите изображение для вопроса");
      return;
    }
    const filledOptions = options.filter((o) => o.text.trim());
    if (filledOptions.length < 2) {
      setError("Добавьте минимум 2 варианта ответа");
      return;
    }
    if (!filledOptions.some((o) => o.isCorrect)) {
      setError("Отметьте хотя бы один правильный ответ");
      return;
    }

    setSaving(true);
    try {
      await onSubmit({
        text: text.trim(),
        contentType,
        imageUrl: contentType === "IMAGE" ? imageUrl : null,
        answerType,
        points,
        timeLimitSec: timeLimitSec === "" ? null : Number(timeLimitSec),
        options: filledOptions,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить вопрос");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded border border-black/15 p-4"
    >
      <label className="flex flex-col gap-1 text-sm">
        Текст вопроса
        <textarea
          required
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="rounded border border-black/15 px-3 py-2"
          rows={2}
        />
      </label>

      <div className="flex gap-6 text-sm">
        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1 font-medium">Тип содержимого</legend>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={contentType === "TEXT"}
              onChange={() => setContentType("TEXT")}
            />
            Текст
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={contentType === "IMAGE"}
              onChange={() => setContentType("IMAGE")}
            />
            Изображение
          </label>
        </fieldset>

        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1 font-medium">Тип ответа</legend>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={answerType === "SINGLE"}
              onChange={() => setAnswerType("SINGLE")}
            />
            Один правильный
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={answerType === "MULTIPLE"}
              onChange={() => setAnswerType("MULTIPLE")}
            />
            Несколько правильных
          </label>
        </fieldset>
      </div>

      {contentType === "IMAGE" && (
        <div className="flex flex-col gap-2 text-sm">
          <input type="file" accept="image/*" onChange={handleImageChange} />
          {uploading && <p className="text-black/60">Загрузка...</p>}
          {imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="Превью вопроса" className="max-h-40 rounded" />
          )}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Варианты ответа</span>
        {options.map((option, index) => (
          <div key={index} className="flex items-center gap-2">
            <input
              type={answerType === "SINGLE" ? "radio" : "checkbox"}
              checked={option.isCorrect}
              onChange={() => toggleOptionCorrect(index)}
            />
            <input
              value={option.text}
              onChange={(e) => updateOptionText(index, e.target.value)}
              placeholder={`Вариант ${index + 1}`}
              className="flex-1 rounded border border-black/15 px-3 py-1.5 text-sm"
            />
            {options.length > 2 && (
              <button
                type="button"
                onClick={() => removeOption(index)}
                className="text-sm text-red-600"
              >
                Удалить
              </button>
            )}
          </div>
        ))}
        {options.length < 6 && (
          <button
            type="button"
            onClick={addOption}
            className="self-start text-sm underline"
          >
            + Добавить вариант
          </button>
        )}
      </div>

      <div className="flex gap-6 text-sm">
        <label className="flex flex-col gap-1">
          Баллы за правильный ответ
          <input
            type="number"
            min={0}
            value={points}
            onChange={(e) => setPoints(Number(e.target.value))}
            className="w-32 rounded border border-black/15 px-3 py-1.5"
          />
        </label>
        <label className="flex flex-col gap-1">
          Время на ответ (сек), по умолчанию {defaultQuestionTimeSec}
          <input
            type="number"
            min={5}
            max={300}
            value={timeLimitSec}
            onChange={(e) =>
              setTimeLimitSec(e.target.value === "" ? "" : Number(e.target.value))
            }
            placeholder={String(defaultQuestionTimeSec)}
            className="w-32 rounded border border-black/15 px-3 py-1.5"
          />
        </label>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving || uploading}
          className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {saving ? "Сохраняем..." : "Сохранить вопрос"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-black/20 px-4 py-2 text-sm"
        >
          Отмена
        </button>
      </div>
    </form>
  );
}
