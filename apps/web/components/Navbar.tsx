"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

interface NavbarProps {
  user: { name: string; email: string } | null;
}

export default function Navbar({ user }: NavbarProps) {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="border-b border-black/10">
      <nav className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
        <Link href="/" className="font-semibold">
          QuizApp
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <Link href="/play">Присоединиться</Link>
          {user ? (
            <>
              <Link href="/dashboard">Личный кабинет</Link>
              <span className="text-black/60">{user.name}</span>
              <button onClick={handleLogout} className="underline">
                Выйти
              </button>
            </>
          ) : (
            <>
              <Link href="/login">Войти</Link>
              <Link href="/register">Регистрация</Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
