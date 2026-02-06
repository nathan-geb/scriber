import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards } from '@nestjs/common';
import { WsJwtGuard } from '../auth/ws-jwt.guard';
import { JwtService } from '@nestjs/jwt';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private connectedClients: Map<string, string> = new Map(); // socketId -> userId

  constructor(private readonly jwtService: JwtService) { }

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth.token?.split(' ')[1] ||
        client.handshake.headers.authorization?.split(' ')[1];

      if (!token) {
        console.log(`Disconnecting unauthenticated client ${client.id}`);
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token);
      const userId = payload.sub;

      if (!userId) {
        client.disconnect();
        return;
      }

      this.connectedClients.set(client.id, userId);
      client.join(`user:${userId}`);
      console.log(`Client ${client.id} connected for user ${userId}`);
    } catch (e) {
      console.log(`Authentication failed for client ${client.id}:`, e.message);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = this.connectedClients.get(client.id);
    if (userId) {
      this.connectedClients.delete(client.id);
      console.log(`Client ${client.id} disconnected for user ${userId}`);
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('room:join')
  handleJoinRoom(client: Socket, meetingId: string) {
    client.join(`meeting:${meetingId}`);
    return { event: 'room:joined', data: meetingId };
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('room:leave')
  handleLeaveRoom(client: Socket, meetingId: string) {
    client.leave(`meeting:${meetingId}`);
    return { event: 'room:left', data: meetingId };
  }

  // --- Pipeline progress emitters ---

  emitPipelineStep(
    userId: string,
    meetingId: string,
    data: {
      step:
      | 'upload'
      | 'transcription'
      | 'enhancement'
      | 'redaction'
      | 'minutes';
      status:
      | 'queued'
      | 'processing'
      | 'uploading'
      | 'generating'
      | 'completed'
      | 'failed';
      progress?: number;
      error?: string;
    },
  ) {
    console.log(
      `Emitting job:step to user ${userId} and meeting ${meetingId}: ${data.step} -> ${data.status}`,
    );
    this.server.to(`user:${userId}`).emit('job:step', { ...data, meetingId });
  }

  emitMeetingCreated(userId: string, meeting: any) {
    console.log(`Emitting meeting:created to user ${userId}: ${meeting.id}`);
    this.server.to(`user:${userId}`).emit('meeting:created', meeting);
  }

  emitMeetingUpdated(meetingId: string, meeting: any) {
    this.server.to(`meeting:${meetingId}`).emit('meeting:updated', meeting);
  }

  emitPipelineComplete(
    userId: string,
    meetingId: string,
    data: {
      status: 'completed' | 'failed';
      error?: string;
    },
  ) {
    console.log(
      `Emitting job:complete to user ${userId} and meeting ${meetingId}: ${data.status}`,
    );
    this.server.to(`user:${userId}`).emit('job:complete', { ...data, meetingId });
  }
}
