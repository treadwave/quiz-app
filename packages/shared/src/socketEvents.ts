// Shared Socket.IO event names and payload contracts between apps/web and apps/realtime.

export type QuestionContentType = "TEXT" | "IMAGE";
export type AnswerType = "SINGLE" | "MULTIPLE";

export const SOCKET_EVENTS = {
  // client -> server
  HOST_JOIN: "host:join",
  HOST_START: "host:start",
  HOST_NEXT: "host:next",
  HOST_END: "host:end",
  PARTICIPANT_JOIN: "participant:join",
  PARTICIPANT_ANSWER: "participant:answer",

  // server -> client
  LOBBY_UPDATE: "lobby:update",
  QUESTION_SHOW: "question:show",
  QUESTION_RESULTS: "question:results",
  QUIZ_ENDED: "quiz:ended",
  ERROR: "error",
} as const;

export interface LobbyParticipant {
  userId: string;
  name: string;
}

export interface HostJoinPayload {
  sessionId: string;
}

export interface ParticipantJoinPayload {
  roomCode: string;
}

export interface ParticipantAnswerPayload {
  questionId: string;
  selectedOptionIds: string[];
}

export interface QuestionOptionDto {
  id: string;
  text: string;
}

export interface QuestionShowPayload {
  index: number;
  totalQuestions: number;
  questionId: string;
  text: string;
  contentType: QuestionContentType;
  imageUrl: string | null;
  answerType: AnswerType;
  options: QuestionOptionDto[];
  timeLimitSec: number;
  startedAt: string;
}

export interface LeaderboardEntry {
  userId: string;
  name: string;
  score: number;
}

export interface QuestionResultsPayload {
  questionId: string;
  correctOptionIds: string[];
  optionCounts: Record<string, number>;
  leaderboard: LeaderboardEntry[];
}

export interface QuizEndedPayload {
  leaderboard: LeaderboardEntry[];
}

export interface LobbyUpdatePayload {
  sessionId: string;
  roomCode: string;
  participants: LobbyParticipant[];
}

export interface SocketErrorPayload {
  message: string;
}

export interface ClientToServerEvents {
  "host:join": (payload: HostJoinPayload) => void;
  "host:start": () => void;
  "host:next": () => void;
  "host:end": () => void;
  "participant:join": (payload: ParticipantJoinPayload) => void;
  "participant:answer": (payload: ParticipantAnswerPayload) => void;
}

export interface ServerToClientEvents {
  "lobby:update": (payload: LobbyUpdatePayload) => void;
  "question:show": (payload: QuestionShowPayload) => void;
  "question:results": (payload: QuestionResultsPayload) => void;
  "quiz:ended": (payload: QuizEndedPayload) => void;
  error: (payload: SocketErrorPayload) => void;
}
