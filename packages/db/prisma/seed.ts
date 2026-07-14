import bcrypt from "bcryptjs";
import { prisma } from "../src/index";

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);

  const demoUser = await prisma.user.upsert({
    where: { email: "demo@example.com" },
    update: {},
    create: {
      email: "demo@example.com",
      passwordHash,
      name: "Demo Organizer",
    },
  });

  const existingQuiz = await prisma.quiz.findFirst({
    where: { ownerId: demoUser.id, title: "Общие знания" },
  });

  if (!existingQuiz) {
    await prisma.quiz.create({
      data: {
        title: "Общие знания",
        description: "Демонстрационный квиз для проверки MVP",
        category: "Общее",
        ownerId: demoUser.id,
        defaultQuestionTimeSec: 20,
        questions: {
          create: [
            {
              order: 0,
              text: "Столица Франции?",
              contentType: "TEXT",
              answerType: "SINGLE",
              points: 1000,
              options: {
                create: [
                  { text: "Париж", isCorrect: true, order: 0 },
                  { text: "Лондон", isCorrect: false, order: 1 },
                  { text: "Берлин", isCorrect: false, order: 2 },
                  { text: "Мадрид", isCorrect: false, order: 3 },
                ],
              },
            },
            {
              order: 1,
              text: "Какие из этих чисел простые?",
              contentType: "TEXT",
              answerType: "MULTIPLE",
              points: 1000,
              options: {
                create: [
                  { text: "2", isCorrect: true, order: 0 },
                  { text: "4", isCorrect: false, order: 1 },
                  { text: "7", isCorrect: true, order: 2 },
                  { text: "9", isCorrect: false, order: 3 },
                ],
              },
            },
          ],
        },
      },
    });
  }

  console.log("Seed complete. Demo login: demo@example.com / password123");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
