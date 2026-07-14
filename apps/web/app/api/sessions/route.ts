import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { generateRoomCode } from "@/lib/roomCode";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const quizId = typeof body?.quizId === "string" ? body.quizId : "";
  if (!quizId) {
    return NextResponse.json({ error: "Не указан квиз" }, { status: 400 });
  }

  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: { _count: { select: { questions: true } } },
  });
  if (!quiz || quiz.ownerId !== user.sub) {
    return NextResponse.json({ error: "Квиз не найден" }, { status: 404 });
  }
  if (quiz._count.questions === 0) {
    return NextResponse.json(
      { error: "Добавьте хотя бы один вопрос перед запуском" },
      { status: 400 }
    );
  }

  let session = null;
  for (let attempt = 0; attempt < 5 && !session; attempt++) {
    const roomCode = generateRoomCode();
    try {
      session = await prisma.quizSession.create({
        data: { quizId, hostId: user.sub, roomCode },
      });
    } catch (err) {
      const isUniqueConflict =
        typeof err === "object" &&
        err !== null &&
        "code" in err &&
        (err as { code?: string }).code === "P2002";
      if (!isUniqueConflict) throw err;
    }
  }
  if (!session) {
    return NextResponse.json(
      { error: "Не удалось создать сессию, попробуйте ещё раз" },
      { status: 500 }
    );
  }

  return NextResponse.json({ session }, { status: 201 });
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const as = url.searchParams.get("as");

  if (as === "participant") {
    const participations = await prisma.sessionParticipant.findMany({
      where: { userId: user.sub },
      orderBy: { joinedAt: "desc" },
      include: {
        session: { include: { quiz: { select: { id: true, title: true } } } },
      },
    });
    return NextResponse.json({ participations });
  }

  const sessions = await prisma.quizSession.findMany({
    where: { hostId: user.sub },
    orderBy: { createdAt: "desc" },
    include: {
      quiz: { select: { id: true, title: true } },
      _count: { select: { participants: true } },
    },
  });
  return NextResponse.json({ sessions });
}
