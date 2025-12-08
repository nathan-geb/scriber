import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { join } from 'path';
import { writeFileSync, unlinkSync, existsSync } from 'fs';

describe('Uploads (e2e)', () => {
    let app: INestApplication;
    let accessToken: string;
    const testAudioPath = join(__dirname, 'test-audio.mp3');

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        app = moduleFixture.createNestApplication();
        app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
        await app.init();

        // Register and get token
        const testUser = {
            email: `upload-test-${Date.now()}@example.com`,
            password: 'TestPassword123!',
        };

        const authResponse = await request(app.getHttpServer())
            .post('/auth/register')
            .send(testUser);

        accessToken = authResponse.body.access_token;

        // Create a minimal test audio file (just needs to exist for upload test)
        // In real tests, use a proper audio fixture
        writeFileSync(testAudioPath, Buffer.alloc(1024, 0));
    });

    afterAll(async () => {
        // Cleanup test file
        if (existsSync(testAudioPath)) {
            unlinkSync(testAudioPath);
        }
        await app.close();
    });

    describe('POST /uploads', () => {
        it('should reject upload without authentication', async () => {
            await request(app.getHttpServer())
                .post('/uploads')
                .attach('file', testAudioPath)
                .expect(401);
        });

        it('should reject upload without file', async () => {
            await request(app.getHttpServer())
                .post('/uploads')
                .set('Authorization', `Bearer ${accessToken}`)
                .expect(400);
        });

        it('should accept file upload with authentication', async () => {
            const response = await request(app.getHttpServer())
                .post('/uploads')
                .set('Authorization', `Bearer ${accessToken}`)
                .attach('file', testAudioPath)
                .field('language', 'en')
                .expect(201);

            expect(response.body).toHaveProperty('id');
            expect(response.body).toHaveProperty('title');
            expect(response.body).toHaveProperty('status');
        });
    });
});
