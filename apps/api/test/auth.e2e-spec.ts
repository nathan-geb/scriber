import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Auth (e2e)', () => {
    let app: INestApplication;
    const testUser = {
        email: `test-${Date.now()}@example.com`,
        password: 'TestPassword123!',
    };
    let accessToken: string;
    let refreshToken: string;

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        app = moduleFixture.createNestApplication();
        app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
        await app.init();
    });

    afterAll(async () => {
        await app.close();
    });

    describe('POST /auth/register', () => {
        it('should register a new user', async () => {
            const response = await request(app.getHttpServer())
                .post('/auth/register')
                .send(testUser)
                .expect(201);

            expect(response.body).toHaveProperty('access_token');
            expect(response.body).toHaveProperty('refresh_token');
            expect(response.body).toHaveProperty('user');
            expect(response.body.user.email).toBe(testUser.email);

            accessToken = response.body.access_token;
            refreshToken = response.body.refresh_token;
        });

        it('should reject duplicate registration', async () => {
            await request(app.getHttpServer())
                .post('/auth/register')
                .send(testUser)
                .expect(401); // UnauthorizedException for existing user
        });
    });

    describe('POST /auth/login', () => {
        it('should login with valid credentials', async () => {
            const response = await request(app.getHttpServer())
                .post('/auth/login')
                .send(testUser)
                .expect(201);

            expect(response.body).toHaveProperty('access_token');
            expect(response.body).toHaveProperty('refresh_token');
            accessToken = response.body.access_token;
            refreshToken = response.body.refresh_token;
        });

        it('should reject invalid credentials', async () => {
            await request(app.getHttpServer())
                .post('/auth/login')
                .send({ email: testUser.email, password: 'wrongpassword' })
                .expect(401);
        });
    });

    describe('POST /auth/refresh', () => {
        it('should refresh access token with valid refresh token', async () => {
            const response = await request(app.getHttpServer())
                .post('/auth/refresh')
                .send({ refresh_token: refreshToken })
                .expect(201);

            expect(response.body).toHaveProperty('access_token');
            expect(response.body).toHaveProperty('refresh_token');
        });

        it('should reject invalid refresh token', async () => {
            await request(app.getHttpServer())
                .post('/auth/refresh')
                .send({ refresh_token: 'invalid-token' })
                .expect(401);
        });
    });

    describe('GET /users/profile', () => {
        it('should return user profile with valid token', async () => {
            const response = await request(app.getHttpServer())
                .get('/users/profile')
                .set('Authorization', `Bearer ${accessToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('email', testUser.email);
        });

        it('should reject request without token', async () => {
            await request(app.getHttpServer())
                .get('/users/profile')
                .expect(401);
        });
    });
});
