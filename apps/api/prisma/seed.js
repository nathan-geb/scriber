const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const free = await prisma.plan.upsert({
        where: { name: 'Free' },
        update: {},
        create: {
            name: 'Free',
            maxMinutesPerUpload: 5,
            maxUploadsPerWeek: 1,
            price: 0,
            currency: 'USD'
        },
    });

    const pro = await prisma.plan.upsert({
        where: { name: 'Pro' },
        update: {},
        create: {
            name: 'Pro',
            maxMinutesPerUpload: 60,
            maxUploadsPerWeek: 100,
            price: 9.99,
            currency: 'USD'
        },
    });

    console.log({ free, pro });

    const bcrypt = require('bcrypt');
    const passwordHash = await bcrypt.hash('password123', 10);

    const admin = await prisma.user.upsert({
        where: { email: 'admin@scriber.com' },
        update: {
            role: 'ADMIN',
            password: passwordHash
        },
        create: {
            email: 'admin@scriber.com',
            password: passwordHash,
            role: 'ADMIN',
            subscription: {
                create: {
                    planId: pro.id
                }
            },
            notificationSettings: {
                create: {
                    email: true,
                    push: true
                }
            }
        }
    });

    console.log('Admin user seeded:', admin.email);
}

main()
    .then(async () => {
        await prisma.$disconnect();
    })
    .catch(async (e) => {
        console.error(e);
        await prisma.$disconnect();
        process.exit(1);
    });
