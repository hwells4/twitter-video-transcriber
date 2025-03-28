declare module 'fluent-ffmpeg' {
  interface FfmpegCommand {
    setFfmpegPath(path: string): FfmpegCommand;
    input(input: string | Buffer): FfmpegCommand;
    outputFormat(format: string): FfmpegCommand;
    on(event: string, callback: (err?: any, ...args: any[]) => void): FfmpegCommand;
    pipe(stream: NodeJS.WritableStream): FfmpegCommand;
    audioBitrate(bitrate: string | number): FfmpegCommand;
    audioCodec(codec: string): FfmpegCommand;
    audioChannels(channels: number): FfmpegCommand;
    audioFrequency(freq: number): FfmpegCommand;
    withNoVideo(): FfmpegCommand;
    toFormat(format: string): FfmpegCommand;
    output(output: string | NodeJS.WritableStream): FfmpegCommand;
    run(): void;
  }
  
  function ffmpeg(input?: string | Buffer): FfmpegCommand;
  export = ffmpeg;
}

declare module 'ffmpeg-static';
declare module 'node-wav';

declare module '@xenova/transformers' {
  export function pipeline(task: string, model: string): Promise<any>;
}

// Define types for the transcription output
interface TranscriptionChunk {
  timestamp: [number, number];
  text: string;
}

interface AutomaticSpeechRecognitionOutput {
  text: string;
  chunks: TranscriptionChunk[];
  language?: string;
}

// WebSocket types for progress updates
declare namespace NodeJS {
  interface Global {
    wss: import('ws').WebSocketServer;
    wsClients: Map<string, import('ws').WebSocket>;
  }
}

interface ProgressUpdate {
  type: 'progress';
  step: number;
  progress: number;
  status: 'pending' | 'active' | 'completed';
  message: string;
  overallProgress: number;
}