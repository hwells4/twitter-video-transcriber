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
import { Link } from "lucide-react";

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
  const form = useForm<TwitterUrlInput>({
    resolver: zodResolver(twitterUrlSchema),
    defaultValues: {
      url: "",
      language: "auto",
      timestampFormat: "seconds"
    }
  });
  
  const transcribeVideoMutation = useMutation({
    mutationFn: transcribeVideo,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/transcripts/recent'] });
      onProcessingComplete(data);
    },
    onError: (error: Error) => {
      // Extract the error message from the error
      let errorMessage = error.message;
      
      // Try to parse the error message if it's from a server error
      if (errorMessage.includes('Failed to fetch')) {
        errorMessage = "Could not connect to server. Please check your internet connection and try again.";
      } else if (errorMessage.includes('Twitter API credentials are missing or invalid')) {
        errorMessage = "Twitter API authentication failed. Please check your API credentials.";
      } else if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
        errorMessage = "Twitter API rate limit exceeded. Please try again in a few minutes.";
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
      </form>
    </Form>
  );
}
