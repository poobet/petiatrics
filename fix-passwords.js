const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

async function fix() {
  const users = [
    { email: 'admin@petiatrics.io', pw: 'Admin@1234' },
    { email: 'assistant@happypaws.io', pw: 'Password@1' },
    { email: 'vet@happypaws.io', pw: 'Password@1' },
    { email: 'staff@happypaws.io', pw: 'Password@1' },
    { email: 'cashier@happypaws.io', pw: 'Password@1' },
    { email: 'owner@happypaws.io', pw: 'Password@1' },
  ];
  for (const u of users) {
    const hash = await bcrypt.hash(u.pw, 10);
    const result = await prisma.user.updateMany({ where: { email: u.email }, data: { passwordHash: hash } });
    if (result.count === 0) {
      console.log('Skipped (not found):', u.email);
      continue;
    }
    console.log('Updated:', u.email);
  }
  await prisma.$disconnect();
  console.log('Done!');
}
fix().catch(console.error);
