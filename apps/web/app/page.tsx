import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";

export default async function HomePage() {
  const user = await getCurrentUser();

  return (
    <div className="mx-auto flex max-w-2xl flex-1 flex-col items-center justify-center gap-6 px-4 text-center">
      <h1 className="text-3xl font-semibold">Live-квизы в реальном времени</h1>
      <p className="text-black/60">
        Создавайте квизы, запускайте живые сессии по коду комнаты и следите за
        лидербордом в реальном времени.
      </p>
      <div className="flex gap-4">
        <Link href="/play" className="rounded bg-black px-4 py-2 text-white">
          Присоединиться к квизу
        </Link>
        <Link
          href={user ? "/dashboard" : "/register"}
          className="rounded border border-black/20 px-4 py-2"
        >
          {user ? "Личный кабинет" : "Создать квиз"}
        </Link>
      </div>
    </div>
  );
}
