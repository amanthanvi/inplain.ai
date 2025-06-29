'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import {
  Bug,
  Lightbulb,
  MessageSquare,
  Star,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Clock,
  Filter,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import FeedbackDetail from './FeedbackDetail';
import FeedbackAnalytics from './FeedbackAnalytics';
import { Feedback, FeedbackStatus, FeedbackType, FeedbackPriority } from '@/lib/feedback';
import { formatDistanceToNow } from 'date-fns';

export default function FeedbackDashboard() {
  const { user } = useUser();
  const [feedbackList, setFeedbackList] = useState<Feedback[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null);
  const [filters, setFilters] = useState({
    type: 'all',
    status: 'all',
    priority: 'all',
  });
  const [currentPage, setCurrentPage] = useState(0);
  const pageSize = 20;

  const isAdmin = user?.publicMetadata?.role === 'admin';

  useEffect(() => {
    fetchFeedback();
  }, [filters, currentPage]);

  const fetchFeedback = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        limit: pageSize.toString(),
        offset: (currentPage * pageSize).toString(),
      });

      if (filters.type !== 'all') params.append('type', filters.type);
      if (filters.status !== 'all') params.append('status', filters.status);
      if (filters.priority !== 'all') params.append('priority', filters.priority);

      const response = await fetch(`/api/feedback?${params}`);
      if (!response.ok) throw new Error('Failed to fetch feedback');

      const data = await response.json();
      setFeedbackList(data.items);
      setTotalCount(data.total);
    } catch (error) {
      console.error('Error fetching feedback:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getTypeIcon = (type: FeedbackType) => {
    switch (type) {
      case 'bug':
        return <Bug className="h-4 w-4 text-red-500" />;
      case 'feature':
        return <Lightbulb className="h-4 w-4 text-yellow-500" />;
      case 'general':
        return <MessageSquare className="h-4 w-4 text-blue-500" />;
      case 'rating':
        return <Star className="h-4 w-4 text-purple-500" />;
    }
  };

  const getStatusIcon = (status: FeedbackStatus) => {
    switch (status) {
      case 'new':
        return <AlertCircle className="h-4 w-4 text-blue-500" />;
      case 'in_progress':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'resolved':
      case 'closed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      default:
        return null;
    }
  };

  const getPriorityBadge = (priority: FeedbackPriority) => {
    const variants: Record<FeedbackPriority, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      low: 'secondary',
      medium: 'default',
      high: 'destructive',
      urgent: 'destructive',
    };

    return (
      <Badge variant={variants[priority]}>
        {priority}
      </Badge>
    );
  };

  if (!isAdmin && !user) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Please sign in to view your feedback</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Feedback Dashboard</h2>
        <p className="text-muted-foreground">
          {isAdmin ? 'Manage and respond to user feedback' : 'Track your submitted feedback'}
        </p>
      </div>

      <Tabs defaultValue="feedback" className="space-y-4">
        <TabsList>
          <TabsTrigger value="feedback">Feedback</TabsTrigger>
          {isAdmin && <TabsTrigger value="analytics">Analytics</TabsTrigger>}
        </TabsList>

        <TabsContent value="feedback" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle>Filters</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                <Select
                  value={filters.type}
                  onValueChange={(value) => setFilters({ ...filters, type: value })}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="bug">Bug Reports</SelectItem>
                    <SelectItem value="feature">Feature Requests</SelectItem>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="rating">Ratings</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={filters.status}
                  onValueChange={(value) => setFilters({ ...filters, status: value })}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                    <SelectItem value="wont_fix">Won't Fix</SelectItem>
                  </SelectContent>
                </Select>

                {isAdmin && (
                  <Select
                    value={filters.priority}
                    onValueChange={(value) => setFilters({ ...filters, priority: value })}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Priorities</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Feedback List */}
          <Card>
            <CardHeader>
              <CardTitle>Feedback ({totalCount})</CardTitle>
              <CardDescription>
                Click on any feedback to view details
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : feedbackList.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No feedback found</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Status</TableHead>
                      {isAdmin && <TableHead>Priority</TableHead>}
                      <TableHead>Submitted</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {feedbackList.map((feedback) => (
                      <TableRow key={feedback.id}>
                        <TableCell>{getTypeIcon(feedback.type)}</TableCell>
                        <TableCell className="font-medium">
                          {feedback.title}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(feedback.status)}
                            <span className="text-sm">{feedback.status}</span>
                          </div>
                        </TableCell>
                        {isAdmin && (
                          <TableCell>
                            {feedback.priority && getPriorityBadge(feedback.priority)}
                          </TableCell>
                        )}
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(feedback.createdAt), {
                            addSuffix: true,
                          })}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedFeedback(feedback)}
                          >
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              {/* Pagination */}
              {totalCount > pageSize && (
                <div className="flex justify-between items-center mt-4">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentPage(currentPage - 1)}
                    disabled={currentPage === 0}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {currentPage + 1} of {Math.ceil(totalCount / pageSize)}
                  </span>
                  <Button
                    variant="outline"
                    onClick={() => setCurrentPage(currentPage + 1)}
                    disabled={(currentPage + 1) * pageSize >= totalCount}
                  >
                    Next
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {isAdmin && (
          <TabsContent value="analytics" className="space-y-4">
            <FeedbackAnalytics />
          </TabsContent>
        )}
      </Tabs>

      {/* Feedback Detail Modal */}
      {selectedFeedback && (
        <FeedbackDetail
          feedback={selectedFeedback}
          isAdmin={isAdmin}
          onClose={() => setSelectedFeedback(null)}
          onUpdate={() => {
            fetchFeedback();
            setSelectedFeedback(null);
          }}
        />
      )}
    </div>
  );
}