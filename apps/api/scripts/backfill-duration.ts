
import { PrismaClient } from '@prisma/client';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

// Load .env manually
const envPath = path.join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
    console.log('Loading .env from', envPath);
    const envConfig = fs.readFileSync(envPath).toString();
    for (const line of envConfig.split('\n')) {
        const lineTrimmed = line.trim();
        if (!lineTrimmed || lineTrimmed.startsWith('#')) continue;

        const [key, ...valueParts] = lineTrimmed.split('=');
        if (key && valueParts.length > 0) {
            const value = valueParts.join('=').trim();
            // Remove quotes if present
            const cleanValue = value.replace(/^["'](.+)["']$/, '$1');
            process.env[key.trim()] = cleanValue;
        }
    }
}

// Fix DATABASE_URL for local execution if it points to docker container
if (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('@postgres:')) {
    console.log('Fixing DATABASE_URL host for local execution (postgres -> localhost)');
    process.env.DATABASE_URL = process.env.DATABASE_URL.replace('@postgres:', '@localhost:');
}
// Fallback if still unreachable or undefined (since .env might be missing locally on host)
if (!process.env.DATABASE_URL) {
    console.log('DATABASE_URL not found, using default local connection string');
    process.env.DATABASE_URL = 'postgresql://nathan:password@localhost:5432/echomint';
}
console.log('DATABASE_URL Host:', process.env.DATABASE_URL?.split('@')[1]?.split('/')[0]);

const prisma = new PrismaClient();
const execAsync = promisify(exec);

async function extractDuration(filePath: string): Promise<number | null> {
    try {
        // Try ffprobe first as it's reliable for most formats including WebM
        const { stdout } = await execAsync(
            `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`
        );
        const duration = parseFloat(stdout.trim());
        if (!isNaN(duration) && duration > 0) {
            return Math.ceil(duration);
        }
    } catch (e) {
        // Ignore error
    }
    return null;
}

async function main() {
    console.log('Starting duration backfill...');

    // Find meetings with 0 or missing duration
    const meetings = await prisma.meeting.findMany({
        where: {
            OR: [
                { durationSeconds: 0 },
                { durationSeconds: undefined }
            ],
            fileUrl: { not: null } // Only check where we have a file path
        }
    });

    console.log(`Found ${meetings.length} meetings to check.`);

    let fixedCount = 0;
    let errorCount = 0;
    let missingFileCount = 0;

    for (const meeting of meetings) {
        if (!meeting.fileUrl) continue;

        // Resolve absolute path if needed (though usually stored as absolute or relative to uploads)
        // Assuming fileUrl is the stored path. If it's relative, we might need to prepend cwd
        let filePath = meeting.fileUrl;
        if (!path.isAbsolute(filePath)) {
            filePath = path.join(process.cwd(), filePath);
        }

        if (!fs.existsSync(filePath)) {
            console.log(`[SKIP] File not found for meeting ${meeting.id}: ${filePath}`);
            missingFileCount++;
            continue;
        }

        const duration = await extractDuration(filePath);

        if (duration) {
            await prisma.meeting.update({
                where: { id: meeting.id },
                data: { durationSeconds: duration }
            });
            console.log(`[FIXED] Meeting ${meeting.id}: ${duration}s`);
            fixedCount++;
        } else {
            console.log(`[ERROR] Could not extract duration for meeting ${meeting.id}`);
            errorCount++;
        }
    }

    console.log('--- Backfill Complete ---');
    console.log(`Fixed: ${fixedCount}`);
    console.log(`Failed: ${errorCount}`);
    console.log(`Missing Files: ${missingFileCount}`);
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
