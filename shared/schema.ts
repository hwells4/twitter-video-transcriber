import { pgTable, text, serial, integer, timestamp, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const transcripts = pgTable("transcripts", {
  id: serial("id").primaryKey(),
  twitterUrl: text("twitter_url").notNull(),
  videoTitle: text("video_title"),
  username: text("username"),
  duration: text("duration"),
  language: text("language"),
  timestampFormat: text("timestamp_format"),
  segments: json("segments").$type<TranscriptSegment[]>(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTranscriptSchema = createInsertSchema(transcripts).omit({
  id: true,
  createdAt: true,
});

export type TranscriptSegment = {
  timestamp: string;
  text: string;
};

export type InsertTranscript = z.infer<typeof insertTranscriptSchema>;
export type Transcript = typeof transcripts.$inferSelect;

export const twitterUrlSchema = z.object({
  url: z.string().url().refine(
    (url) => /twitter\.com\/\w+\/status\/\d+/i.test(url) || /x\.com\/\w+\/status\/\d+/i.test(url),
    {
      message: "Must be a valid Twitter/X video URL",
    }
  ),
  language: z.string().optional().default("auto"),
  timestampFormat: z.enum(["none", "seconds", "detailed"]).optional().default("seconds"),
});

export type TwitterUrlInput = z.infer<typeof twitterUrlSchema>;
