import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@WebSocketGateway({
  cors: {
    origin: [
      'http://localhost:3001',
      'http://localhost:8081',
      'http://localhost:19006',
      process.env.WEB_URL,
      process.env.MOBILE_URL,
    ].filter(Boolean),
    credentials: true,
  },
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private logger = new Logger('EventsGateway');
  private userSockets: Map<string, Set<string>> = new Map();

  constructor(private jwtService: JwtService) { }

  async handleConnection(client: Socket) {
    try {
      // Get token from handshake auth or query
      const token =
        client.handshake.auth?.token || client.handshake.query?.token;

      if (!token) {
        this.logger.warn(`Client ${client.id} connected without auth token`);
        // Allow connection but don't associate with user
        return;
      }

      // Verify JWT and extract userId
      const payload = this.jwtService.verify(token as string);
      const userId = payload.sub;

      // Store socket-to-user mapping
      client.data.userId = userId;

      // Add socket to user's set
      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId)!.add(client.id);

      // Join user-specific room
      client.join(`user:${userId}`);

      this.logger.log(`Client ${client.id} connected for user ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to authenticate socket ${client.id}:`, error);
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data.userId;
    if (userId) {
      // Remove from user's socket set
      const userSocketSet = this.userSockets.get(userId);
      if (userSocketSet) {
        userSocketSet.delete(client.id);
        if (userSocketSet.size === 0) {
          this.userSockets.delete(userId);
        }
      }

      this.logger.log(`Client ${client.id} disconnected for user ${userId}`);
    }
  }

  @SubscribeMessage('subscribe:meeting')
  handleSubscribeMeeting(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { meetingId: string },
  ) {
    client.join(`meeting:${data.meetingId}`);
    this.logger.log(
      `Client ${client.id} subscribed to meeting ${data.meetingId}`,
    );
    return { subscribed: true, meetingId: data.meetingId };
  }

  @SubscribeMessage('unsubscribe:meeting')
  handleUnsubscribeMeeting(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { meetingId: string },
  ) {
    client.leave(`meeting:${data.meetingId}`);
    return { unsubscribed: true, meetingId: data.meetingId };
  }

  /**
   * Emit event to a specific user (all their connected sockets)
   */
  emitToUser(userId: string, event: string, data: any) {
    this.server.to(`user:${userId}`).emit(event, data);
  }

  /**
   * Emit event to all subscribers of a meeting
   */
  emitToMeeting(meetingId: string, event: string, data: any) {
    this.server.to(`meeting:${meetingId}`).emit(event, data);
  }

  /**
   * Emit job progress update
   */
  emitJobProgress(userId: string, meetingId: string, data: any) {
    this.emitToUser(userId, 'job:progress', data);
    this.emitToMeeting(meetingId, 'job:progress', data);
  }

  /**
   * Emit pipeline step progress
   * Used to track progress through upload → transcription → minutes pipeline
   */
  emitPipelineStep(
    userId: string,
    meetingId: string,
    data: {
      step: 'upload' | 'transcription' | 'minutes';
      status: 'queued' | 'processing' | 'uploading' | 'generating' | 'completed' | 'failed';
      progress: number;
      error?: string;
    },
  ) {
    const payload = {
      meetingId,
      ...data,
      timestamp: new Date().toISOString(),
    };
    this.emitToUser(userId, 'job:step', payload);
    this.emitToMeeting(meetingId, 'job:step', payload);
  }

  /**
   * Emit pipeline completion event
   * Sent when entire pipeline finishes (all steps complete)
   */
  emitPipelineComplete(
    userId: string,
    meetingId: string,
    data: { success: boolean; error?: string },
  ) {
    const payload = {
      meetingId,
      ...data,
      timestamp: new Date().toISOString(),
    };
    this.emitToUser(userId, 'job:complete', payload);
    this.emitToMeeting(meetingId, 'job:complete', payload);
  }
}
