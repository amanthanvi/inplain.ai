'use client';

import { useState, useEffect } from 'react';
import { MessageSquare, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import FeedbackForm from './FeedbackForm';
import { cn } from '@/lib/utils';

export default function FeedbackWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [initialType, setInitialType] = useState<string | undefined>();

  useEffect(() => {
    // Listen for custom events to open feedback
    const handleOpenFeedback = (event: CustomEvent) => {
      if (event.detail?.type) {
        setInitialType(event.detail.type);
      }
      setIsOpen(true);
    };

    window.addEventListener('openFeedback' as any, handleOpenFeedback);
    return () => {
      window.removeEventListener('openFeedback' as any, handleOpenFeedback);
    };
  }, []);

  const handleSuccess = () => {
    setTimeout(() => {
      setIsOpen(false);
      setInitialType(undefined);
    }, 2000);
  };

  return (
    <>
      {/* Floating feedback button */}
      <div
        className={cn(
          'fixed bottom-6 right-6 z-50 transition-all duration-300',
          isMinimized && 'translate-x-0',
          !isMinimized && !isOpen && 'translate-x-0',
          isOpen && 'translate-x-[400px]'
        )}
      >
        <Button
          onClick={() => setIsOpen(true)}
          size="lg"
          className="rounded-full shadow-lg hover:shadow-xl transition-shadow bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
          aria-label="Send feedback"
        >
          <MessageSquare className="h-5 w-5 mr-2" />
          Feedback
        </Button>
      </div>

      {/* Feedback dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">Send Feedback</DialogTitle>
            <p className="text-muted-foreground">
              We'd love to hear from you! Share bugs, request features, or give us your thoughts.
            </p>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto">
            <FeedbackForm onSuccess={handleSuccess} initialType={initialType} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}