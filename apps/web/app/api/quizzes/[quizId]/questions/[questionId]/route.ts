import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { parseQuestionInput } from "@/lib/questionValidation";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ quizId: string; questionId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { quizId, questionId } = await params;

  const quiz = await prisma.quiz.findUnique({ where: { id: quizId } });
  if (!quiz || quiz.ownerId !== user.sub) {
    return NextResponse.json({ error: "Квиз не найден" }, { status: 404 });
  }
  const question = await prisma.question.findUnique({ where: { id: questionId } });
  if (!question || question.quizId !== quizId) {
    return NextResponse.json({ error: "Вопрос не найден" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = parseQuestionInput(body);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const { text, contentType, imageUrl, answerType, points, timeLimitSec, options } =
    parsed.data;

  const updated = await prisma.$transaction(async (tx) => {
    await tx.option.deleteMany({ where: { questionId } });
    return tx.question.update({
      where: { id: questionId },
      data: {
        text,
        contentType,
        imageUrl,
        answerType,
        points,
        timeLimitSec,
        options: {
          create: options.map((o, idx) => ({
            text: o.text,
            isCorrect: o.isCorrect,
            order: idx,
          })),
        },
      },
      include: { options: { orderBy: { order: "asc" } } },
    });
  });

  return NextResponse.json({ question: updated });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ quizId: string; questionId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { quizId, questionId } = await params;

  const quiz = await prisma.quiz.findUnique({ where: { id: quizId } });
  if (!quiz || quiz.ownerId !== user.sub) {
    return NextResponse.json({ error: "Квиз не найден" }, { status: 404 });
  }

  await prisma.question.deleteMany({ where: { id: questionId, quizId } });
  return NextResponse.json({ ok: true });
}
