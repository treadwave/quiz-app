import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { signAuthToken } from "@quiz/shared";
import { prisma } from "@/lib/prisma";
import { setAuthCookie } from "@/lib/auth";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!email || !password) {
    return NextResponse.json(
      { error: "Укажите email и пароль" },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json(
      { error: "Неверный email или пароль" },
      { status: 401 }
    );
  }

  const passwordValid = await bcrypt.compare(password, user.passwordHash);
  if (!passwordValid) {
    return NextResponse.json(
      { error: "Неверный email или пароль" },
      { status: 401 }
    );
  }

  const token = signAuthToken({ sub: user.id, email: user.email, name: user.name });
  const response = NextResponse.json({
    user: { id: user.id, email: user.email, name: user.name },
  });
  setAuthCookie(response, token);
  return response;
}
