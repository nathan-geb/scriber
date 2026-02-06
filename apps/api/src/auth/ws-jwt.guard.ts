import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class WsJwtGuard implements CanActivate {
    constructor(
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
    ) { }

    canActivate(context: ExecutionContext): boolean {
        const client = context.switchToWs().getClient();

        try {
            const token = client.handshake.auth.token?.split(' ')[1] ||
                client.handshake.headers.authorization?.split(' ')[1];

            if (!token) {
                return false;
            }

            const payload = this.jwtService.verify(token, {
                secret: this.configService.get<string>('JWT_SECRET'),
            });

            client['user'] = payload;
            return true;
        } catch (error) {
            return false;
        }
    }
}