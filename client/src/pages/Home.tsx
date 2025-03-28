import { useState } from "react";
import URLInputForm from "@/components/URLInputForm";
import ProcessingStatus from "@/components/ProcessingStatus";
import ErrorMessage from "@/components/ErrorMessage";
import TranscriptCard from "@/components/TranscriptCard";
import RecentTranscripts from "@/components/RecentTranscripts";
import Footer from "@/components/Footer";
import { Transcript } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";

export default function Home() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentTranscript, setCurrentTranscript] = useState<Transcript | null>(null);
  
  // Fetch recent transcripts
  const { data: recentTranscripts } = useQuery({
    queryKey: ['/api/transcripts/recent'],
    staleTime: 60000, // 1 minute
  });
  
  const handleStartProcessing = () => {
    setIsProcessing(true);
    setError(null);
  };
  
  const handleProcessingComplete = (transcript: Transcript) => {
    setIsProcessing(false);
    setCurrentTranscript(transcript);
  };
  
  const handleError = (errorMessage: string) => {
    setIsProcessing(false);
    setError(errorMessage);
  };
  
  const handleViewTranscript = (transcript: Transcript) => {
    setCurrentTranscript(transcript);
    setError(null);
  };

  return (
    <div className="min-h-screen">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <header className="mb-8 text-center">
          <h1 className="text-3xl font-semibold text-gray-800 mb-2">Twitter Video Transcriber</h1>
          <p className="text-gray-600">Automatically transcribe audio from Twitter videos to text</p>
        </header>
        
        {/* Main Card */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <URLInputForm 
            onStartProcessing={handleStartProcessing}
            onProcessingComplete={handleProcessingComplete}
            onError={handleError}
          />
          
          {isProcessing && <ProcessingStatus />}
          
          {error && <ErrorMessage message={error} />}
        </div>
        
        {/* Transcript Card */}
        {currentTranscript && (
          <TranscriptCard transcript={currentTranscript} />
        )}
        
        {/* Recent Transcripts */}
        <RecentTranscripts 
          transcripts={recentTranscripts || []}
          onViewTranscript={handleViewTranscript}
        />
        
        {/* Footer */}
        <Footer />
      </div>
    </div>
  );
}
