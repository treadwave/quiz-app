import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { parseQuestionInput } from "@/lib/questionValidation";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ quizId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { quizId } = await params;

  const quiz = await prisma.quiz.findUnique({ where: { id: quizId } });
  if (!quiz || quiz.ownerId !== user.sub) {
    return NextResponse.json({ error: "Квиз не найден" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = parseQuestionInput(body);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const { text, contentType, imageUrl, answerType, points, timeLimitSec, options } =
    parsed.data;

  const lastQuestion = await prisma.question.findFirst({
    where: { quizId },
    orderBy: { order: "desc" },
  });
  const order = lastQuestion ? lastQuestion.order + 1 : 0;

  const question = await prisma.question.create({
    data: {
      quizId,
      order,
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

  return NextResponse.json({ question }, { status: 201 });
}
