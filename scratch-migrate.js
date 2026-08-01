const { PrismaClient } = require('@prisma/client');
process.env.DATABASE_URL = "postgresql://petiatrics:dev_postgres_pw@localhost:5432/petiatrics?schema=public";
const prisma = new PrismaClient();

async function run() {
  try {
    console.log('Dropping conflicting index if exists...');
    await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS "stock_movements_clinicId_idempotencyKey_key";`);
    console.log('Index dropped successfully.');
  } catch (err) {
    console.error('Error dropping index:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

run();
