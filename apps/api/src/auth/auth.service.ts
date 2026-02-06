import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

interface TokenPayload {
  email: string;
  sub: string;
  role: string;
  orgId?: string; // Add current org context
  type?: 'access' | 'refresh';
}

interface AuthTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

@Injectable()
export class AuthService {
  private readonly ACCESS_TOKEN_EXPIRY = '15m';
  private readonly REFRESH_TOKEN_EXPIRY = '7d';
  private readonly ACCESS_TOKEN_EXPIRY_SECONDS = 15 * 60; // 15 minutes

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.usersService.findOne(email);
    if (user && user.password && (await bcrypt.compare(pass, user.password))) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  /**
   * Generate both access and refresh tokens
   */
  private generateTokens(user: any): AuthTokens {
    // Determine the default organization (first one found)
    const defaultOrgId = user.memberships?.[0]?.organizationId;

    const payload: TokenPayload = {
      email: user.email,
      sub: user.id,
      role: user.role,
      orgId: defaultOrgId,
    };

    const access_token = this.jwtService.sign(
      { ...payload, type: 'access' },
      { expiresIn: this.ACCESS_TOKEN_EXPIRY },
    );

    const refresh_token = this.jwtService.sign(
      { ...payload, type: 'refresh' },
      { expiresIn: this.REFRESH_TOKEN_EXPIRY },
    );

    return {
      access_token,
      refresh_token,
      expires_in: this.ACCESS_TOKEN_EXPIRY_SECONDS,
    };
  }

  async login(user: any) {
    // If memberships aren't already included, fetch them
    let userWithOrgs = user;
    if (!user.memberships) {
      userWithOrgs = await this.usersService.findById(user.id);
    }

    const tokens = this.generateTokens(userWithOrgs);
    const { password, ...safeUser } = userWithOrgs;
    return {
      ...tokens,
      user: safeUser,
    };
  }

  /**
   * Refresh access token using a valid refresh token
   */
  async refreshToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify<TokenPayload>(refreshToken);

      // Verify it's a refresh token, not an access token
      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('Invalid token type');
      }

      // Get fresh user data
      const user = await this.usersService.findById(payload.sub);
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // Generate new tokens
      const tokens = this.generateTokens(user);
      const { password, ...userWithoutPassword } = user;

      return {
        ...tokens,
        user: userWithoutPassword,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  async register(email: string, pass: string) {
    const existing = await this.usersService.findOne(email);
    if (existing) {
      throw new UnauthorizedException('User already exists');
    }
    const hash = await bcrypt.hash(pass, 10);
    const user = await this.usersService.createWithPlan(email, hash);
    return this.login(user);
  }

  async validateGoogleUser(details: {
    email: string;
    name: string;
    picture?: string;
  }) {
    const user = await this.usersService.createOrUpdateGoogleUser(
      details.email,
      details.name,
    );
    return user;
  }

  async validateAppleUser(details: {
    email: string;
    appleId: string;
    name?: string;
  }) {
    // Treat Apple sign-in similarly to Google: find by email (if available) or create
    // Ideally we should store the 'appleId' (sub) in the DB as a linked account identity,
    // but for now we follow the existing Google pattern (email-based).
    // If email is hidden by Apple, we might have issues if we rely solely on email.
    // However, existing usersService seems email-centric.

    // Check if user exists by email
    const user = await this.usersService.createOrUpdateGoogleUser(
      details.email,
      details.name || 'Apple User',
    );
    return user;
  }
}
