
import { PrismaClient } from '../src/generated/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    const email = 'admin@scriber.com';
    const password = 'password123';
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.upsert({
        where: { email },
        update: { role: 'ADMIN', password: hashedPassword },
        create: {
            email,
            password: hashedPassword,
            role: 'ADMIN',
            subscription: {
                create: {
                    plan: {
                        connect: { name: 'Pro' }
                    },
                    startsAt: new Date(),
                    endsAt: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
                    active: true
                }
            }
        },
    });
    console.log(`User ${user.email} is ready with role ${user.role}`);
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
