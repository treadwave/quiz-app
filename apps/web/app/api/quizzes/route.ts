import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const quizzes = await prisma.quiz.findMany({
    where: { ownerId: user.sub },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { questions: true, sessions: true } } },
  });
  return NextResponse.json({ quizzes });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  if (!title) {
    return NextResponse.json({ error: "Укажите название квиза" }, { status: 400 });
  }
  const description = typeof body?.description === "string" ? body.description.trim() : "";
  const category = typeof body?.category === "string" ? body.category.trim() : "";
  const defaultQuestionTimeSec = Number.isFinite(body?.defaultQuestionTimeSec)
    ? Math.max(5, Math.min(300, Math.round(body.defaultQuestionTimeSec)))
    : 20;

  const quiz = await prisma.quiz.create({
    data: {
      title,
      description: description || null,
      category: category || null,
      defaultQuestionTimeSec,
      ownerId: user.sub,
    },
  });
  return NextResponse.json({ quiz }, { status: 201 });
}
