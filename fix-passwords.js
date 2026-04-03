const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

async function fix() {
  const users = [
    { email: 'admin@petiatrics.io', pw: 'Admin@1234' },
    { email: 'manager@happypaws.io', pw: 'Password@1' },
    { email: 'vet@happypaws.io', pw: 'Password@1' },
    { email: 'receptionist@happypaws.io', pw: 'Password@1' },
    { email: 'cashier@happypaws.io', pw: 'Password@1' },
    { email: 'owner@happypaws.io', pw: 'Password@1' },
  ];
  for (const u of users) {
    const hash = await bcrypt.hash(u.pw, 10);
    await prisma.user.update({ where: { email: u.email }, data: { passwordHash: hash } });
    console.log('Updated:', u.email);
  }
  await prisma.$disconnect();
  console.log('Done!');
}
fix().catch(console.error);
