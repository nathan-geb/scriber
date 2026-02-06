import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, mkdirSync, unlinkSync, readdirSync } from 'fs';
import { join, basename, extname } from 'path';

const execAsync = promisify(exec);

/**
 * Audio utilities for handling long audio files
 */

/**
 * Get audio duration in seconds using ffprobe
 */
export async function getAudioDuration(filePath: string): Promise<number> {
  try {
    const { stdout } = await execAsync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`,
    );
    const duration = parseFloat(stdout.trim());
    if (!isNaN(duration) && duration > 0) {
      return duration;
    }
    throw new Error('Invalid duration');
  } catch (error) {
    console.warn('ffprobe failed to get duration:', error);
    return 0;
  }
}

/**
 * Split audio file into chunks of specified duration
 * @param filePath Path to the audio file
 * @param chunkDurationSeconds Duration of each chunk in seconds (default: 600 = 10 minutes)
 * @returns Array of chunk file paths
 */
export async function splitAudioIntoChunks(
  filePath: string,
  chunkDurationSeconds = 600,
): Promise<{ chunks: string[]; tempDir: string }> {
  const duration = await getAudioDuration(filePath);

  // If audio is short enough, no need to split
  if (duration <= chunkDurationSeconds * 1.2) {
    return { chunks: [filePath], tempDir: '' };
  }

  // Create temp directory for chunks
  const fileBase = basename(filePath, extname(filePath));
  const tempDir = join(
    process.cwd(),
    'uploads',
    'chunks',
    `${fileBase}_${Date.now()}`,
  );

  if (!existsSync(tempDir)) {
    mkdirSync(tempDir, { recursive: true });
  }

  const ext = extname(filePath);
  const chunks: string[] = [];
  const numChunks = Math.ceil(duration / chunkDurationSeconds);

  console.log(
    `Splitting ${Math.round(duration)}s audio into ${numChunks} chunks of ${chunkDurationSeconds}s each`,
  );

  // Use ffmpeg segment muxer for efficient splitting
  const outputPattern = join(tempDir, `chunk_%03d${ext}`);

  try {
    await execAsync(
      `ffmpeg -i "${filePath}" -f segment -segment_time ${chunkDurationSeconds} -c copy -reset_timestamps 1 "${outputPattern}" -y`,
    );

    // Read generated chunk files
    const files = readdirSync(tempDir)
      .filter((f) => f.startsWith('chunk_'))
      .sort()
      .map((f) => join(tempDir, f));

    chunks.push(...files);
    console.log(`Created ${chunks.length} audio chunks`);
  } catch (error) {
    console.error('ffmpeg split failed:', error);
    // Fallback: return original file
    return { chunks: [filePath], tempDir: '' };
  }

  return { chunks, tempDir };
}

/**
 * Clean up temporary chunk files
 */
export async function cleanupChunks(tempDir: string): Promise<void> {
  if (!tempDir || !existsSync(tempDir)) return;

  try {
    const files = readdirSync(tempDir);
    for (const file of files) {
      try {
        unlinkSync(join(tempDir, file));
      } catch (e) {
        console.warn('Failed to delete chunk file:', e);
      }
    }
    // Remove the directory
    try {
      unlinkSync(tempDir);
    } catch (e) {
      // Directory might not be empty or already deleted
    }
  } catch (error) {
    console.warn('Failed to cleanup chunks:', error);
  }
}

/**
 * Check if ffmpeg is available on the system
 */
export async function isFfmpegAvailable(): Promise<boolean> {
  try {
    await execAsync('which ffmpeg');
    return true;
  } catch {
    return false;
  }
}
