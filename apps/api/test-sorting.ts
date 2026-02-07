
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Fetching meetings with current sorting logic...');
    const meetings = await prisma.meeting.findMany({
        orderBy: [
            { lastProcessedAt: { sort: 'desc', nulls: 'last' } },
            { createdAt: 'desc' },
        ],
        take: 5,
        select: {
            id: true,
            title: true,
            status: true,
            createdAt: true,
            lastProcessedAt: true,
        },
    });

    console.log('Top 5 meetings:');
    meetings.forEach((m: any, i: number) => {
        console.log(`${i + 1}. ${m.title} (${m.status})`);
        console.log(`   Created: ${m.createdAt}`);
        console.log(`   LastProcessed: ${m.lastProcessedAt}`);
    });
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
