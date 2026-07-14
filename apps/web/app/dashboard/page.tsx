import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const STATUS_LABELS: Record<string, string> = {
  LOBBY: "ожидание",
  ACTIVE: "идёт сейчас",
  FINISHED: "завершён",
};

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [quizzes, hostedSessions, participations] = await Promise.all([
    prisma.quiz.findMany({
      where: { ownerId: user.sub },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { questions: true, sessions: true } } },
    }),
    prisma.quizSession.findMany({
      where: { hostId: user.sub },
      orderBy: { createdAt: "desc" },
      include: {
        quiz: { select: { title: true } },
        _count: { select: { participants: true } },
      },
    }),
    prisma.sessionParticipant.findMany({
      where: { userId: user.sub },
      orderBy: { joinedAt: "desc" },
      include: { session: { include: { quiz: { select: { title: true } } } } },
    }),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-4 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Личный кабинет</h1>
        <Link href="/quizzes/new" className="rounded bg-black px-4 py-2 text-sm text-white">
          + Новый квиз
        </Link>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Мои квизы</h2>
        {quizzes.length === 0 && (
          <p className="text-black/60">Вы ещё не создали ни одного квиза.</p>
        )}
        <ul className="flex flex-col gap-2">
          {quizzes.map((quiz) => (
            <li
              key={quiz.id}
              className="flex items-center justify-between rounded border border-black/15 px-4 py-3"
            >
              <div>
                <p className="font-medium">{quiz.title}</p>
                <p className="text-sm text-black/60">
                  {quiz._count.questions} вопрос(ов) · {quiz._count.sessions} сессий проведено
                </p>
              </div>
              <Link href={`/quizzes/${quiz.id}/edit`} className="text-sm underline">
                Открыть
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Проведённые сессии</h2>
        {hostedSessions.length === 0 && (
          <p className="text-black/60">Вы ещё не запускали квизы.</p>
        )}
        <ul className="flex flex-col gap-2">
          {hostedSessions.map((session) => (
            <li
              key={session.id}
              className="flex items-center justify-between rounded border border-black/15 px-4 py-3"
            >
              <div>
                <p className="font-medium">{session.quiz.title}</p>
                <p className="text-sm text-black/60">
                  Код {session.roomCode} · {STATUS_LABELS[session.status]} ·{" "}
                  {session._count.participants} участников ·{" "}
                  {new Date(session.createdAt).toLocaleString("ru-RU")}
                </p>
              </div>
              <Link href={`/host/${session.id}`} className="text-sm underline">
                {session.status === "FINISHED" ? "Результаты" : "Открыть"}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">История участия</h2>
        {participations.length === 0 && (
          <p className="text-black/60">Вы ещё не участвовали в квизах.</p>
        )}
        <ul className="flex flex-col gap-2">
          {participations.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between rounded border border-black/15 px-4 py-3"
            >
              <div>
                <p className="font-medium">{p.session.quiz.title}</p>
                <p className="text-sm text-black/60">
                  Код {p.session.roomCode} · {new Date(p.joinedAt).toLocaleString("ru-RU")}
                </p>
              </div>
              <span className="font-semibold">{p.score} баллов</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
