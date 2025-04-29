import { 
  users, 
  type User, 
  type InsertUser, 
  transcripts, 
  type Transcript, 
  type InsertTranscript,
  type TranscriptSegment 
} from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

// modify the interface with any CRUD methods
// you might need
export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Transcript methods
  createTranscript(transcript: InsertTranscript): Promise<Transcript>;
  getTranscript(id: number): Promise<Transcript | undefined>;
  getAllTranscripts(): Promise<Transcript[]>;
  getRecentTranscripts(limit: number): Promise<Transcript[]>;
  deleteTranscript(id: number): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async createTranscript(insertTranscript: InsertTranscript): Promise<Transcript> {
    // Add created date
    const transcriptData = {
      ...insertTranscript,
      createdAt: new Date()
    };
    
    try {
      const [transcript] = await db.insert(transcripts).values(transcriptData).returning();
      return transcript;
    } catch (error) {
      console.error('Error creating transcript in database:', error);
      throw new Error('Failed to save transcript to database');
    }
  }

  async getTranscript(id: number): Promise<Transcript | undefined> {
    try {
      const [transcript] = await db.select().from(transcripts).where(eq(transcripts.id, id));
      return transcript;
    } catch (error) {
      console.error(`Error fetching transcript with id ${id}:`, error);
      return undefined;
    }
  }

  async getAllTranscripts(): Promise<Transcript[]> {
    try {
      return await db.select().from(transcripts);
    } catch (error) {
      console.error('Error fetching all transcripts:', error);
      return [];
    }
  }

  async getRecentTranscripts(limit: number): Promise<Transcript[]> {
    try {
      return await db.select()
        .from(transcripts)
        .orderBy(desc(transcripts.createdAt))
        .limit(limit);
    } catch (error) {
      console.error(`Error fetching recent transcripts (limit: ${limit}):`, error);
      return [];
    }
  }

  async deleteTranscript(id: number): Promise<boolean> {
    try {
      const result = await db.delete(transcripts).where(eq(transcripts.id, id)).returning();
      return result.length > 0;
    } catch (error) {
      console.error(`Error deleting transcript with id ${id}:`, error);
      return false;
    }
  }
}

// Keep the memory storage implementation as a fallback
export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private transcripts: Map<number, Transcript>;
  private userCurrentId: number;
  private transcriptCurrentId: number;

  constructor() {
    this.users = new Map();
    this.transcripts = new Map();
    this.userCurrentId = 1;
    this.transcriptCurrentId = 1;
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userCurrentId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async createTranscript(insertTranscript: InsertTranscript): Promise<Transcript> {
    const id = this.transcriptCurrentId++;
    const transcript: Transcript = { 
      ...insertTranscript, 
      id, 
      createdAt: new Date() 
    };
    this.transcripts.set(id, transcript);
    return transcript;
  }

  async getTranscript(id: number): Promise<Transcript | undefined> {
    return this.transcripts.get(id);
  }

  async getAllTranscripts(): Promise<Transcript[]> {
    return Array.from(this.transcripts.values());
  }

  async getRecentTranscripts(limit: number): Promise<Transcript[]> {
    return Array.from(this.transcripts.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }

  async deleteTranscript(id: number): Promise<boolean> {
    return this.transcripts.delete(id);
  }
}

// Use database storage instead of memory storage
export const storage = new DatabaseStorage();
