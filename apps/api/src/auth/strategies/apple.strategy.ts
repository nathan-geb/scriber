import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-apple';
import { AuthService } from '../auth.service';
import { VerifyCallback } from 'passport-google-oauth20'; // Re-use type or use any

@Injectable()
export class AppleStrategy extends PassportStrategy(Strategy, 'apple') {
  constructor(private authService: AuthService) {
    super({
      clientID: process.env.APPLE_CLIENT_ID || 'mock_client_id',
      teamID: process.env.APPLE_TEAM_ID || 'mock_team_id',
      keyID: process.env.APPLE_KEY_ID || 'mock_key_id',
      privateKeyString:
        process.env.APPLE_PRIVATE_KEY?.replace(/\\n/g, '\n') || '', // Handle newlines in env var
      callbackURL: process.env.API_URL
        ? `${process.env.API_URL}/auth/apple/callback`
        : 'http://localhost:3000/api/v1/auth/apple/callback',
      scope: ['name', 'email'],
      passReqToCallback: false,
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    idToken: string,
    profile: Profile,
    done: (err: any, user?: any, info?: any) => void,
  ): Promise<any> {
    // Apple only returns name on the FIRST login. We must handle that.
    // The 'profile' object from passport-apple might need specific handling compared to Google.

    // In many passport-apple implementations, name is passed in the req.body if handle req is true,
    // but passport-apple strategy usually parses idToken.

    // Let's assume basic email/sub validation first.
    const email =
      profile.emails && profile.emails.length > 0
        ? profile.emails[0].value
        : undefined;

    // Fallback if email is hidden/private (Apple Relay), usually it's in the token.
    if (!email) {
      // If we can't get email, we might fail or look up by Apple Sub ID only.
      // For now, let's assume we get it or fail.
      // In real prod, you use the 'sub' from idToken as the stable ID.
    }

    const name = profile.name
      ? `${profile.name.firstName} ${profile.name.lastName}`
      : undefined;

    try {
      const user = await this.authService.validateAppleUser({
        email: email || '', // If empty, service should handle or throw
        appleId: profile.id,
        name: name,
      });
      done(null, user);
    } catch (error) {
      done(error, false);
    }
  }
}
