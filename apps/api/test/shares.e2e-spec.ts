import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Shares & Exports (e2e)', () => {
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
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    prisma = app.get(PrismaService);
    await app.init();

    // Register and get token
    const testUser = {
      email: `share-test-${Date.now()}@example.com`,
      password: 'TestPassword123!',
    };

    const authResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send(testUser);

    accessToken = authResponse.body.access_token;
    userId = authResponse.body.user.id;

    // Create a test meeting with minutes
    const meeting = await prisma.meeting.create({
      data: {
        title: 'Test Meeting for Shares',
        userId,
        status: 'COMPLETED',
        fileUrl: '/test/path.mp3',
        duration: 60,
        minutes: {
          create: {
            content: '# Meeting Minutes\n\n- Item 1\n- Item 2',
            language: 'en',
          },
        },
      },
    });
    meetingId = meeting.id;
  });

  afterAll(async () => {
    // Cleanup test data
    await prisma.shareLink.deleteMany({ where: { meetingId } });
    await prisma.minutes.deleteMany({ where: { meetingId } });
    await prisma.meeting.delete({ where: { id: meetingId } }).catch(() => {});
    await app.close();
  });

  describe('POST /shares', () => {
    it('should create a share link', async () => {
      const response = await request(app.getHttpServer())
        .post('/shares')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          meetingId,
          shareType: 'FULL',
          expiresInHours: 24,
        })
        .expect(201);

      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('shareUrl');
      expect(response.body).toHaveProperty('shareType', 'FULL');
    });

    it('should reject share creation without auth', async () => {
      await request(app.getHttpServer())
        .post('/shares')
        .send({
          meetingId,
          shareType: 'MINUTES',
        })
        .expect(401);
    });
  });

  describe('GET /shares/meeting/:meetingId', () => {
    it('should list share links for meeting', async () => {
      const response = await request(app.getHttpServer())
        .get(`/shares/meeting/${meetingId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });
  });

  describe('GET /shares/content/:token', () => {
    it('should access shared content via token', async () => {
      // Get existing share link
      const sharesResponse = await request(app.getHttpServer())
        .get(`/shares/meeting/${meetingId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      const token = sharesResponse.body[0]?.token;
      if (token) {
        const response = await request(app.getHttpServer())
          .get(`/shares/content/${token}`)
          .expect(200);

        expect(response.body).toHaveProperty('title');
      }
    });

    it('should reject invalid share token', async () => {
      await request(app.getHttpServer())
        .get('/shares/content/invalid-token')
        .expect(404);
    });
  });

  describe('GET /exports/markdown/:id', () => {
    it('should export meeting as markdown', async () => {
      const response = await request(app.getHttpServer())
        .get(`/exports/markdown/${meetingId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.headers['content-type']).toMatch(/text\/markdown/);
    });

    it('should reject export without auth', async () => {
      await request(app.getHttpServer())
        .get(`/exports/markdown/${meetingId}`)
        .expect(401);
    });
  });

  describe('DELETE /shares/:id', () => {
    it('should revoke share link', async () => {
      // Create a new share link to delete
      const createResponse = await request(app.getHttpServer())
        .post('/shares')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          meetingId,
          shareType: 'TRANSCRIPT',
        })
        .expect(201);

      const shareId = createResponse.body.id;

      await request(app.getHttpServer())
        .delete(`/shares/${shareId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
    });
  });
});
