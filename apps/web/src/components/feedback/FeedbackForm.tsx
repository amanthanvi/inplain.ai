'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Bug,
  Lightbulb,
  MessageSquare,
  Star,
  Camera,
  Loader2,
  CheckCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/components/ui/use-toast';
import { FeedbackSubmissionSchema, FeedbackType } from '@/lib/feedback';
import ScreenshotCapture from './ScreenshotCapture';
import { useUser } from '@clerk/nextjs';

const feedbackTypes = [
  { value: 'bug', label: 'Bug Report', icon: Bug, color: 'text-red-500' },
  { value: 'feature', label: 'Feature Request', icon: Lightbulb, color: 'text-yellow-500' },
  { value: 'general', label: 'General Feedback', icon: MessageSquare, color: 'text-blue-500' },
  { value: 'rating', label: 'Rate Experience', icon: Star, color: 'text-purple-500' },
] as const;

interface FeedbackFormProps {
  onSuccess?: () => void;
  initialType?: string;
}

export default function FeedbackForm({ onSuccess, initialType }: FeedbackFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [screenshots, setScreenshots] = useState<any[]>([]);
  const [showScreenshotCapture, setShowScreenshotCapture] = useState(false);
  const { toast } = useToast();
  const { user } = useUser();

  const form = useForm<z.infer<typeof FeedbackSubmissionSchema>>({
    resolver: zodResolver(FeedbackSubmissionSchema),
    defaultValues: {
      type: (initialType as any) || 'general',
      title: '',
      description: '',
      email: user?.emailAddresses?.[0]?.emailAddress || '',
      rating: undefined,
      screenshots: [],
      context: {
        url: typeof window !== 'undefined' ? window.location.href : '',
        userAgent: typeof window !== 'undefined' ? navigator.userAgent : '',
        viewport: {
          width: typeof window !== 'undefined' ? window.innerWidth : 0,
          height: typeof window !== 'undefined' ? window.innerHeight : 0,
        },
      },
    },
  });

  const selectedType = form.watch('type');

  const onSubmit = async (data: z.infer<typeof FeedbackSubmissionSchema>) => {
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          screenshots: screenshots,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to submit feedback');
      }

      setIsSuccess(true);
      toast({
        title: 'Feedback submitted!',
        description: 'Thank you for your feedback. We will review it soon.',
      });

      if (onSuccess) {
        onSuccess();
      }

      // Reset form after a delay
      setTimeout(() => {
        form.reset();
        setScreenshots([]);
        setIsSuccess(false);
      }, 3000);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to submit feedback',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleScreenshotCapture = (screenshot: any) => {
    if (screenshots.length >= 5) {
      toast({
        title: 'Screenshot limit reached',
        description: 'You can add up to 5 screenshots per feedback submission.',
        variant: 'destructive',
      });
      return;
    }
    setScreenshots([...screenshots, screenshot]);
    setShowScreenshotCapture(false);
  };

  if (isSuccess) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
        <h3 className="text-xl font-semibold mb-2">Thank you!</h3>
        <p className="text-muted-foreground text-center">
          Your feedback has been submitted successfully.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      {/* Feedback Type Selection */}
      <div>
        <Label>What kind of feedback do you have?</Label>
        <RadioGroup
          value={selectedType}
          onValueChange={(value) => form.setValue('type', value as FeedbackType)}
          className="grid grid-cols-2 gap-4 mt-2"
        >
          {feedbackTypes.map((type) => {
            const Icon = type.icon;
            return (
              <div key={type.value}>
                <RadioGroupItem
                  value={type.value}
                  id={type.value}
                  className="peer sr-only"
                />
                <Label
                  htmlFor={type.value}
                  className="flex items-center gap-3 rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 cursor-pointer transition-all"
                >
                  <Icon className={`h-5 w-5 ${type.color}`} />
                  <span className="font-medium">{type.label}</span>
                </Label>
              </div>
            );
          })}
        </RadioGroup>
      </div>

      {/* Title */}
      <div>
        <div className="flex justify-between items-baseline">
          <Label htmlFor="title">Title</Label>
          <span className="text-xs text-muted-foreground">
            {form.watch('title')?.length || 0}/200
          </span>
        </div>
        <Input
          id="title"
          placeholder="Brief summary of your feedback"
          maxLength={200}
          {...form.register('title')}
          className="mt-1"
          aria-invalid={!!form.formState.errors.title}
        />
        {form.formState.errors.title && (
          <p className="text-sm text-red-500 mt-1">
            {form.formState.errors.title.message}
          </p>
        )}
      </div>

      {/* Description */}
      <div>
        <div className="flex justify-between items-baseline">
          <Label htmlFor="description">Description</Label>
          <span className="text-xs text-muted-foreground">
            {form.watch('description')?.length || 0}/5000
          </span>
        </div>
        <Textarea
          id="description"
          placeholder="Please provide details..."
          rows={5}
          maxLength={5000}
          {...form.register('description')}
          className="mt-1"
          aria-invalid={!!form.formState.errors.description}
        />
        {form.formState.errors.description && (
          <p className="text-sm text-red-500 mt-1">
            {form.formState.errors.description.message}
          </p>
        )}
        {!form.formState.errors.description && form.watch('description')?.length > 0 && form.watch('description')?.length < 10 && (
          <p className="text-sm text-yellow-600 mt-1">
            Please add more details (minimum 10 characters)
          </p>
        )}
      </div>

      {/* Rating (only for rating type) */}
      {selectedType === 'rating' && (
        <div>
          <Label>How would you rate your experience?</Label>
          <div className="flex gap-2 mt-2">
            {[1, 2, 3, 4, 5].map((rating) => (
              <button
                key={rating}
                type="button"
                onClick={() => form.setValue('rating', rating)}
                className="group"
              >
                <Star
                  className={`h-8 w-8 transition-colors ${
                    form.watch('rating') && form.watch('rating')! >= rating
                      ? 'fill-yellow-400 text-yellow-400'
                      : 'text-gray-300 hover:text-yellow-400'
                  }`}
                />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Email (optional) */}
      <div>
        <Label htmlFor="email">Email (optional)</Label>
        <Input
          id="email"
          type="email"
          placeholder="your@email.com"
          {...form.register('email')}
          className="mt-1"
        />
        <p className="text-sm text-muted-foreground mt-1">
          We'll only use this to follow up on your feedback
        </p>
      </div>

      {/* Screenshots */}
      <div>
        <div className="flex justify-between items-baseline">
          <Label>Screenshots (optional)</Label>
          <span className="text-xs text-muted-foreground">
            {screenshots.length}/5 added
          </span>
        </div>
        <div className="mt-2 space-y-2">
          {screenshots.map((screenshot, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-2 border rounded"
            >
              <span className="text-sm">Screenshot {index + 1}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setScreenshots(screenshots.filter((_, i) => i !== index))}
              >
                Remove
              </Button>
            </div>
          ))}
          {screenshots.length < 5 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowScreenshotCapture(true)}
              className="w-full"
            >
              <Camera className="h-4 w-4 mr-2" />
              Add Screenshot
            </Button>
          )}
        </div>
      </div>

      {/* Submit Button */}
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Submitting...
          </>
        ) : (
          'Submit Feedback'
        )}
      </Button>

      {/* Screenshot Capture Modal */}
      {showScreenshotCapture && (
        <ScreenshotCapture
          onCapture={handleScreenshotCapture}
          onClose={() => setShowScreenshotCapture(false)}
        />
      )}
    </form>
  );
}