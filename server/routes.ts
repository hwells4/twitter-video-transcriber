import express, { type Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { twitterUrlSchema, type TwitterUrlInput, insertTranscriptSchema } from "@shared/schema";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import { getTwitterVideoInfo, downloadVideo } from "./services/twitterApi";
import { extractAudioFromVideo, transcribeAudio, formatTimestamp } from "./services/speechToText";
import { WebSocketServer, WebSocket } from "ws";

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup API routes
  const apiRouter = express.Router();
  
  // Route to transcribe a Twitter video
  apiRouter.post("/transcribe", async (req: Request, res: Response) => {
    try {
      // Validate request body using the Zod schema
      const input = twitterUrlSchema.parse(req.body);
      
      // Process the Twitter video and transcribe it
      const result = await processTwitterVideo(input);
      
      // Create a transcript in storage
      const transcript = await storage.createTranscript(result);
      
      // Return the transcript
      res.status(200).json(transcript);
    } catch (err) {
      if (err instanceof ZodError) {
        const validationError = fromZodError(err);
        res.status(400).json({ message: validationError.message });
      } else if (err instanceof Error) {
        res.status(500).json({ message: err.message });
      } else {
        res.status(500).json({ message: "An unknown error occurred" });
      }
    }
  });
  
  // Route to get recent transcripts
  apiRouter.get("/transcripts/recent", async (req: Request, res: Response) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 5;
      const transcripts = await storage.getRecentTranscripts(limit);
      res.status(200).json(transcripts);
    } catch (err) {
      if (err instanceof Error) {
        res.status(500).json({ message: err.message });
      } else {
        res.status(500).json({ message: "An unknown error occurred" });
      }
    }
  });
  
  // Route to get a transcript by ID
  apiRouter.get("/transcripts/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const transcript = await storage.getTranscript(id);
      
      if (!transcript) {
        return res.status(404).json({ message: "Transcript not found" });
      }
      
      res.status(200).json(transcript);
    } catch (err) {
      if (err instanceof Error) {
        res.status(500).json({ message: err.message });
      } else {
        res.status(500).json({ message: "An unknown error occurred" });
      }
    }
  });
  
  // Route to delete a transcript
  apiRouter.delete("/transcripts/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteTranscript(id);
      
      if (!success) {
        return res.status(404).json({ message: "Transcript not found" });
      }
      
      res.status(200).json({ message: "Transcript deleted successfully" });
    } catch (err) {
      if (err instanceof Error) {
        res.status(500).json({ message: err.message });
      } else {
        res.status(500).json({ message: "An unknown error occurred" });
      }
    }
  });
  
  // Register the API router with the prefix
  app.use("/api", apiRouter);

  const httpServer = createServer(app);
  
  // Create a WebSocket server on the same HTTP server but with a distinct path
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  // Store client connections
  const clients = new Map<string, WebSocket>();

  wss.on('connection', (ws, req) => {
    // Generate a unique ID for this connection
    const id = Math.random().toString(36).substring(2, 15);
    
    // Store the client connection
    clients.set(id, ws);
    
    console.log(`WebSocket client connected: ${id}`);
    
    // Send initial connection message
    ws.send(JSON.stringify({ 
      type: 'connection',
      message: 'Connected to transcription service',
      clientId: id
    }));
    
    // Handle client disconnection
    ws.on('close', () => {
      clients.delete(id);
      console.log(`WebSocket client disconnected: ${id}`);
    });
    
    // Handle client messages
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        console.log(`Received message from client ${id}:`, data);
      } catch (error) {
        console.error('Error parsing client message:', error);
      }
    });
  });
  
  // Add the WebSocket server and clients to the global scope for use in other modules
  (global as any).wss = wss;
  (global as any).wsClients = clients;
  
  return httpServer;
}

