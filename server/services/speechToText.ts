import { pipeline } from '@xenova/transformers';
import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';
import { createWriteStream } from 'fs';

// Import ffmpeg and related modules
// @ts-ignore - Ignoring TS errors for modules that might not have type definitions
import ffmpeg from 'fluent-ffmpeg';
// @ts-ignore
import ffmpegStatic from 'ffmpeg-static';
// @ts-ignore
import wav from 'node-wav';

// Set ffmpeg path
if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic);
}

// Create a temporary directory if it doesn't exist
const tempDir = path.join(process.cwd(), 'tmp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

/**
 * Extracts audio from a video file and saves it as WAV
 * @param videoBuffer The video buffer
 * @returns The path to the saved WAV file
 */
export async function extractAudioFromVideo(videoBuffer: Buffer): Promise<string> {
  try {
    // Save the video to a temporary file
    const videoPath = path.join(tempDir, `video_${Date.now()}.mp4`);
    fs.writeFileSync(videoPath, videoBuffer);
    
    // Extract audio to a WAV file
    const audioPath = path.join(tempDir, `audio_${Date.now()}.wav`);
    
    // Create a promise wrapper for ffmpeg
    const extractAudio = new Promise<string>((resolve, reject) => {
      ffmpeg(videoPath)
        .outputOptions(['-vn']) // No video
        .audioCodec('pcm_s16le')
        .audioChannels(1)
        .audioFrequency(16000)
        .format('wav')
        .output(audioPath)
        .on('end', () => resolve(audioPath))
        .on('error', (err: any) => reject(new Error(`FFmpeg error: ${err.message}`)))
        .run();
    });
    
    await extractAudio;
    
    // Clean up the video file
    fs.unlinkSync(videoPath);
    
    return audioPath;
  } catch (error) {
    console.error('Error extracting audio:', error);
    throw new Error(`Failed to extract audio: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Transcribes audio to text
 * @param audioPath Path to the audio file
 * @param language Language to transcribe (ISO 639-1 code or 'auto')
 * @returns A transcript with segments
 */
export async function transcribeAudio(audioPath: string, language: string = 'auto'): Promise<{ segments: { timestamp: string, text: string }[], language: string }> {
  try {
    // Read WAV file
    const audioFile = fs.readFileSync(audioPath);
    const wavData = wav.decode(audioFile);
    
    // Create a transcriber model
    const transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-small');
    
    // Transcribe the audio
    const result = await transcriber(wavData.channelData[0], {
      chunk_length_s: 30,
      stride_length_s: 5,
      language: language === 'auto' ? null : language,
      return_timestamps: true,
    }) as AutomaticSpeechRecognitionOutput;
    
    // Clean up the audio file
    fs.unlinkSync(audioPath);
    
    // Format the transcript segments
    const segments = result.chunks.map((chunk: TranscriptionChunk) => {
      const startTime = formatTimestamp(chunk.timestamp[0]);
      return {
        timestamp: startTime,
        text: chunk.text.trim(),
      };
    });
    
    return {
      segments,
      language: result.language || 'en'
    };
  } catch (error) {
    console.error('Error transcribing audio:', error);
    throw new Error(`Failed to transcribe audio: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Formats a timestamp in seconds to a readable format
 * @param seconds The time in seconds
 * @param format The format to use ('none', 'seconds', or 'detailed')
 * @returns A formatted timestamp string
 */
export function formatTimestamp(seconds: number, format: string = 'seconds'): string {
  if (format === 'none') {
    return '';
  }
  
  const totalSeconds = Math.floor(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  
  if (format === 'seconds') {
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  } else if (format === 'detailed') {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    const milliseconds = Math.floor((seconds - totalSeconds) * 100);
    
    return `${hours.toString().padStart(2, '0')}:${remainingMinutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
  }
  
  return seconds.toString();
}