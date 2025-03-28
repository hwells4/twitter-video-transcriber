import { useState, useEffect } from "react";
import { Progress } from "@/components/ui/progress";
import { RefreshCw, CheckCircle, Clock, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Step {
  id: number;
  label: string;
  status: "completed" | "active" | "pending";
  message?: string;
}

interface ProgressUpdate {
  type: 'progress';
  step: number;
  progress: number;
  status: 'pending' | 'active' | 'completed';
  message: string;
  overallProgress: number;
}

export default function ProcessingStatus() {
  const [progress, setProgress] = useState(0);
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [connectionError, setConnectionError] = useState(false);
  const { toast } = useToast();
  
  const [steps, setSteps] = useState<Step[]>([
    {
      id: 1,
      label: "Fetching video from Twitter",
      status: "active",
      message: "Initializing..."
    },
    {
      id: 2,
      label: "Extracting audio",
      status: "pending",
    },
    {
      id: 3,
      label: "Transcribing audio",
      status: "pending",
    },
    {
      id: 4,
      label: "Formatting transcript",
      status: "pending",
    },
  ]);

  // Connect to WebSocket server when component mounts
  useEffect(() => {
    // Create WebSocket connection
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      console.log("WebSocket connection established");
      setConnectionError(false);
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Handle progress updates
        if (data.type === 'progress') {
          const update = data as ProgressUpdate;
          
          // Update overall progress
          setProgress(update.overallProgress);
          
          // Update steps status
          setSteps((prevSteps) => {
            const newSteps = [...prevSteps];
            
            // Find the step being updated
            if (update.step >= 1 && update.step <= newSteps.length) {
              const stepIndex = update.step - 1;
              
              // Update the step status
              newSteps[stepIndex] = {
                ...newSteps[stepIndex],
                status: update.status,
                message: update.message
              };
              
              // Update previous steps to completed if they aren't already
              for (let i = 0; i < stepIndex; i++) {
                if (newSteps[i].status !== 'completed') {
                  newSteps[i].status = 'completed';
                }
              }
              
              // Update following steps to pending
              for (let i = stepIndex + 1; i < newSteps.length; i++) {
                if (newSteps[i].status !== 'pending') {
                  newSteps[i].status = 'pending';
                }
              }
            }
            
            return newSteps;
          });
        }
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    };
    
    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      setConnectionError(true);
      toast({
        title: "Connection Error",
        description: "Could not connect to the transcription service. Progress updates may be delayed.",
        variant: "destructive"
      });
    };
    
    ws.onclose = () => {
      console.log("WebSocket connection closed");
    };
    
    // Store the WebSocket connection
    setSocket(ws);
    
    // Clean up the WebSocket connection when component unmounts
    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [toast]);

  return (
    <div className="mb-6 p-4 bg-neutral-100 rounded-md">
      <div className="flex items-center mb-2">
        {connectionError ? (
          <AlertCircle className="text-destructive mr-2 h-4 w-4" />
        ) : (
          <RefreshCw className="text-primary animate-spin mr-2 h-4 w-4" />
        )}
        <h3 className="font-medium text-gray-700">
          {connectionError ? "Processing Video (Limited Updates)" : "Processing Video"}
        </h3>
      </div>
      
      <Progress value={progress} className="w-full h-2.5 mb-2" />
      
      <div className="text-xs text-right text-gray-500 mb-2">
        {progress}% complete
      </div>
      
      <ul className="space-y-1 text-sm">
        {steps.map((step) => (
          <li key={step.id} className="flex items-start">
            <div className="mt-0.5">
              {step.status === "completed" ? (
                <span className="inline-flex items-center justify-center w-5 h-5 mr-2 rounded-full bg-green-500 text-white">
                  <CheckCircle className="h-3 w-3" />
                </span>
              ) : step.status === "active" ? (
                <span className="inline-flex items-center justify-center w-5 h-5 mr-2 rounded-full bg-primary text-white">
                  <RefreshCw className="h-3 w-3 animate-spin" />
                </span>
              ) : (
                <span className="inline-flex items-center justify-center w-5 h-5 mr-2 rounded-full bg-neutral-300 text-gray-500">
                  <Clock className="h-3 w-3" />
                </span>
              )}
            </div>
            <div>
              <span className={`${
                step.status === "pending" ? "text-gray-400" : "text-gray-600"
              } block font-medium`}>
                {step.label}
              </span>
              {step.message && (
                <span className="text-xs text-gray-500 block mt-0.5">
                  {step.message}
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
