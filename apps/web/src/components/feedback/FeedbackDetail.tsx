'use client';

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { X, Mail, Clock, User, Link } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/use-toast';
import { Feedback, FeedbackStatus } from '@/lib/feedback';

interface FeedbackDetailProps {
  feedback: Feedback;
  isAdmin: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

export default function FeedbackDetail({
  feedback,
  isAdmin,
  onClose,
  onUpdate,
}: FeedbackDetailProps) {
  const [status, setStatus] = useState(feedback.status);
  const [notes, setNotes] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const { toast } = useToast();

  const handleStatusUpdate = async () => {
    if (!isAdmin) return;

    setIsUpdating(true);
    try {
      const response = await fetch(`/api/feedback/${feedback.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, notes }),
      });

      if (!response.ok) throw new Error('Failed to update feedback');

      toast({
        title: 'Feedback updated',
        description: 'The feedback status has been updated successfully.',
      });

      onUpdate();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update feedback status',
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const getSentimentColor = (sentiment?: string) => {
    switch (sentiment) {
      case 'positive':
        return 'text-green-500';
      case 'negative':
        return 'text-red-500';
      default:
        return 'text-gray-500';
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Feedback Details</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Header Info */}
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <h3 className="text-lg font-semibold">{feedback.title}</h3>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDistanceToNow(new Date(feedback.createdAt), { addSuffix: true })}
                </span>
                {feedback.context.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    {feedback.context.email}
                  </span>
                )}
                {feedback.context.userId && (
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    User ID: {feedback.context.userId}
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Badge>{feedback.type}</Badge>
              <Badge variant="outline">{feedback.status}</Badge>
              {feedback.priority && (
                <Badge variant={feedback.priority === 'urgent' ? 'destructive' : 'default'}>
                  {feedback.priority}
                </Badge>
              )}
            </div>
          </div>

          <Separator />

          {/* Description */}
          <div>
            <Label className="text-base">Description</Label>
            <p className="mt-2 text-sm leading-relaxed">{feedback.description}</p>
          </div>

          {/* Rating */}
          {feedback.rating && (
            <div>
              <Label className="text-base">Rating</Label>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-2xl font-bold">{feedback.rating}</span>
                <span className="text-muted-foreground">/ 5</span>
              </div>
            </div>
          )}

          {/* Context */}
          <div>
            <Label className="text-base">Context</Label>
            <div className="mt-2 space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Link className="h-3 w-3" />
                <a
                  href={feedback.context.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:underline"
                >
                  {feedback.context.url}
                </a>
              </div>
              <div className="text-muted-foreground">
                <p>Browser: {feedback.context.userAgent}</p>
                <p>
                  Viewport: {feedback.context.viewport.width} x{' '}
                  {feedback.context.viewport.height}
                </p>
              </div>
            </div>
          </div>

          {/* Tags and Sentiment */}
          {(feedback.tags?.length || feedback.sentiment) && (
            <div>
              <Label className="text-base">Analysis</Label>
              <div className="mt-2 space-y-2">
                {feedback.sentiment && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm">Sentiment:</span>
                    <span className={`text-sm font-medium ${getSentimentColor(feedback.sentiment)}`}>
                      {feedback.sentiment}
                    </span>
                  </div>
                )}
                {feedback.tags && feedback.tags.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm">Tags:</span>
                    {feedback.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Screenshots */}
          {feedback.screenshots && feedback.screenshots.length > 0 && (
            <div>
              <Label className="text-base">Screenshots</Label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {feedback.screenshots.map((screenshot, index) => (
                  <div key={screenshot.id} className="border rounded-lg p-2">
                    <p className="text-sm text-muted-foreground">
                      Screenshot {index + 1}
                      {screenshot.annotations && screenshot.annotations.length > 0 && (
                        <span> ({screenshot.annotations.length} annotations)</span>
                      )}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Admin Actions */}
          {isAdmin && (
            <>
              <Separator />
              <div className="space-y-4">
                <div>
                  <Label htmlFor="status">Update Status</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger id="status" className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                      <SelectItem value="wont_fix">Won't Fix</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="notes">Internal Notes</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add notes about this feedback..."
                    rows={3}
                    className="mt-1"
                  />
                </div>

                {feedback.internalNotes && (
                  <div>
                    <Label>Previous Notes</Label>
                    <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">
                      {feedback.internalNotes}
                    </p>
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button onClick={handleStatusUpdate} disabled={isUpdating}>
                    {isUpdating ? 'Updating...' : 'Update Feedback'}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}