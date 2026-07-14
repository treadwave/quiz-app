"use client";

import { useEffect, useRef, useState } from "react";
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

type Phase = "connecting" | "lobby" | "question" | "answered" | "results" | "ended";

export default function PlayRoomPage() {
  const params = useParams<{ roomCode: string }>();
  const roomCode = params.roomCode.toUpperCase();
  const socketRef = useRef<AppSocket | null>(null);

  const [phase, setPhase] = useState<Phase>("connecting");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [participants, setParticipants] = useState<LobbyParticipant[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<QuestionShowPayload | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [currentResults, setCurrentResults] = useState<QuestionResultsPayload | null>(null);
  const [finalLeaderboard, setFinalLeaderboard] = useState<LeaderboardEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const meRes = await fetch("/api/auth/me");
      const meData = await meRes.json();
      if (!cancelled && meRes.ok) setCurrentUserId(meData.user.id);

      const socket = createSocket();
      socketRef.current = socket;

      socket.on("connect", () => {
        socket.emit(SOCKET_EVENTS.PARTICIPANT_JOIN, { roomCode });
      });

      socket.on(SOCKET_EVENTS.LOBBY_UPDATE, (payload) => {
        setParticipants(payload.participants);
        setPhase((prev) => (prev === "connecting" ? "lobby" : prev));
      });

      socket.on(SOCKET_EVENTS.QUESTION_SHOW, (payload) => {
        setCurrentQuestion(payload);
        setCurrentResults(null);
        setSelected([]);
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
  }, [roomCode]);

  function toggleOption(optionId: string) {
    if (!currentQuestion) return;
    setSelected((prev) => {
      if (currentQuestion.answerType === "SINGLE") {
        return [optionId];
      }
      return prev.includes(optionId)
        ? prev.filter((id) => id !== optionId)
        : [...prev, optionId];
    });
  }

  function submitAnswer() {
    if (!currentQuestion || selected.length === 0) return;
    socketRef.current?.emit(SOCKET_EVENTS.PARTICIPANT_ANSWER, {
      questionId: currentQuestion.questionId,
      selectedOptionIds: selected,
    });
    setPhase("answered");
  }

  if (error) {
    return <p className="p-8 text-red-600">{error}</p>;
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 px-4 py-12">
      <h1 className="text-xl font-semibold">Комната {roomCode}</h1>

      {phase === "connecting" && <p>Подключаемся...</p>}

      {phase === "lobby" && (
        <div className="flex flex-col gap-4">
          <p>Ждём начала квиза организатором...</p>
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
        </div>
      )}

      {(phase === "question" || phase === "answered") && currentQuestion && (
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
          <div className="flex flex-col gap-2">
            {currentQuestion.options.map((o) => (
              <button
                key={o.id}
                type="button"
                disabled={phase === "answered"}
                onClick={() => toggleOption(o.id)}
                className={`rounded border px-4 py-3 text-left disabled:opacity-60 ${
                  selected.includes(o.id)
                    ? "border-black bg-black text-white"
                    : "border-black/15"
                }`}
              >
                {o.text}
              </button>
            ))}
          </div>
          {phase === "question" ? (
            <button
              onClick={submitAnswer}
              disabled={selected.length === 0}
              className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
            >
              Ответить
            </button>
          ) : (
            <p className="text-black/60">Ответ отправлен, ждём результатов...</p>
          )}
        </div>
      )}

      {phase === "results" && currentQuestion && currentResults && (
        <div className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold">{currentQuestion.text}</h2>
          <div className="flex flex-col gap-2">
            {currentQuestion.options.map((o) => {
              const isCorrect = currentResults.correctOptionIds.includes(o.id);
              const wasSelected = selected.includes(o.id);
              return (
                <div
                  key={o.id}
                  className={`flex items-center justify-between rounded border px-4 py-3 ${
                    isCorrect
                      ? "border-green-600 bg-green-50"
                      : wasSelected
                        ? "border-red-400 bg-red-50"
                        : "border-black/15"
                  }`}
                >
                  <span>{o.text}</span>
                  <span className="text-sm text-black/60">
                    {currentResults.optionCounts[o.id] ?? 0}
                  </span>
                </div>
              );
            })}
          </div>
          <h3 className="mt-2 font-medium">Лидерборд</h3>
          <Leaderboard entries={currentResults.leaderboard} />
          {currentUserId && (
            <p className="text-sm text-black/60">
              Ваш счёт:{" "}
              {currentResults.leaderboard.find((e) => e.userId === currentUserId)?.score ?? 0}
            </p>
          )}
          <p className="text-black/60">Ждём следующий вопрос...</p>
        </div>
      )}

      {phase === "ended" && (
        <div className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold">Квиз завершён</h2>
          {finalLeaderboard && <Leaderboard entries={finalLeaderboard} />}
        </div>
      )}
    </div>
  );
}
