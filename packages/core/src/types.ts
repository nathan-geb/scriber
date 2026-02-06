// ===========================
// User Types
// ===========================

export type Role = 'USER' | 'ADMIN';

export interface User {
    id: string;
    email: string;
    name?: string;
    role: Role;
    createdAt: string;
    updatedAt: string;
    notificationSettings?: {
        email: boolean;
        push: boolean;
    };
    telegramId?: string;
}

export interface UserWithSubscription extends User {
    subscription?: Subscription;
}

// ===========================
// Subscription Types
// ===========================

export interface Plan {
    id: string;
    name: string;
    maxMinutesPerUpload: number;
    maxUploadsPerWeek: number;
    monthlyMinutesLimit: number;
    price: number;
    currency: string;
}

export interface Subscription {
    id: string;
    userId: string;
    planId: string;
    active: boolean;
    startsAt: string;
    endsAt?: string;
    plan?: Plan;
}

export interface WeeklyUsage {
    uploadCount: number;
    minutesProcessed: number;
    weekStartDate: string;
}

export interface UsageStats {
    currentWeek: WeeklyUsage;
    plan: Plan;
    remainingUploads: number;
    remainingMinutes: number;
}

// ===========================
// Meeting Types
// ===========================

export type MeetingStatus =
    | 'UPLOADING'
    | 'UPLOADED'
    | 'PROCESSING_TRANSCRIPT'
    | 'TRANSCRIPT_READY'
    | 'PROCESSING_MINUTES'
    | 'COMPLETED'
    | 'FAILED'
    | 'CANCELLED';

export interface Meeting {
    id: string;
    userId: string;
    title: string;
    originalFileName: string;
    durationSeconds: number;
    fileUrl?: string;
    status: MeetingStatus;
    languageCode?: string;
    transcriptLang?: string;
    minutesLang?: string;
    createdAt: string;
    updatedAt: string;
}

export interface MeetingWithDetails extends Meeting {
    transcript?: TranscriptSegment[];
    minutes?: Minutes;
    speakers?: Speaker[];
}

// ===========================
// Transcription Types
// ===========================

export interface Speaker {
    id: string;
    meetingId: string;
    name: string;
    isUnknown: boolean;
}

export interface TranscriptSegment {
    id: string;
    meetingId: string;
    speakerId?: string;
    speaker?: Speaker;
    startTime: number;
    endTime: number;
    text: string;
}

// ===========================
// Minutes Types
// ===========================

export interface Minutes {
    id: string;
    meetingId: string;
    content: string;
    createdAt: string;
    updatedAt: string;
}

export type MinutesTemplate = 'EXECUTIVE' | 'DETAILED' | 'ACTION_ITEMS';

// ===========================
// Notification Types
// ===========================

export type NotificationType =
    | 'TRANSCRIPT_READY'
    | 'MINUTES_READY'
    | 'PROCESSING_FAILED'
    | 'SUBSCRIPTION_EXPIRING';

export interface NotificationPreference {
    id: string;
    userId: string;
    email: boolean;
    push: boolean;
    deviceToken?: string;
}

export interface Notification {
    id: string;
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    read: boolean;
    data?: Record<string, unknown>;
    createdAt: string;
}

// ===========================
// API Response Types
// ===========================

export interface ApiResponse<T> {
    data: T;
    message?: string;
}

export interface ApiError {
    statusCode: number;
    message: string;
    error?: string;
}

export interface PaginatedResponse<T> {
    items: T[];
    nextCursor?: string;
    hasMore: boolean;
}

export interface AuthResponse {
    access_token: string;
    refresh_token?: string;
    user: User;
}

// ===========================
// Query Types
// ===========================

export interface MeetingQueryParams {
    search?: string;
    status?: MeetingStatus;
    from?: string;
    to?: string;
    cursor?: string;
    limit?: number;
}
