import { 
  users, 
  type User, 
  type InsertUser, 
  transcripts, 
  type Transcript, 
  type InsertTranscript,
  type TranscriptSegment 
} from "@shared/schema";

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

export const storage = new MemStorage();
