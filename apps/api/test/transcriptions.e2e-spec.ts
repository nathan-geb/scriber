import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Transcriptions (e2e)', () => {
    let app: INestApplication;
    let prisma: PrismaService;
    let accessToken: string;
    let userId: string;
    let meetingId: string;

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        app = moduleFixture.createNestApplication();
        app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
        prisma = app.get(PrismaService);
        await app.init();

        // Register and get token
        const testUser = {
            email: `transcription-test-${Date.now()}@example.com`,
            password: 'TestPassword123!',
        };

        const authResponse = await request(app.getHttpServer())
            .post('/auth/register')
            .send(testUser);

        accessToken = authResponse.body.access_token;
        userId = authResponse.body.user.id;

        // Create a test meeting directly in DB for transcription tests
        const meeting = await prisma.meeting.create({
            data: {
                title: 'Test Meeting for Transcription',
                userId,
                status: 'COMPLETED',
                fileUrl: '/test/path.mp3',
                duration: 60,
            },
        });
        meetingId = meeting.id;
    });

    afterAll(async () => {
        // Cleanup test data
        await prisma.transcriptSegment.deleteMany({ where: { meetingId } });
        await prisma.meeting.delete({ where: { id: meetingId } }).catch(() => { });
        await app.close();
    });

    describe('GET /meetings/:id (with transcript)', () => {
        it('should return meeting details', async () => {
            const response = await request(app.getHttpServer())
                .get(`/meetings/${meetingId}`)
                .set('Authorization', `Bearer ${accessToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('id', meetingId);
            expect(response.body).toHaveProperty('title');
            expect(response.body).toHaveProperty('status');
        });

        it('should reject access without token', async () => {
            await request(app.getHttpServer())
                .get(`/meetings/${meetingId}`)
                .expect(401);
        });

        it('should return 404 for non-existent meeting', async () => {
            await request(app.getHttpServer())
                .get('/meetings/non-existent-id')
                .set('Authorization', `Bearer ${accessToken}`)
                .expect(404);
        });
    });

    describe('GET /meetings/:id/status', () => {
        it('should return meeting status', async () => {
            const response = await request(app.getHttpServer())
                .get(`/meetings/${meetingId}/status`)
                .set('Authorization', `Bearer ${accessToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('status');
        });
    });

    describe('DELETE /meetings/:id', () => {
        it('should delete meeting', async () => {
            // Create a new meeting to delete
            const meeting = await prisma.meeting.create({
                data: {
                    title: 'Meeting to Delete',
                    userId,
                    status: 'COMPLETED',
                    fileUrl: '/test/delete.mp3',
                    duration: 30,
                },
            });

            await request(app.getHttpServer())
                .delete(`/meetings/${meeting.id}`)
                .set('Authorization', `Bearer ${accessToken}`)
                .expect(204);

            // Verify deletion
            const deleted = await prisma.meeting.findUnique({ where: { id: meeting.id } });
            expect(deleted).toBeNull();
        });
    });
});
