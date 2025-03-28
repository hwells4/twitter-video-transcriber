import { apiRequest } from "./queryClient";
import { TwitterUrlInput, Transcript } from "@shared/schema";

export const transcribeVideo = async (data: TwitterUrlInput): Promise<Transcript> => {
  const res = await apiRequest("POST", "/api/transcribe", data);
  return res.json();
};

export const getRecentTranscripts = async (limit: number = 5): Promise<Transcript[]> => {
  const res = await apiRequest("GET", `/api/transcripts/recent?limit=${limit}`);
  return res.json();
};

export const getTranscript = async (id: number): Promise<Transcript> => {
  const res = await apiRequest("GET", `/api/transcripts/${id}`);
  return res.json();
};

export const deleteTranscript = async (id: number): Promise<void> => {
  await apiRequest("DELETE", `/api/transcripts/${id}`);
};
