import { prisma } from "@quiz/db";

export async function ensureParticipant(sessionId: string, userId: string) {
  return prisma.sessionParticipant.upsert({
    where: { sessionId_userId: { sessionId, userId } },
    update: {},
    create: { sessionId, userId },
  });
}

export async function recordAnswer(
  participantId: string,
  questionId: string,
  selectedOptionIds: string[],
  isCorrect: boolean,
  pointsAwarded: number
) {
  await prisma.answer.upsert({
    where: { participantId_questionId: { participantId, questionId } },
    update: {},
    create: { participantId, questionId, selectedOptionIds, isCorrect, pointsAwarded },
  });
  if (pointsAwarded > 0) {
    await prisma.sessionParticipant.update({
      where: { id: participantId },
      data: { score: { increment: pointsAwarded } },
    });
  }
}

export async function markSessionActive(sessionId: string) {
  await prisma.quizSession.update({
    where: { id: sessionId },
    data: { status: "ACTIVE", startedAt: new Date(), currentQuestionIndex: 0 },
  });
}

export async function updateCurrentQuestionIndex(sessionId: string, index: number) {
  await prisma.quizSession.update({
    where: { id: sessionId },
    data: { currentQuestionIndex: index },
  });
}

export async function finishSession(sessionId: string) {
  await prisma.quizSession.update({
    where: { id: sessionId },
    data: { status: "FINISHED", endedAt: new Date() },
  });
}
