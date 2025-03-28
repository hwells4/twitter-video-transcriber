import { useState, useRef } from 'react';
import { Transcript, TranscriptSegment } from '@shared/schema';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Copy, Download, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface TranscriptCardProps {
  transcript: Transcript;
}

export default function TranscriptCard({ transcript }: TranscriptCardProps) {
  const { toast } = useToast();
  const [fontSize, setFontSize] = useState<string>("medium");
  const transcriptRef = useRef<HTMLDivElement>(null);
  
  const handleCopyTranscript = async () => {
    if (!transcript.segments) return;
    
    const text = transcript.segments
      .map(segment => `${segment.timestamp ? `${segment.timestamp}\n` : ""}${segment.text}`)
      .join('\n\n');
    
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied to clipboard",
        description: "The transcript has been copied to your clipboard.",
        duration: 2000,
      });
    } catch (err) {
      toast({
        title: "Failed to copy",
        description: "Could not copy the transcript to clipboard.",
        variant: "destructive",
      });
    }
  };
  
  const handleDownloadTranscript = () => {
    if (!transcript.segments) return;
    
    const text = transcript.segments
      .map(segment => `${segment.timestamp ? `${segment.timestamp}\n` : ""}${segment.text}`)
      .join('\n\n');
    
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    
    a.href = url;
    a.download = `twitter-transcript-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    
    setTimeout(() => {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }, 0);
  };
  
  const getFontSizeClass = (size: string) => {
    switch (size) {
      case "small": return "text-sm";
      case "medium": return "text-base";
      case "large": return "text-lg";
      default: return "text-base";
    }
  };
  
  return (
    <Card className="p-6 mb-8">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-medium text-gray-800">Transcript</h2>
        
        <div className="flex space-x-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleCopyTranscript}
          >
            <Copy className="h-4 w-4 mr-1" />
            <span>Copy</span>
          </Button>
          
          <Button 
            variant="outline"
            size="sm"
            onClick={handleDownloadTranscript}
          >
            <Download className="h-4 w-4 mr-1" />
            <span>Download</span>
          </Button>
        </div>
      </div>

      {/* Info about video */}
      <div className="mb-4 p-3 bg-neutral-100 rounded-md">
        <div className="flex items-start">
          <div className="flex-shrink-0 h-12 w-12 rounded overflow-hidden bg-neutral-200 flex items-center justify-center">
            <Clock className="h-6 w-6 text-gray-500" />
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-gray-800">{transcript.videoTitle}</h3>
            <p className="text-xs text-gray-500">@{transcript.username}</p>
            <div className="flex items-center mt-1">
              <span className="text-xs text-gray-500 flex items-center">
                <Clock className="h-3 w-3 mr-1" />
                {transcript.duration} duration
              </span>
              <span className="mx-2 text-gray-300">•</span>
              <span className="text-xs text-gray-500">{transcript.language}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Transcript text */}
      <div 
        ref={transcriptRef}
        className="border border-neutral-200 rounded-md p-4 bg-white overflow-y-auto max-h-96"
      >
        <div className="space-y-4">
          {transcript.segments && transcript.segments.map((segment: TranscriptSegment, index: number) => (
            <div key={index} className="transcript-segment">
              {segment.timestamp && (
                <div className="text-xs text-gray-500 mb-1 font-medium">{segment.timestamp}</div>
              )}
              <p className={`text-gray-800 ${getFontSizeClass(fontSize)}`}>{segment.text}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 flex justify-between items-center">
        <div className="flex items-center">
          <label htmlFor="font-size" className="block text-sm font-medium text-gray-700 mr-2">Text Size:</label>
          <Select
            value={fontSize}
            onValueChange={setFontSize}
          >
            <SelectTrigger className="w-24 h-8 text-sm">
              <SelectValue placeholder="Text size" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="small">Small</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="large">Large</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <span className="text-xs text-gray-500">Last updated: {
            transcript.createdAt ? 
              new Date(transcript.createdAt).toLocaleString() : 
              new Date().toLocaleString()
          }</span>
        </div>
      </div>
    </Card>
  );
}
