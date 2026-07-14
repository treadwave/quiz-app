import { prisma } from "@quiz/db";
import {
  SOCKET_EVENTS,
  type AnswerType,
  type AuthTokenPayload,
  type LeaderboardEntry,
  type LobbyUpdatePayload,
  type QuestionContentType,
  type QuestionShowPayload,
} from "@quiz/shared";
import type { Server } from "socket.io";
import type { ClientToServerEvents, InterServerEvents, ServerToClientEvents, SocketData } from "./types";
import {
  ensureParticipant,
  finishSession,
  markSessionActive,
  recordAnswer,
  updateCurrentQuestionIndex,
} from "./persistence";

export type TypedServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

interface GameQuestion {
  id: string;
  text: string;
  contentType: QuestionContentType;
  imageUrl: string | null;
  answerType: AnswerType;
  timeLimitSec: number;
  points: number;
  options: { id: string; text: string; isCorrect: boolean }[];
}

interface ParticipantState {
  userId: string;
  participantDbId: string;
  name: string;
  socketId: string | null;
  score: number;
}

interface AnswerRecord {
  selectedOptionIds: string[];
  answeredAt: number;
}

export type GameStatus = "LOBBY" | "ACTIVE" | "FINISHED";

export interface GameState {
  sessionId: string;
  roomCode: string;
  hostId: string;
  hostSocketId: string | null;
  quizTitle: string;
  questions: GameQuestion[];
  status: GameStatus;
  currentQuestionIndex: number;
  participants: Map<string, ParticipantState>;
  currentAnswers: Map<string, AnswerRecord>;
  questionTimer: ReturnType<typeof setTimeout> | null;
  questionStartedAt: number | null;
}

const gamesBySessionId = new Map<string, GameState>();

export function roomName(roomCode: string): string {
  return `session:${roomCode}`;
}

export function getGameByRoomCode(roomCode: string): GameState | undefined {
  const upper = roomCode.toUpperCase();
  for (const game of gamesBySessionId.values()) {
    if (game.roomCode === upper) return game;
  }
  return undefined;
}

export function getGameBySessionId(sessionId: string): GameState | undefined {
  return gamesBySessionId.get(sessionId);
}

export async function loadOrGetGameForHost(
  sessionId: string,
  hostUserId: string
): Promise<GameState> {
  const existing = gamesBySessionId.get(sessionId);
  if (existing) {
    if (existing.hostId !== hostUserId) {
      throw new Error("Нет доступа к этой сессии");
    }
    return existing;
  }

  const session = await prisma.quizSession.findUnique({
    where: { id: sessionId },
    include: {
      quiz: {
        include: {
          questions: {
            orderBy: { order: "asc" },
            include: { options: { orderBy: { order: "asc" } } },
          },
        },
      },
      participants: { include: { user: { select: { id: true, name: true } } } },
    },
  });

  if (!session) throw new Error("Сессия не найдена");
  if (session.hostId !== hostUserId) throw new Error("Нет доступа к этой сессии");
  if (session.status === "FINISHED") throw new Error("Сессия уже завершена");

  const questions: GameQuestion[] = session.quiz.questions.map((q) => ({
    id: q.id,
    text: q.text,
    contentType: q.contentType,
    imageUrl: q.imageUrl,
    answerType: q.answerType,
    timeLimitSec: q.timeLimitSec ?? session.quiz.defaultQuestionTimeSec,
    points: q.points,
    options: q.options.map((o) => ({ id: o.id, text: o.text, isCorrect: o.isCorrect })),
  }));

  const game: GameState = {
    sessionId: session.id,
    roomCode: session.roomCode,
    hostId: session.hostId,
    hostSocketId: null,
    quizTitle: session.quiz.title,
    questions,
    status: session.status,
    currentQuestionIndex: session.currentQuestionIndex,
    participants: new Map(),
    currentAnswers: new Map(),
    questionTimer: null,
    questionStartedAt: null,
  };

  for (const p of session.participants) {
    game.participants.set(p.userId, {
      userId: p.userId,
      participantDbId: p.id,
      name: p.user.name,
      socketId: null,
      score: p.score,
    });
  }

  gamesBySessionId.set(sessionId, game);
  return game;
}

export async function addParticipant(
  game: GameState,
  user: AuthTokenPayload,
  socketId: string
): Promise<ParticipantState> {
  let participant = game.participants.get(user.sub);
  if (!participant) {
    const dbParticipant = await ensureParticipant(game.sessionId, user.sub);
    participant = {
      userId: user.sub,
      participantDbId: dbParticipant.id,
      name: user.name,
      socketId,
      score: dbParticipant.score,
    };
    game.participants.set(user.sub, participant);
  } else {
    participant.socketId = socketId;
  }
  return participant;
}

export function removeSocket(game: GameState, socketId: string) {
  if (game.hostSocketId === socketId) {
    game.hostSocketId = null;
    return;
  }
  for (const participant of game.participants.values()) {
    if (participant.socketId === socketId) {
      participant.socketId = null;
      return;
    }
  }
}

