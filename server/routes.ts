import express, { type Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { twitterUrlSchema, type TwitterUrlInput, insertTranscriptSchema } from "@shared/schema";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import { getTwitterVideoInfo, downloadVideo } from "./services/twitterApi";
import { extractAudioFromVideo, transcribeAudio, formatTimestamp } from "./services/speechToText";

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
  return httpServer;
}

// Function to process a Twitter video URL and return a transcript
async function processTwitterVideo(input: TwitterUrlInput) {
  try {
    // Step 1: Get Twitter video information including the video URL
    const videoInfo = await getTwitterVideoInfo(input.url);
    
    // Step 2: Download the video
    const videoBuffer = await downloadVideo(videoInfo.videoUrl);
    
    // Step 3: Extract audio from the video
    const audioPath = await extractAudioFromVideo(videoBuffer);
    
    // Step 4: Transcribe the audio
    const transcriptionResult = await transcribeAudio(audioPath, input.language);
    
    // Step 5: Format the segments with the requested timestamp format
    const segments = transcriptionResult.segments.map(segment => {
      // Parse the timestamp as seconds
      const timestampMatch = segment.timestamp.match(/(\d+):(\d+)/);
      let seconds = 0;
      
      if (timestampMatch) {
        const minutes = parseInt(timestampMatch[1]);
        const secs = parseInt(timestampMatch[2]);
        seconds = minutes * 60 + secs;
      } else {
        seconds = parseInt(segment.timestamp);
      }
      
      return {
        timestamp: formatTimestamp(seconds, input.timestampFormat),
        text: segment.text
      };
    });
    
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
    
    // If there's an error with the Twitter API, fall back to mock data
    if (process.env.NODE_ENV === 'development') {
      console.warn('Falling back to mock transcript data for development');
      return createMockTranscript(input);
    }
    
    throw new Error(`Failed to process Twitter video: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Helper function to create mock transcript data for development/testing
function createMockTranscript(input: TwitterUrlInput) {
  // Extract Twitter username and video ID from URL
  const urlMatch = input.url.match(/(?:twitter|x)\.com\/(\w+)\/status\/(\d+)/i);
  
  if (!urlMatch) {
    throw new Error("Invalid Twitter URL format");
  }
  
  const [_, username, videoId] = urlMatch;
  
  // Create sample segments based on timestamp format
  const segments = createMockSegments(input.timestampFormat);
  
  // Calculate duration based on the last segment's timestamp
  const lastSegment = segments[segments.length - 1];
  const duration = lastSegment.timestamp.split(':').length > 1 
    ? lastSegment.timestamp 
    : `${Math.floor(parseInt(lastSegment.timestamp) / 60)}:${parseInt(lastSegment.timestamp) % 60}`;
  
  // Create transcript data
  return {
    twitterUrl: input.url,
    videoTitle: `Twitter video ${videoId}`,
    username: username,
    duration: duration,
    language: input.language === "auto" ? "English" : input.language,
    timestampFormat: input.timestampFormat,
    segments: segments
  };
}

// Helper function to generate mock transcript segments
function createMockSegments(timestampFormat: string) {
  const sampleTexts = [
    "Hi everyone! Today I want to talk about a really interesting topic that's been on my mind lately.",
    "The way technology is changing how we communicate has been fascinating to observe, especially on platforms like Twitter.",
    "What's even more interesting is how video content has become such a crucial part of online communication.",
    "Being able to automatically transcribe these videos makes content more accessible and searchable for everyone.",
    "That's why I'm excited about tools that help bridge this gap and make video content more usable in different contexts."
  ];
  
  return sampleTexts.map((text, index) => {
    let timestamp;
    const seconds = index * 15;
    
    if (timestampFormat === "none") {
      timestamp = "";
    } else if (timestampFormat === "seconds") {
      timestamp = `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;
    } else if (timestampFormat === "detailed") {
      timestamp = `00:${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}.00`;
    } else {
      timestamp = seconds.toString();
    }
    
    return { timestamp, text };
  });
}
