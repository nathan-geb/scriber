import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  Request,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  Res,
} from '@nestjs/common';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { AuthService } from './auth.service';
import { AuthGuard } from '@nestjs/passport';

class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(1)
  password: string;
}

class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;
}

class RefreshTokenDto {
  @IsString()
  refresh_token: string;
}

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) { }

  // Strict rate limiting for login: 5 attempts per minute
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async login(@Body() dto: LoginDto) {
    const user = await this.authService.validateUser(dto.email, dto.password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.authService.login(user);
  }

  // Strict rate limiting for register: 3 per minute
  @Post('register')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto.email, dto.password);
  }

  // More lenient for refresh - 30 per minute
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshToken(dto.refresh_token);
  }

  // Skip throttling for profile endpoint (already JWT protected)
  @UseGuards(AuthGuard('jwt'))
  @Get('profile')
  @SkipThrottle()
  getProfile(@Request() req: { user: { userId: string; email: string } }) {
    return req.user;
  }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth(@Request() req: any) {
    // Guard initiates redirect
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthRedirect(@Request() req: any, @Res() res: any) {
    const data = await this.authService.login(req.user);
    // Redirect to frontend with token
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    // Use proper encoding for the user object if needed, but here we just pass tokens
    // We pass the user object as a base64 string to avoid URL length issues or character issues, 
    // but typically just tokens are enough and FE fetches profile. 
    // However, existing AuthContext expects user object on login.
    // Let's pass tokens and let FE fetch profile or pass minimal user info.
    // Actually, AuthContext expects `user` object. Let's base64 encode it.
    const userJson = JSON.stringify(data.user);
    const userBase64 = Buffer.from(userJson).toString('base64');

    res.redirect(`${frontendUrl}/auth/callback?token=${data.access_token}&refresh_token=${data.refresh_token}&user=${userBase64}`);
  }
}
