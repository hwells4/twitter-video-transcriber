import { useState, useEffect } from "react";
import { Progress } from "@/components/ui/progress";
import { RefreshCw, CheckCircle, Clock } from "lucide-react";

interface Step {
  id: number;
  label: string;
  status: "completed" | "active" | "pending";
}

export default function ProcessingStatus() {
  const [progress, setProgress] = useState(0);
  const [steps, setSteps] = useState<Step[]>([
    {
      id: 1,
      label: "Fetching video from Twitter",
      status: "active",
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

  // Simulate progress and steps completion
  useEffect(() => {
    const updateProgress = () => {
      setProgress((prevProgress) => {
        if (prevProgress >= 100) {
          return 100;
        }
        return prevProgress + 5;
      });

      setSteps((prevSteps) => {
        const newSteps = [...prevSteps];
        
        if (progress >= 25 && progress < 50) {
          newSteps[0].status = "completed";
          newSteps[1].status = "active";
        } else if (progress >= 50 && progress < 75) {
          newSteps[0].status = "completed";
          newSteps[1].status = "completed";
          newSteps[2].status = "active";
        } else if (progress >= 75) {
          newSteps[0].status = "completed";
          newSteps[1].status = "completed";
          newSteps[2].status = "completed";
          newSteps[3].status = "active";
        }
        
        return newSteps;
      });
    };

    const timer = setInterval(updateProgress, 100);

    return () => {
      clearInterval(timer);
    };
  }, [progress]);

  return (
    <div className="mb-6 p-4 bg-neutral-100 rounded-md">
      <div className="flex items-center mb-2">
        <RefreshCw className="text-primary animate-spin mr-2 h-4 w-4" />
        <h3 className="font-medium text-gray-700">Processing Video</h3>
      </div>
      
      <Progress value={progress} className="w-full h-2.5 mb-2" />
      
      <ul className="space-y-1 text-sm">
        {steps.map((step) => (
          <li key={step.id} className="flex items-center">
            {step.status === "completed" ? (
              <span className="inline-flex items-center justify-center w-5 h-5 mr-2 rounded-full bg-success text-white">
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
            <span className={`${
              step.status === "pending" ? "text-gray-400" : "text-gray-600"
            }`}>
              {step.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
