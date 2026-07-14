"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type {
  LobbyParticipant,
  QuestionResultsPayload,
  QuestionShowPayload,
  LeaderboardEntry,
} from "@quiz/shared";
import { SOCKET_EVENTS } from "@quiz/shared";
import { createSocket, type AppSocket } from "@/lib/socket";
import Timer from "@/components/Timer";
import Leaderboard from "@/components/Leaderboard";

type Phase = "loading" | "lobby" | "question" | "results" | "ended";

export default function HostSessionPage() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params.sessionId;
  const socketRef = useRef<AppSocket | null>(null);

  const [phase, setPhase] = useState<Phase>("loading");
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [quizTitle, setQuizTitle] = useState<string>("");
  const [participants, setParticipants] = useState<LobbyParticipant[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<QuestionShowPayload | null>(null);
  const [currentResults, setCurrentResults] = useState<QuestionResultsPayload | null>(null);
  const [finalLeaderboard, setFinalLeaderboard] = useState<LeaderboardEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const res = await fetch(`/api/sessions/${sessionId}`);
      const data = await res.json();
      if (!res.ok) {
        if (!cancelled) setError(data.error ?? "Не удалось загрузить сессию");
        return;
      }
      if (!data.isHost) {
        if (!cancelled) setError("Вы не организатор этой сессии");
        return;
      }
      if (cancelled) return;
      setRoomCode(data.session.roomCode);
      setQuizTitle(data.session.quiz.title);

      if (data.session.status === "FINISHED") {
        setFinalLeaderboard(
          data.session.participants.map(
            (p: { userId: string; score: number; user: { name: string } }) => ({
              userId: p.userId,
              name: p.user.name,
              score: p.score,
            })
          )
        );
        setPhase("ended");
        return;
      }
      setPhase("lobby");

      const socket = createSocket();
      socketRef.current = socket;

      socket.on("connect", () => {
        socket.emit(SOCKET_EVENTS.HOST_JOIN, { sessionId });
      });

      socket.on(SOCKET_EVENTS.LOBBY_UPDATE, (payload) => {
        setParticipants(payload.participants);
      });

      socket.on(SOCKET_EVENTS.QUESTION_SHOW, (payload) => {
        setCurrentQuestion(payload);
        setCurrentResults(null);
        setPhase("question");
      });

      socket.on(SOCKET_EVENTS.QUESTION_RESULTS, (payload) => {
        setCurrentResults(payload);
        setPhase("results");
      });

      socket.on(SOCKET_EVENTS.QUIZ_ENDED, (payload) => {
        setFinalLeaderboard(payload.leaderboard);
        setPhase("ended");
      });

      socket.on(SOCKET_EVENTS.ERROR, (payload) => {
        setError(payload.message);
      });
    }

    init();

    return () => {
      cancelled = true;
      socketRef.current?.disconnect();
    };
  }, [sessionId]);

  function handleStart() {
    socketRef.current?.emit(SOCKET_EVENTS.HOST_START);
  }

  function handleNext() {
    socketRef.current?.emit(SOCKET_EVENTS.HOST_NEXT);
  }

  function handleEnd() {
    socketRef.current?.emit(SOCKET_EVENTS.HOST_END);
  }

  if (error) {
    return <p className="p-8 text-red-600">{error}</p>;
  }
  if (phase === "loading") {
    return <p className="p-8">Загрузка...</p>;
  }

  const isLastQuestion =
    currentQuestion !== null && currentQuestion.index === currentQuestion.totalQuestions - 1;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-12">
      <h1 className="text-2xl font-semibold">{quizTitle}</h1>

      {phase === "lobby" && (
        <div className="flex flex-col gap-6">
          <div className="rounded border border-black/15 p-6 text-center">
            <p className="text-sm text-black/60">Код комнаты</p>
            <p className="text-4xl font-bold tracking-widest">{roomCode}</p>
          </div>
          <div>
            <h2 className="mb-2 font-medium">Участники ({participants.length})</h2>
            <ul className="flex flex-wrap gap-2">
              {participants.map((p) => (
                <li key={p.userId} className="rounded-full bg-black/5 px-3 py-1 text-sm">
                  {p.name}
                </li>
              ))}
            </ul>
          </div>
          <button
            onClick={handleStart}
            className="self-start rounded bg-black px-4 py-2 text-white"
          >
            Начать квиз
          </button>
        </div>
      )}

      {phase === "question" && currentQuestion && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-black/60">
              Вопрос {currentQuestion.index + 1} из {currentQuestion.totalQuestions}
            </p>
            <Timer
              startedAt={currentQuestion.startedAt}
              timeLimitSec={currentQuestion.timeLimitSec}
            />
          </div>
          <h2 className="text-xl font-semibold">{currentQuestion.text}</h2>
          {currentQuestion.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={currentQuestion.imageUrl}
              alt="Иллюстрация к вопросу"
              className="max-h-64 rounded"
            />
          )}
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {currentQuestion.options.map((o) => (
              <li key={o.id} className="rounded border border-black/15 px-4 py-3">
                {o.text}
              </li>
            ))}
          </ul>
          <p className="text-sm text-black/60">
            Отвечают участники: {participants.length}
          </p>
          <button
            onClick={handleNext}
            className="self-start rounded bg-black px-4 py-2 text-white"
          >
            Показать результаты
          </button>
        </div>
      )}

      {phase === "results" && currentQuestion && currentResults && (
        <div className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold">{currentQuestion.text}</h2>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {currentQuestion.options.map((o) => {
              const isCorrect = currentResults.correctOptionIds.includes(o.id);
              return (
                <li
                  key={o.id}
                  className={`flex items-center justify-between rounded border px-4 py-3 ${
                    isCorrect
                      ? "border-green-600 bg-green-50"
                      : "border-black/15"
                  }`}
                >
                  <span>{o.text}</span>
                  <span className="text-sm text-black/60">
                    {currentResults.optionCounts[o.id] ?? 0}
                  </span>
                </li>
              );
            })}
          </ul>
          <h3 className="mt-2 font-medium">Лидерборд</h3>
          <Leaderboard entries={currentResults.leaderboard} />
          <button
            onClick={isLastQuestion ? handleEnd : handleNext}
            className="self-start rounded bg-black px-4 py-2 text-white"
          >
            {isLastQuestion ? "Завершить квиз" : "Следующий вопрос"}
          </button>
        </div>
      )}

      {phase === "ended" && (
        <div className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold">Квиз завершён</h2>
          {finalLeaderboard && <Leaderboard entries={finalLeaderboard} />}
          <Link href="/dashboard" className="self-start text-sm underline">
            Вернуться в личный кабинет
          </Link>
        </div>
      )}
    </div>
  );
}
