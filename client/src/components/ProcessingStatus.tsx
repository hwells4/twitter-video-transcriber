import { useState, useEffect } from "react";
import { Progress } from "@/components/ui/progress";
import { RefreshCw, CheckCircle, Clock, AlertCircle, XCircle } from "lucide-react";
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

interface ErrorUpdate {
  type: 'error';
  message: string;
  overallProgress: number;
}

export default function ProcessingStatus() {
  const [progress, setProgress] = useState(0);
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [connectionError, setConnectionError] = useState(false);
  const [processingError, setProcessingError] = useState<string | null>(null);
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
        // Handle error updates
        else if (data.type === 'error') {
          const errorUpdate = data as ErrorUpdate;
          
          // Update overall progress
          setProgress(errorUpdate.overallProgress);
          
          // Set the error message
          setProcessingError(errorUpdate.message);
          
          // Update the first step with the error message and set it to active
          setSteps((prevSteps) => {
            const newSteps = [...prevSteps];
            
            // Set the first step to show the error
            newSteps[0] = {
              ...newSteps[0],
              status: "active",
              message: errorUpdate.message
            };
            
            // Reset the other steps to pending
            for (let i = 1; i < newSteps.length; i++) {
              newSteps[i] = {
                ...newSteps[i],
                status: "pending",
                message: undefined
              };
            }
            
            return newSteps;
          });
          
          // Also show a toast with the error
          toast({
            title: "Transcription Error",
            description: errorUpdate.message,
            variant: "destructive"
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
    <div className={`mb-6 p-4 ${processingError ? 'bg-red-50 border border-red-200' : 'bg-neutral-100'} rounded-md`}>
      <div className="flex items-center mb-2">
        {processingError ? (
          <XCircle className="text-destructive mr-2 h-4 w-4" />
        ) : connectionError ? (
          <AlertCircle className="text-amber-500 mr-2 h-4 w-4" />
        ) : (
          <RefreshCw className="text-primary animate-spin mr-2 h-4 w-4" />
        )}
        <h3 className={`font-medium ${processingError ? 'text-red-700' : 'text-gray-700'}`}>
          {processingError ? "Transcription Error" : 
           connectionError ? "Processing Video (Limited Updates)" : 
           "Processing Video"}
        </h3>
      </div>
      
      {processingError ? (
        <div className="bg-red-100 border-l-4 border-red-500 p-3 mb-3 rounded">
          <p className="text-sm text-red-700">{processingError}</p>
          <p className="text-xs text-red-600 mt-1">
            Please try again with a different video or check your API credentials.
          </p>
        </div>
      ) : (
        <>
          <Progress value={progress} className="w-full h-2.5 mb-2" />
          
          <div className="text-xs text-right text-gray-500 mb-2">
            {progress}% complete
          </div>
        </>
      )}
      
      <ul className="space-y-1 text-sm">
        {steps.map((step) => (
          <li key={step.id} className="flex items-start">
            <div className="mt-0.5">
              {processingError && step.id === 1 ? (
                <span className="inline-flex items-center justify-center w-5 h-5 mr-2 rounded-full bg-red-500 text-white">
                  <XCircle className="h-3 w-3" />
                </span>
              ) : step.status === "completed" ? (
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
                processingError && step.id === 1 ? "text-red-700" :
                step.status === "pending" ? "text-gray-400" : "text-gray-600"
              } block font-medium`}>
                {step.label}
              </span>
              {step.message && (
                <span className={`text-xs ${
                  processingError && step.id === 1 ? "text-red-600" : "text-gray-500"
                } block mt-0.5`}>
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