export function buildLobbyPayload(game: GameState): LobbyUpdatePayload {
  return {
    sessionId: game.sessionId,
    roomCode: game.roomCode,
    participants: [...game.participants.values()].map((p) => ({
      userId: p.userId,
      name: p.name,
    })),
  };
}

function buildLeaderboard(game: GameState): LeaderboardEntry[] {
  return [...game.participants.values()]
    .sort((a, b) => b.score - a.score)
    .map((p) => ({ userId: p.userId, name: p.name, score: p.score }));
}

function buildQuestionShowPayload(game: GameState, index: number): QuestionShowPayload {
  const question = game.questions[index];
  return {
    index,
    totalQuestions: game.questions.length,
    questionId: question.id,
    text: question.text,
    contentType: question.contentType,
    imageUrl: question.imageUrl,
    answerType: question.answerType,
    options: question.options.map((o) => ({ id: o.id, text: o.text })),
    timeLimitSec: question.timeLimitSec,
    startedAt: new Date(game.questionStartedAt ?? Date.now()).toISOString(),
  };
}

function isAnswerCorrect(question: GameQuestion, selectedOptionIds: string[]): boolean {
  const correctIds = question.options
    .filter((o) => o.isCorrect)
    .map((o) => o.id)
    .sort();
  const selected = [...new Set(selectedOptionIds)].sort();
  if (correctIds.length !== selected.length) return false;
  return correctIds.every((id, i) => id === selected[i]);
}

function clearQuestionTimer(game: GameState) {
  if (game.questionTimer) {
    clearTimeout(game.questionTimer);
    game.questionTimer = null;
  }
}

export function submitAnswer(
  game: GameState,
  userId: string,
  questionId: string,
  selectedOptionIds: string[]
): boolean {
  if (game.status !== "ACTIVE") return false;
  const currentQuestion = game.questions[game.currentQuestionIndex];
  if (!currentQuestion || currentQuestion.id !== questionId) return false;
  if (!game.participants.has(userId)) return false;
  if (game.currentAnswers.has(userId)) return false;
  game.currentAnswers.set(userId, { selectedOptionIds, answeredAt: Date.now() });
  return true;
}

export async function startQuiz(io: TypedServer, game: GameState) {
  if (game.status !== "LOBBY") return;
  game.status = "ACTIVE";
  await markSessionActive(game.sessionId).catch((err) => console.error(err));
  showQuestion(io, game, 0);
}

export function showQuestion(io: TypedServer, game: GameState, index: number) {
  clearQuestionTimer(game);
  game.currentQuestionIndex = index;
  game.currentAnswers.clear();
  game.questionStartedAt = Date.now();
  const question = game.questions[index];

  updateCurrentQuestionIndex(game.sessionId, index).catch((err) => console.error(err));

  io.to(roomName(game.roomCode)).emit(
    SOCKET_EVENTS.QUESTION_SHOW,
    buildQuestionShowPayload(game, index)
  );

  game.questionTimer = setTimeout(() => {
    finishCurrentQuestion(io, game).catch((err) => console.error(err));
  }, question.timeLimitSec * 1000);
}

export async function finishCurrentQuestion(io: TypedServer, game: GameState) {
  clearQuestionTimer(game);
  const question = game.questions[game.currentQuestionIndex];
  if (!question) return;

  const optionCounts: Record<string, number> = {};
  for (const option of question.options) optionCounts[option.id] = 0;

  for (const participant of game.participants.values()) {
    const answer = game.currentAnswers.get(participant.userId);
    const selectedOptionIds = answer?.selectedOptionIds ?? [];
    for (const id of selectedOptionIds) {
      if (id in optionCounts) optionCounts[id] += 1;
    }
    const correct = isAnswerCorrect(question, selectedOptionIds);
    const pointsAwarded = correct ? question.points : 0;
    if (pointsAwarded > 0) participant.score += pointsAwarded;

    await recordAnswer(
      participant.participantDbId,
      question.id,
      selectedOptionIds,
      correct,
      pointsAwarded
    ).catch((err) => console.error(err));
  }

  io.to(roomName(game.roomCode)).emit(SOCKET_EVENTS.QUESTION_RESULTS, {
    questionId: question.id,
    correctOptionIds: question.options.filter((o) => o.isCorrect).map((o) => o.id),
    optionCounts,
    leaderboard: buildLeaderboard(game),
  });
}

export async function endQuiz(io: TypedServer, game: GameState) {
  clearQuestionTimer(game);
  game.status = "FINISHED";
  await finishSession(game.sessionId).catch((err) => console.error(err));
  io.to(roomName(game.roomCode)).emit(SOCKET_EVENTS.QUIZ_ENDED, {
    leaderboard: buildLeaderboard(game),
  });
  gamesBySessionId.delete(game.sessionId);
}

export function hasPendingTimer(game: GameState): boolean {
  return game.questionTimer !== null;
}