// Helper function to broadcast progress updates to all connected WebSocket clients
function broadcastProgress(step: number, stepProgress: number, message: string) {
  if (!(global as any).wsClients) return;
  
  // Special case for error notifications (step 0)
  if (step === 0) {
    // Send an error message to all clients
    const errorUpdate = {
      type: 'error',
      message,
      overallProgress: stepProgress // Usually 100 to close the progress meter
    };
    
    // Broadcast the error to all connected clients
    const clients = (global as any).wsClients as Map<string, WebSocket>;
    clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(errorUpdate));
      }
    });
    
    return;
  }
  
  // Regular progress updates
  // Define step status based on progress
  let status: 'pending' | 'active' | 'completed' = 'pending';
  if (stepProgress === 100) {
    status = 'completed';
  } else if (stepProgress > 0) {
    status = 'active';
  }
  
  // Calculate overall progress (each step contributes 25% to overall progress)
  const overallProgress = Math.min(
    Math.round((step - 1) * 25 + (stepProgress * 25) / 100),
    100
  );
  
  // Create progress update message
  const progressUpdate: ProgressUpdate = {
    type: 'progress',
    step,
    progress: stepProgress,
    status,
    message,
    overallProgress
  };
  
  // Broadcast to all connected clients
  const clients = (global as any).wsClients as Map<string, WebSocket>;
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(progressUpdate));
    }
  });
}

// Function to process a Twitter video URL and return a transcript
async function processTwitterVideo(input: TwitterUrlInput) {
  try {
    // Step 1: Get Twitter video information including the video URL
    broadcastProgress(1, 10, "Connecting to Twitter API...");
    const videoInfo = await getTwitterVideoInfo(input.url);
    broadcastProgress(1, 100, "Successfully fetched video details from Twitter");
    
    // Step 2: Download the video
    broadcastProgress(2, 10, "Starting video download...");
    const videoBuffer = await downloadVideo(videoInfo.videoUrl);
    broadcastProgress(2, 100, "Video downloaded successfully");
    
    // Step 3: Extract audio from the video
    broadcastProgress(3, 10, "Extracting audio from video...");
    const audioPath = await extractAudioFromVideo(videoBuffer);
    broadcastProgress(3, 100, "Audio extracted successfully");
    
    // Step 4: Transcribe the audio with the requested timestamp format
    broadcastProgress(4, 10, "Beginning transcription process...");
    const transcriptionResult = await transcribeAudio(audioPath, input.language, input.timestampFormat);
    broadcastProgress(4, 50, "Transcription in progress...");
    
    // No need to reformat the segments as transcribeAudio now uses the requested format
    const segments = transcriptionResult.segments;
    
    broadcastProgress(4, 100, "Transcription completed successfully");
    
    // Calculate duration based on the last segment's timestamp
    let duration = "0:00";
    if (segments.length > 0) {
      const lastSegment = segments[segments.length - 1];
      duration = lastSegment.timestamp || "0:00";
    }
    
    // Create transcript data
    return {
      twitterUrl: input.url,
      videoTitle: `Tweet by ${videoInfo.authorName}`,
      username: videoInfo.username,
      duration: duration,
      language: transcriptionResult.language,
      timestampFormat: input.timestampFormat,
      segments: segments
    };
  } catch (error) {
    console.error('Error processing Twitter video:', error);
    
    // Send an appropriate error message based on the error type
    if (error instanceof Error) {
      if (error.message.includes('rate limit') || error.message.includes('429')) {
        // Clear any in-progress WebSocket messages
        broadcastProgress(0, 100, "Twitter API rate limit exceeded. Please try again later.");
        throw new Error("Twitter API rate limit exceeded. Please try again in a few minutes.");
      } else if (error.message.includes('No video found')) {
        broadcastProgress(0, 100, "No video found in the tweet. Please try a different tweet URL.");
        throw new Error("No video found in the tweet. Please try a different tweet URL.");
      } else if (error.message.includes('Tweet not found')) {
        broadcastProgress(0, 100, "Tweet not found. The tweet may be private or deleted.");
        throw new Error("Tweet not found. The tweet may be private or deleted.");
      } else if (error.message.includes('No valid Twitter API credentials')) {
        broadcastProgress(0, 100, "Twitter API credentials are missing or invalid.");
        throw new Error("Twitter API credentials are missing or invalid. Please check your environment variables.");
      }
    }
    
    // Generic error message
    broadcastProgress(0, 100, "Failed to process Twitter video. Please try again later.");
    throw new Error(`Failed to process Twitter video: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Mock data and synthetic generation functionality has been removed
// to ensure we only use authentic data from Twitter and real transcription
