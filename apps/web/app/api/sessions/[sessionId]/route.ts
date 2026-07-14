import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { sessionId } = await params;

  const session = await prisma.quizSession.findUnique({
    where: { id: sessionId },
    include: {
      quiz: {
        select: {
          id: true,
          title: true,
          questions: { select: { id: true }, orderBy: { order: "asc" } },
        },
      },
      participants: {
        orderBy: { score: "desc" },
        include: { user: { select: { id: true, name: true } } },
      },
    },
  });

  if (!session) {
    return NextResponse.json({ error: "Сессия не найдена" }, { status: 404 });
  }

  const isHost = session.hostId === user.sub;
  const isParticipant = session.participants.some((p) => p.userId === user.sub);
  if (!isHost && !isParticipant) {
    return NextResponse.json({ error: "Нет доступа к этой сессии" }, { status: 403 });
  }

  return NextResponse.json({ session, isHost });
}
