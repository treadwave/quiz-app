export type QuestionContentType = "TEXT" | "IMAGE";
export type AnswerType = "SINGLE" | "MULTIPLE";
export type SessionStatus = "LOBBY" | "ACTIVE" | "FINISHED";

export interface OptionDto {
  id: string;
  text: string;
  isCorrect: boolean;
  order: number;
}

export interface QuestionDto {
  id: string;
  quizId: string;
  order: number;
  text: string;
  contentType: QuestionContentType;
  imageUrl: string | null;
  answerType: AnswerType;
  timeLimitSec: number | null;
  points: number;
  options: OptionDto[];
}

export interface QuizDto {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  ownerId: string;
  defaultQuestionTimeSec: number;
  createdAt: string;
  updatedAt: string;
  questions?: QuestionDto[];
  _count?: { questions: number; sessions: number };
}

export interface QuizSessionDto {
  id: string;
  quizId: string;
  hostId: string;
  roomCode: string;
  status: SessionStatus;
  currentQuestionIndex: number;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  quiz?: { id: string; title: string };
  participants?: SessionParticipantDto[];
}

export interface SessionParticipantDto {
  id: string;
  userId: string;
  score: number;
  joinedAt: string;
  user?: { id: string; name: string };
}
