import { IsString, IsNumber, IsOptional, Min, Max } from 'class-validator';

/**
 * DTO for initiating a chunked upload session
 */
export class InitiateChunkedUploadDto {
    @IsString()
    filename: string;

    @IsNumber()
    @Min(1)
    totalSize: number;

    @IsNumber()
    @Min(1)
    @Max(1000) // Max 1000 chunks
    totalChunks: number;

    @IsString()
    mimeType: string;

    @IsOptional()
    @IsString()
    language?: string;

    @IsOptional()
    @IsNumber()
    @Min(1)
    duration?: number; // Client-provided duration in seconds (fallback for WebM)
}

/**
 * DTO for completing a chunked upload
 */
export class CompleteChunkedUploadDto {
    @IsOptional()
    @IsString()
    language?: string;

    @IsOptional()
    @IsNumber()
    @Min(1)
    duration?: number; // Client-provided duration in seconds (fallback for WebM)
}
