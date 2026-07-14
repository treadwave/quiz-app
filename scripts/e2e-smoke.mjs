import { io } from "socket.io-client";

const WEB = "http://localhost:3000";
const RT = "http://localhost:4000";
const rand = Math.random().toString(36).slice(2, 8);

function log(...args) {
  console.log(...args);
}

function extractCookie(res) {
  const raw = res.headers.get("set-cookie");
  if (!raw) return null;
  return raw.split(";")[0];
}

async function api(path, { method = "GET", cookie, body } = {}) {
  const res = await fetch(WEB + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data, cookie: extractCookie(res) };
}

function connectSocket(cookie) {
  return io(RT, {
    transports: ["websocket"],
    extraHeaders: { Cookie: cookie },
    forceNew: true,
  });
}

function waitForEvent(socket, event, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), timeoutMs);
    socket.once(event, (payload) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

let failures = 0;
function assert(cond, message) {
  if (!cond) {
    failures++;
    log("❌ ASSERT FAILED:", message);
  } else {
    log("✅", message);
  }
}

async function main() {
  log("== Register organizer (A) and participant (B) ==");
  const aEmail = `organizer-${rand}@example.com`;
  const bEmail = `participant-${rand}@example.com`;

  const aReg = await api("/api/auth/register", {
    method: "POST",
    body: { name: "Organizer A", email: aEmail, password: "password123" },
  });
  assert(aReg.status === 200 && aReg.cookie, `A registered (status ${aReg.status})`);
  const aCookie = aReg.cookie;

  const bReg = await api("/api/auth/register", {
    method: "POST",
    body: { name: "Participant B", email: bEmail, password: "password123" },
  });
  assert(bReg.status === 200 && bReg.cookie, `B registered (status ${bReg.status})`);
  const bCookie = bReg.cookie;

  log("\n== Duplicate registration should fail with 409 ==");
  const dupReg = await api("/api/auth/register", {
    method: "POST",
    body: { name: "Organizer A2", email: aEmail, password: "password123" },
  });
  assert(dupReg.status === 409, `duplicate email rejected (status ${dupReg.status}): ${JSON.stringify(dupReg.data)}`);

  log("\n== Create quiz with 2 questions (short timers for fast test) ==");
  const quizRes = await api("/api/quizzes", {
    method: "POST",
    cookie: aCookie,
    body: {
      title: "E2E Test Quiz",
      description: "Sanity check",
      category: "Test",
      defaultQuestionTimeSec: 5,
    },
  });
  assert(quizRes.status === 201, `quiz created (status ${quizRes.status})`);
  const quizId = quizRes.data.quiz.id;

  const q1Res = await api(`/api/quizzes/${quizId}/questions`, {
    method: "POST",
    cookie: aCookie,
    body: {
      text: "Столица Франции?",
      contentType: "TEXT",
      answerType: "SINGLE",
      points: 1000,
      timeLimitSec: 3,
      options: [
        { text: "Париж", isCorrect: true },
        { text: "Лондон", isCorrect: false },
        { text: "Берлин", isCorrect: false },
      ],
    },
  });
  assert(q1Res.status === 201, `question 1 (SINGLE) created (status ${q1Res.status})`);
  const q1 = q1Res.data.question;
  const q1CorrectId = q1.options.find((o) => o.isCorrect).id;
  const q1WrongId = q1.options.find((o) => !o.isCorrect).id;

  const q2Res = await api(`/api/quizzes/${quizId}/questions`, {
    method: "POST",
    cookie: aCookie,
    body: {
      text: "Какие из этих чисел простые?",
      contentType: "TEXT",
      answerType: "MULTIPLE",
      points: 500,
      timeLimitSec: 3,
      options: [
        { text: "2", isCorrect: true },
        { text: "4", isCorrect: false },
        { text: "7", isCorrect: true },
        { text: "9", isCorrect: false },
      ],
    },
  });
  assert(q2Res.status === 201, `question 2 (MULTIPLE) created (status ${q2Res.status})`);
  const q2 = q2Res.data.question;
  const q2CorrectIds = q2.options.filter((o) => o.isCorrect).map((o) => o.id);

  log("\n== Uploads: reject non-image file ==");
  const formData = new FormData();
  formData.append("file", new Blob(["not an image"], { type: "text/plain" }), "notes.txt");
  const uploadRes = await fetch(`${WEB}/api/uploads`, {
    method: "POST",
    headers: { Cookie: aCookie },
    body: formData,
  });
  const uploadData = await uploadRes.json();
  assert(uploadRes.status === 400, `non-image upload rejected (status ${uploadRes.status}): ${JSON.stringify(uploadData)}`);

  log("\n== Start session (creates room code) ==");
  const sessionRes = await api("/api/sessions", { method: "POST", cookie: aCookie, body: { quizId } });
  assert(sessionRes.status === 201, `session created (status ${sessionRes.status})`);
  const sessionId = sessionRes.data.session.id;
  const roomCode = sessionRes.data.session.roomCode;
  log("roomCode =", roomCode);

  log("\n== Lookup by unknown room code should 404 ==");
  const badLookup = await api("/api/sessions/by-code/ZZZZZZ", { cookie: bCookie });
  assert(badLookup.status === 404, `unknown room code -> 404 (status ${badLookup.status})`);

  log("\n== B looks up real room code ==");
  const lookup = await api(`/api/sessions/by-code/${roomCode}`, { cookie: bCookie });
  assert(lookup.status === 200 && lookup.data.quizTitle === "E2E Test Quiz", `B resolved room code -> ${JSON.stringify(lookup.data)}`);

  log("\n== Connect host + participant sockets ==");
  const hostSocket = connectSocket(aCookie);
  const partSocket = connectSocket(bCookie);

  await new Promise((resolve, reject) => {
    hostSocket.on("connect", resolve);
    hostSocket.on("connect_error", reject);
  });
  await new Promise((resolve, reject) => {
    partSocket.on("connect", resolve);
    partSocket.on("connect_error", reject);
  });
  log("✅ both sockets connected");

  const hostLobbyPromise = waitForEvent(hostSocket, "lobby:update");
  hostSocket.emit("host:join", { sessionId });
  const hostLobby1 = await hostLobbyPromise;
  assert(hostLobby1.roomCode === roomCode, "host received lobby:update after joining");

  const hostLobbyAfterPartJoin = waitForEvent(hostSocket, "lobby:update");
  const partLobbyPromise = waitForEvent(partSocket, "lobby:update");
  partSocket.emit("participant:join", { roomCode });
  const [hostLobby2, partLobby1] = await Promise.all([hostLobbyAfterPartJoin, partLobbyPromise]);
  assert(hostLobby2.participants.length === 1 && hostLobby2.participants[0].name === "Participant B", `host sees B in lobby: ${JSON.stringify(hostLobby2.participants)}`);
  assert(partLobby1.participants.length === 1, "participant sees itself in lobby");

  log("\n== Non-host cannot start the quiz ==");
  partSocket.emit("host:start");
  await new Promise((r) => setTimeout(r, 500));

  log("\n== Host starts quiz -> question 1 broadcast ==");
  const hostQ1Promise = waitForEvent(hostSocket, "question:show");
  const partQ1Promise = waitForEvent(partSocket, "question:show");
  hostSocket.emit("host:start");
  const [hostQ1, partQ1] = await Promise.all([hostQ1Promise, partQ1Promise]);
  assert(hostQ1.questionId === q1.id && partQ1.questionId === q1.id, `both received question 1: ${hostQ1.text}`);
  assert(hostQ1.options.every((o) => o.isCorrect === undefined), "question:show payload hides correct answers");

  log("\n== B answers correctly, then tries to answer again (should be ignored) ==");
  partSocket.emit("participant:answer", { questionId: q1.id, selectedOptionIds: [q1CorrectId] });
  await new Promise((r) => setTimeout(r, 200));
  partSocket.emit("participant:answer", { questionId: q1.id, selectedOptionIds: [q1WrongId] });

  log("\n== Wait for timer to expire -> question:results ==");
  const hostRes1Promise = waitForEvent(hostSocket, "question:results", 6000);
  const partRes1Promise = waitForEvent(partSocket, "question:results", 6000);
  const [hostRes1, partRes1] = await Promise.all([hostRes1Promise, partRes1Promise]);
  assert(hostRes1.correctOptionIds.includes(q1CorrectId), "results reveal correct option");
  const bEntry1 = hostRes1.leaderboard.find((e) => e.name === "Participant B");
  assert(bEntry1 && bEntry1.score === 1000, `B scored fixed 1000 points, not double-counted (second answer ignored): score=${bEntry1?.score}`);
  assert(hostRes1.optionCounts[q1CorrectId] === 1, `optionCounts reflects exactly 1 vote for correct option (double answer rejected): ${JSON.stringify(hostRes1.optionCounts)}`);

  log("\n== Host advances to question 2 ==");
  const hostQ2Promise = waitForEvent(hostSocket, "question:show");
  const partQ2Promise = waitForEvent(partSocket, "question:show");
  hostSocket.emit("host:next");
  const [hostQ2, partQ2] = await Promise.all([hostQ2Promise, partQ2Promise]);
  assert(hostQ2.questionId === q2.id, `question 2 shown: ${hostQ2.text}`);

  log("\n== B answers question 2 correctly (multi-select) ==");
  partSocket.emit("participant:answer", { questionId: q2.id, selectedOptionIds: q2CorrectIds });

  const hostRes2Promise = waitForEvent(hostSocket, "question:results", 6000);
  const partRes2Promise = waitForEvent(partSocket, "question:results", 6000);
  const [hostRes2] = await Promise.all([hostRes2Promise, partRes2Promise]);
  const bEntry2 = hostRes2.leaderboard.find((e) => e.name === "Participant B");
  assert(bEntry2 && bEntry2.score === 1500, `B total score after Q2 = 1500 (1000+500): score=${bEntry2?.score}`);

  log("\n== Host ends quiz -> quiz:ended broadcast ==");
  const hostEndPromise = waitForEvent(hostSocket, "quiz:ended");
  const partEndPromise = waitForEvent(partSocket, "quiz:ended");
  hostSocket.emit("host:end");
  const [hostEnd, partEnd] = await Promise.all([hostEndPromise, partEndPromise]);
  assert(hostEnd.leaderboard[0].score === 1500, `final leaderboard top score 1500: ${JSON.stringify(hostEnd.leaderboard)}`);
  assert(partEnd.leaderboard[0].score === 1500, "participant also receives final leaderboard");

  log("\n== REST: session now FINISHED, dashboard queries reflect history ==");
  const sessionCheck = await api(`/api/sessions/${sessionId}`, { cookie: aCookie });
  assert(sessionCheck.data.session.status === "FINISHED", `session persisted as FINISHED: ${sessionCheck.data.session.status}`);
  assert(sessionCheck.data.session.participants[0].score === 1500, "persisted participant score matches");

  const hostHistory = await api("/api/sessions?as=host", { cookie: aCookie });
  assert(hostHistory.data.sessions.some((s) => s.id === sessionId), "organizer dashboard shows hosted session");

  const partHistory = await api("/api/sessions?as=participant", { cookie: bCookie });
  assert(partHistory.data.participations.some((p) => p.session.id === sessionId && p.score === 1500), "participant dashboard shows participation with correct score");

  log("\n== Joining a FINISHED room by socket should error ==");
  const lateSocket = connectSocket(bCookie);
  await new Promise((resolve, reject) => {
    lateSocket.on("connect", resolve);
    lateSocket.on("connect_error", reject);
  });
  const errorPromise = waitForEvent(lateSocket, "error", 3000);
  lateSocket.emit("participant:join", { roomCode });
  const errPayload = await errorPromise.catch((e) => ({ message: `no error received: ${e.message}` }));
  assert(errPayload.message && errPayload.message.length > 0, `late join to finished session errors: ${errPayload.message}`);

  hostSocket.disconnect();
  partSocket.disconnect();
  lateSocket.disconnect();

  log("\n=====================================");
  if (failures === 0) {
    log("ALL CHECKS PASSED");
  } else {
    log(`${failures} CHECK(S) FAILED`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exitCode = 1;
});
