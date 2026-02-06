const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const prisma = new PrismaClient();

async function main() {
    // 1. Get the admin user
    const user = await prisma.user.findFirst({
        where: { email: 'admin@scriber.com' }
    });

    if (!user) {
        console.error('No admin user found. Run prisma db seed first.');
        return;
    }

    const uploadsDir = path.join(__dirname, '..', 'uploads');
    if (!fs.existsSync(uploadsDir)) {
        console.error('Uploads directory not found:', uploadsDir);
        return;
    }

    const files = fs.readdirSync(uploadsDir);
    console.log(`Found ${files.length} items in uploads directory.`);

    for (const file of files) {
        // Skip directories and common system files
        if (file === 'chunks' || file === '.DS_Store' || fs.statSync(path.join(uploadsDir, file)).isDirectory()) {
            continue;
        }

        const fileName = file;

        // Try to parse timestamp from filename: file-1768927440685-850277899.mp3
        let title = fileName;
        const timestampMatch = fileName.match(/file-(\d+)-/);
        if (timestampMatch) {
            const ts = parseInt(timestampMatch[1], 10);
            const date = new Date(ts);
            const dateStr = date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            });
            const timeStr = date.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit'
            });
            title = `Meeting - ${dateStr}, ${timeStr}`;
        }

        // Check if meeting already exists for this fileUrl
        const existing = await prisma.meeting.findFirst({
            where: { fileUrl: fileName }
        });

        if (existing) {
            console.log(`Updating existing meeting title/status for: ${fileName}`);
            await prisma.meeting.update({
                where: { id: existing.id },
                data: { title, status: 'FAILED' }
            });
            continue;
        }

        console.log(`Importing: ${title} (${fileName})`);

        // Create a meeting record as FAILED to trigger Retry button
        await prisma.meeting.create({
            data: {
                userId: user.id,
                title: title,
                originalFileName: fileName,
                fileUrl: fileName,
                status: 'FAILED',
                durationSeconds: 0,
                languageCode: 'en',
            }
        });
    }

    console.log('Update/Import completed.');
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
