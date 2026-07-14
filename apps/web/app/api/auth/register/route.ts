import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { signAuthToken } from "@quiz/shared";
import { prisma } from "@/lib/prisma";
import { setAuthCookie } from "@/lib/auth";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";

  if (!email || !password || !name) {
    return NextResponse.json(
      { error: "Укажите имя, email и пароль" },
      { status: 400 }
    );
  }
  if (password.length < 6) {
    return NextResponse.json(
      { error: "Пароль должен быть не короче 6 символов" },
      { status: 400 }
    );
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "Пользователь с таким email уже существует" },
      { status: 409 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { email, name, passwordHash },
  });

  const token = signAuthToken({ sub: user.id, email: user.email, name: user.name });
  const response = NextResponse.json({
    user: { id: user.id, email: user.email, name: user.name },
  });
  setAuthCookie(response, token);
  return response;
}
