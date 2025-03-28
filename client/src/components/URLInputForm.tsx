import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { twitterUrlSchema, TwitterUrlInput, Transcript } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation } from "@tanstack/react-query";
import { transcribeVideo } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { Link, Clock, CheckCircle2 } from "lucide-react";
import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";

interface URLInputFormProps {
  onStartProcessing: () => void;
  onProcessingComplete: (transcript: Transcript) => void;
  onError: (error: string) => void;
}

export default function URLInputForm({
  onStartProcessing,
  onProcessingComplete,
  onError
}: URLInputFormProps) {
  // Twitter API rate limit window (15 minutes = 900 seconds)
  const TWITTER_RATE_LIMIT_WINDOW = 15 * 60; // in seconds
  
  // State for tracking last API call time
  const [lastApiCallTime, setLastApiCallTime] = useState<number | null>(() => {
    const saved = localStorage.getItem('lastTwitterApiCall');
    return saved ? parseInt(saved, 10) : null;
  });
  
  // State for countdown
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [isReady, setIsReady] = useState<boolean>(true);
  
  // Setup form with default values
  const form = useForm<TwitterUrlInput>({
    resolver: zodResolver(twitterUrlSchema),
    defaultValues: {
      url: "",
      language: "auto",
      timestampFormat: "none"
    }
  });
  
  // Effect to handle countdown timer
  useEffect(() => {
    // If we have a last API call time, calculate the time remaining
    if (lastApiCallTime) {
      const now = Date.now();
      const elapsedSeconds = Math.floor((now - lastApiCallTime) / 1000);
      const remaining = Math.max(0, TWITTER_RATE_LIMIT_WINDOW - elapsedSeconds);
      
      setTimeRemaining(remaining);
      setIsReady(remaining === 0);
      
      // Setup interval to update countdown
      const interval = setInterval(() => {
        const now = Date.now();
        const elapsedSeconds = Math.floor((now - lastApiCallTime) / 1000);
        const remaining = Math.max(0, TWITTER_RATE_LIMIT_WINDOW - elapsedSeconds);
        
        setTimeRemaining(remaining);
        setIsReady(remaining === 0);
        
        // If countdown finished, clear local storage
        if (remaining === 0) {
          clearInterval(interval);
        }
      }, 1000);
      
      return () => clearInterval(interval);
    }
  }, [lastApiCallTime]);
  
  const transcribeVideoMutation = useMutation({
    mutationFn: transcribeVideo,
    onSuccess: (data) => {
      // Record the API call time
      const now = Date.now();
      setLastApiCallTime(now);
      localStorage.setItem('lastTwitterApiCall', now.toString());
      
      queryClient.invalidateQueries({ queryKey: ['/api/transcripts/recent'] });
      onProcessingComplete(data);
    },
    onError: (error: Error) => {
      // Extract the error message from the error
      let errorMessage = error.message;
      let isRateLimit = false;
      
      // Try to parse the error message if it's from a server error
      if (errorMessage.includes('Failed to fetch')) {
        errorMessage = "Could not connect to server. Please check your internet connection and try again.";
      } else if (errorMessage.includes('Twitter API credentials are missing or invalid')) {
        errorMessage = "Twitter API authentication failed. Please check your API credentials.";
      } else if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
        errorMessage = "Twitter API rate limit exceeded. Due to Twitter's strict limits (15 requests/15 minutes), please wait at least 15 minutes before trying again. We've added caching to reduce API calls for repeat requests.";
        isRateLimit = true;
        
        // Record the API call time even on rate limit error
        const now = Date.now();
        setLastApiCallTime(now);
        localStorage.setItem('lastTwitterApiCall', now.toString());
      } else if (errorMessage.includes('not authorized')) {
        errorMessage = "Not authorized to access this tweet. It may be from a private account.";
      } else if (errorMessage.includes('No video found')) {
        errorMessage = "No video found in the tweet. Please try a different tweet URL.";
      } else if (errorMessage.includes('Tweet not found')) {
        errorMessage = "Tweet not found. The tweet may be private or deleted.";
      }
      
      onError(errorMessage);
    }
  });
  
  const onSubmit = (data: TwitterUrlInput) => {
    onStartProcessing();
    transcribeVideoMutation.mutate(data);
  };
  
  // Format remaining time as mm:ss
  const formatRemainingTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="mb-6">
        <FormField
          control={form.control}
          name="url"
          render={({ field }) => (
            <FormItem className="mb-4">
              <FormLabel className="block text-sm font-medium text-gray-700 mb-1">Twitter Video URL</FormLabel>
              <div className="flex">
                <div className="relative flex-grow">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Link className="h-4 w-4 text-gray-400" />
                  </span>
                  <FormControl>
                    <Input
                      {...field}
                      className="pl-10 pr-3 py-2"
                      placeholder="https://twitter.com/username/status/1234567890"
                    />
                  </FormControl>
                </div>
                <Button 
                  type="submit" 
                  className="rounded-l-none"
                  disabled={transcribeVideoMutation.isPending}
                >
                  Transcribe
                </Button>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <div className="mt-4 flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-4">
          <FormField
            control={form.control}
            name="language"
            render={({ field }) => (
              <FormItem className="w-full sm:w-auto">
                <FormLabel className="block text-sm font-medium text-gray-700 mb-1">Language (optional)</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select language" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="auto">Auto-detect</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="es">Spanish</SelectItem>
                    <SelectItem value="fr">French</SelectItem>
                    <SelectItem value="de">German</SelectItem>
                    <SelectItem value="zh">Chinese</SelectItem>
                    <SelectItem value="ja">Japanese</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="timestampFormat"
            render={({ field }) => (
              <FormItem className="w-full sm:w-auto">
                <FormLabel className="block text-sm font-medium text-gray-700 mb-1">Timestamp Format</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select format" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">No Timestamps</SelectItem>
                    <SelectItem value="seconds">Seconds (00:15)</SelectItem>
                    <SelectItem value="detailed">Detailed (00:00:15.00)</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        
        {/* API Rate Limit Indicator */}
        <div className="mt-4">
          {lastApiCallTime && timeRemaining > 0 ? (
            <Badge variant="outline" className="flex items-center gap-2 py-1 px-3">
              <Clock className="h-4 w-4 text-amber-500" />
              <span>
                Twitter API cooldown: <span className="font-semibold">{formatRemainingTime(timeRemaining)}</span> remaining
              </span>
            </Badge>
          ) : (
            <Badge variant="outline" className="flex items-center gap-2 py-1 px-3 bg-green-50 text-green-700 border-green-200">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="font-medium">Ready for analysis</span>
            </Badge>
          )}
        </div>
      </form>
    </Form>
  );
}
