import { AlertCircle } from 'lucide-react';

interface ErrorMessageProps {
  message: string;
}

export default function ErrorMessage({ message }: ErrorMessageProps) {
  return (
    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
      <div className="flex">
        <AlertCircle className="text-error h-5 w-5 mr-3" />
        <div>
          <h3 className="font-medium text-error">Error Processing Video</h3>
          <p className="mt-1 text-sm text-red-600">{message}</p>
        </div>
      </div>
    </div>
  );
}
