import { useState } from 'react';
import { Transcript } from '@shared/schema';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Eye, Trash2, Clock } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { deleteTranscript } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface RecentTranscriptsProps {
  transcripts: Transcript[];
  onViewTranscript: (transcript: Transcript) => void;
}

export default function RecentTranscripts({ 
  transcripts, 
  onViewTranscript 
}: RecentTranscriptsProps) {
  const { toast } = useToast();
  const [expandList, setExpandList] = useState(false);
  
  const displayTranscripts = expandList ? transcripts : transcripts.slice(0, 5);
  
  const deleteMutation = useMutation({
    mutationFn: deleteTranscript,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/transcripts/recent'] });
      toast({
        title: "Transcript deleted",
        description: "The transcript has been successfully deleted.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to delete transcript: ${error.message}`,
        variant: "destructive",
      });
    }
  });
  
  const handleDelete = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteMutation.mutate(id);
  };
  
  if (transcripts.length === 0) {
    return (
      <Card className="p-6">
        <h2 className="text-xl font-medium text-gray-800 mb-4">Recent Transcripts</h2>
        <div className="text-center py-8 text-gray-500">
          <p>No transcripts yet. Start by transcribing a Twitter video above.</p>
        </div>
      </Card>
    );
  }
  
  return (
    <Card className="p-6">
      <h2 className="text-xl font-medium text-gray-800 mb-4">Recent Transcripts</h2>
      
      <div className="recent-transcripts-list">
        {displayTranscripts.map((transcript) => (
          <div 
            key={transcript.id}
            className="flex items-center justify-between p-3 hover:bg-neutral-50 border-b border-neutral-200 cursor-pointer"
            onClick={() => onViewTranscript(transcript)}
          >
            <div className="flex items-center">
              <div className="h-10 w-10 bg-neutral-200 rounded overflow-hidden flex items-center justify-center">
                <Clock className="h-5 w-5 text-gray-500" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-gray-800">{transcript.videoTitle}</h3>
                <div className="flex items-center">
                  <span className="text-xs text-gray-500">@{transcript.username}</span>
                  <span className="mx-2 text-gray-300">•</span>
                  <span className="text-xs text-gray-500">{transcript.duration} duration</span>
                </div>
              </div>
            </div>
            
            <div className="flex space-x-1">
              <Button variant="ghost" size="icon" onClick={() => onViewTranscript(transcript)}>
                <Eye className="h-4 w-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={(e) => handleDelete(transcript.id, e)}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
      
      {transcripts.length > 5 && (
        <div className="text-center pt-4">
          <Button 
            variant="link" 
            onClick={() => setExpandList(!expandList)}
          >
            {expandList ? "Show Less" : "View All Transcripts"}
          </Button>
        </div>
      )}
    </Card>
  );
}
