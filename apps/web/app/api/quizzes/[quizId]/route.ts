import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

async function loadOwnedQuiz(quizId: string, userId: string) {
  const quiz = await prisma.quiz.findUnique({ where: { id: quizId } });
  if (!quiz || quiz.ownerId !== userId) return null;
  return quiz;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ quizId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { quizId } = await params;

  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: {
      questions: {
        orderBy: { order: "asc" },
        include: { options: { orderBy: { order: "asc" } } },
      },
    },
  });
  if (!quiz || quiz.ownerId !== user.sub) {
    return NextResponse.json({ error: "Квиз не найден" }, { status: 404 });
  }
  return NextResponse.json({ quiz });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ quizId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { quizId } = await params;
  const existing = await loadOwnedQuiz(quizId, user.sub);
  if (!existing) return NextResponse.json({ error: "Квиз не найден" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const data: {
    title?: string;
    description?: string | null;
    category?: string | null;
    defaultQuestionTimeSec?: number;
  } = {};
  if (typeof body?.title === "string" && body.title.trim()) data.title = body.title.trim();
  if (typeof body?.description === "string") data.description = body.description.trim() || null;
  if (typeof body?.category === "string") data.category = body.category.trim() || null;
  if (Number.isFinite(body?.defaultQuestionTimeSec)) {
    data.defaultQuestionTimeSec = Math.max(5, Math.min(300, Math.round(body.defaultQuestionTimeSec)));
  }

  const quiz = await prisma.quiz.update({ where: { id: quizId }, data });
  return NextResponse.json({ quiz });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ quizId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { quizId } = await params;
  const existing = await loadOwnedQuiz(quizId, user.sub);
  if (!existing) return NextResponse.json({ error: "Квиз не найден" }, { status: 404 });

  await prisma.quiz.delete({ where: { id: quizId } });
  return NextResponse.json({ ok: true });
}
