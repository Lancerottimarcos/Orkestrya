import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client.js";

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@orquestra.local";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "orquestra123";
  const adminName = process.env.ADMIN_NAME ?? "Administrador";

  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    await prisma.user.create({
      data: {
        name: adminName,
        email: adminEmail,
        passwordHash,
        role: "ADMIN",
      },
    });
    console.log(`Usuário admin criado: ${adminEmail} / ${adminPassword}`);
  } else {
    console.log("Usuário admin já existe, pulando.");
  }

  let board = await prisma.kanbanBoard.findFirst({ orderBy: { position: "asc" } });
  if (!board) {
    board = await prisma.kanbanBoard.create({ data: { name: "Quadro Principal", position: 0 } });
    console.log("Quadro padrão do Kanban criado.");
  }

  const columnCount = await prisma.kanbanColumn.count({ where: { boardId: board.id } });
  if (columnCount === 0) {
    await prisma.kanbanColumn.createMany({
      data: [
        { name: "Ideias", position: 0, boardId: board.id },
        { name: "Em Produção", position: 1, boardId: board.id },
        { name: "Aprovação", position: 2, boardId: board.id },
        { name: "Agendado", position: 3, boardId: board.id },
        { name: "Concluído", position: 4, boardId: board.id },
      ],
    });
    console.log("Colunas padrão do Kanban criadas.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
