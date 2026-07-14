export interface OptionInput {
  text: string;
  isCorrect: boolean;
}

export interface ParsedQuestionInput {
  text: string;
  contentType: "TEXT" | "IMAGE";
  imageUrl: string | null;
  answerType: "SINGLE" | "MULTIPLE";
  points: number;
  timeLimitSec: number | null;
  options: OptionInput[];
}

export function parseQuestionInput(
  body: Record<string, unknown> | null
): { data: ParsedQuestionInput } | { error: string } {
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  const contentType = body?.contentType === "IMAGE" ? "IMAGE" : "TEXT";
  const imageUrl =
    typeof body?.imageUrl === "string" && body.imageUrl.trim()
      ? body.imageUrl.trim()
      : null;
  const answerType = body?.answerType === "MULTIPLE" ? "MULTIPLE" : "SINGLE";
  const points = Number.isFinite(body?.points as number)
    ? Math.max(0, Math.round(body?.points as number))
    : 1000;
  const timeLimitSec = Number.isFinite(body?.timeLimitSec as number)
    ? Math.max(5, Math.min(300, Math.round(body?.timeLimitSec as number)))
    : null;
  const options: OptionInput[] = Array.isArray(body?.options)
    ? (body?.options as Array<Record<string, unknown>>)
        .map((o) => ({
          text: typeof o?.text === "string" ? o.text.trim() : "",
          isCorrect: Boolean(o?.isCorrect),
        }))
        .filter((o) => o.text)
    : [];

  if (!text) return { error: "Укажите текст вопроса" };
  if (contentType === "IMAGE" && !imageUrl) {
    return { error: "Загрузите изображение для вопроса" };
  }
  if (options.length < 2 || options.length > 6) {
    return { error: "Добавьте от 2 до 6 вариантов ответа" };
  }
  if (!options.some((o) => o.isCorrect)) {
    return { error: "Отметьте хотя бы один правильный ответ" };
  }
  if (answerType === "SINGLE" && options.filter((o) => o.isCorrect).length > 1) {
    return {
      error: "Для одиночного выбора можно отметить только один правильный ответ",
    };
  }

  return {
    data: { text, contentType, imageUrl, answerType, points, timeLimitSec, options },
  };
}
