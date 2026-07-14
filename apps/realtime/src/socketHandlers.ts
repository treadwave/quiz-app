import type { Socket } from "socket.io";
import { SOCKET_EVENTS } from "@quiz/shared";
import { authenticateSocket } from "./auth";
import {
  addParticipant,
  buildLobbyPayload,
  endQuiz,
  finishCurrentQuestion,
  getGameByRoomCode,
  hasPendingTimer,
  loadOrGetGameForHost,
  removeSocket,
  roomName,
  showQuestion,
  startQuiz,
  submitAnswer,
  type GameState,
  type TypedServer,
} from "./gameManager";
import type { ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData } from "./types";

type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

function emitError(socket: TypedSocket, message: string) {
  socket.emit(SOCKET_EVENTS.ERROR, { message });
}

export function registerSocketHandlers(io: TypedServer) {
  io.use((socket, next) => {
    const user = authenticateSocket(socket);
    if (!user) {
      next(new Error("unauthorized"));
      return;
    }
    socket.data.user = user;
    next();
  });

  io.on("connection", (socket) => {
    function getCurrentGame(): GameState | undefined {
      const roomCode = socket.data.roomCode;
      return roomCode ? getGameByRoomCode(roomCode) : undefined;
    }

    socket.on(SOCKET_EVENTS.HOST_JOIN, async (payload) => {
      try {
        const game = await loadOrGetGameForHost(payload.sessionId, socket.data.user.sub);
        game.hostSocketId = socket.id;
        socket.data.roomCode = game.roomCode;
        socket.join(roomName(game.roomCode));
        io.to(roomName(game.roomCode)).emit(SOCKET_EVENTS.LOBBY_UPDATE, buildLobbyPayload(game));
      } catch (err) {
        emitError(socket, err instanceof Error ? err.message : "Не удалось подключиться");
      }
    });

    socket.on(SOCKET_EVENTS.PARTICIPANT_JOIN, async (payload) => {
      try {
        const game = getGameByRoomCode(payload.roomCode);
        if (!game) throw new Error("Комната не найдена");
        if (game.status === "FINISHED") throw new Error("Сессия уже завершена");

        await addParticipant(game, socket.data.user, socket.id);
        socket.data.roomCode = game.roomCode;
        socket.join(roomName(game.roomCode));

        io.to(roomName(game.roomCode)).emit(SOCKET_EVENTS.LOBBY_UPDATE, buildLobbyPayload(game));

        if (game.status === "ACTIVE" && game.currentQuestionIndex >= 0) {
          const question = game.questions[game.currentQuestionIndex];
          socket.emit(SOCKET_EVENTS.QUESTION_SHOW, {
            index: game.currentQuestionIndex,
            totalQuestions: game.questions.length,
            questionId: question.id,
            text: question.text,
            contentType: question.contentType,
            imageUrl: question.imageUrl,
            answerType: question.answerType,
            options: question.options.map((o) => ({ id: o.id, text: o.text })),
            timeLimitSec: question.timeLimitSec,
            startedAt: new Date(game.questionStartedAt ?? Date.now()).toISOString(),
          });
        }
      } catch (err) {
        emitError(socket, err instanceof Error ? err.message : "Не удалось присоединиться");
      }
    });

    socket.on(SOCKET_EVENTS.HOST_START, async () => {
      const game = getCurrentGame();
      if (!game || socket.id !== game.hostSocketId) return;
      if (game.status !== "LOBBY") return;
      await startQuiz(io, game);
    });

    socket.on(SOCKET_EVENTS.HOST_NEXT, async () => {
      const game = getCurrentGame();
      if (!game || socket.id !== game.hostSocketId) return;
      if (game.status !== "ACTIVE") return;

      if (hasPendingTimer(game)) {
        await finishCurrentQuestion(io, game);
        return;
      }

      const nextIndex = game.currentQuestionIndex + 1;
      if (nextIndex >= game.questions.length) {
        emitError(socket, "Это был последний вопрос — завершите квиз");
        return;
      }
      showQuestion(io, game, nextIndex);
    });

    socket.on(SOCKET_EVENTS.HOST_END, async () => {
      const game = getCurrentGame();
      if (!game || socket.id !== game.hostSocketId) return;

      if (hasPendingTimer(game)) {
        await finishCurrentQuestion(io, game);
      }
      await endQuiz(io, game);
    });

    socket.on(SOCKET_EVENTS.PARTICIPANT_ANSWER, (payload) => {
      const game = getCurrentGame();
      if (!game) return;
      submitAnswer(game, socket.data.user.sub, payload.questionId, payload.selectedOptionIds);
    });

    socket.on("disconnect", () => {
      const game = getCurrentGame();
      if (!game) return;
      removeSocket(game, socket.id);
      io.to(roomName(game.roomCode)).emit(SOCKET_EVENTS.LOBBY_UPDATE, buildLobbyPayload(game));
    });
  });
}
