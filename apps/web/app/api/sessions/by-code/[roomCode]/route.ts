import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ roomCode: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { roomCode } = await params;

  const session = await prisma.quizSession.findUnique({
    where: { roomCode: roomCode.toUpperCase() },
    include: { quiz: { select: { title: true } } },
  });

  if (!session) {
    return NextResponse.json({ error: "Комната не найдена" }, { status: 404 });
  }
  if (session.status === "FINISHED") {
    return NextResponse.json({ error: "Эта сессия уже завершена" }, { status: 400 });
  }

  return NextResponse.json({
    sessionId: session.id,
    roomCode: session.roomCode,
    status: session.status,
    quizTitle: session.quiz.title,
  });
}
