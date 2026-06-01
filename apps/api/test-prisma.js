const {PrismaClient} = require('@prisma/client');
console.log('DATABASE_URL:', process.env.DATABASE_URL);
const p = new PrismaClient();
p.user.findFirst().then(r => {
  console.log('SUCCESS:', r ? r.email : 'null');
  p.$disconnect();
}).catch(e => {
  console.log('ERROR:', e.message.slice(0, 200));
  p.$disconnect();
});
