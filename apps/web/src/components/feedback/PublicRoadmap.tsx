"use client";

import { useState, useEffect } from "react";
import { ThumbsUp, MessageSquare, Sparkles, Lightbulb } from "lucide-react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { Feedback, FeedbackStatus } from "@/lib/feedback";
import { useUser } from "@clerk/nextjs";
import { formatDistanceToNow } from "date-fns";

interface RoadmapItem extends Feedback {
	voteCount?: number;
	hasVoted?: boolean;
}

export default function PublicRoadmap() {
	const { user } = useUser();
	const { toast } = useToast();
	const [roadmapItems, setRoadmapItems] = useState<{
		planned: RoadmapItem[];
		inProgress: RoadmapItem[];
		completed: RoadmapItem[];
	}>({
		planned: [],
		inProgress: [],
		completed: [],
	});
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		fetchRoadmapItems();
	}, []);

	const fetchRoadmapItems = async () => {
		setIsLoading(true);
		try {
			// Fetch feature requests
			const response = await fetch(
				"/api/feedback?type=feature&limit=100"
			);
			if (!response.ok) throw new Error("Failed to fetch roadmap items");

			const data = await response.json();
			const features: RoadmapItem[] = data.items;

			// Group by status
			const grouped = {
				planned: features.filter(
					(f) => f.status === "new" || f.status === "in_progress"
				),
				inProgress: features.filter((f) => f.status === "in_progress"),
				completed: features.filter(
					(f) => f.status === "resolved" || f.status === "closed"
				),
			};

			setRoadmapItems(grouped);
		} catch (error) {
			console.error("Error fetching roadmap:", error);
			toast({
				title: "Error",
				description: "Failed to load roadmap items",
				variant: "destructive",
			});
		} finally {
			setIsLoading(false);
		}
	};

	const handleVote = async (itemId: string) => {
		if (!user) {
			toast({
				title: "Sign in required",
				description: "Please sign in to vote on features",
			});
			return;
		}

		// In a real implementation, this would update the vote count in the backend
		toast({
			title: "Vote recorded",
			description: "Thank you for your feedback!",
		});

		// Update local state to show the vote
		setRoadmapItems((prev) => {
			const updateItems = (items: RoadmapItem[]) =>
				items.map((item) =>
					item.id === itemId
						? {
								...item,
								voteCount: (item.voteCount || 0) + 1,
								hasVoted: true,
							}
						: item
				);

			return {
				planned: updateItems(prev.planned),
				inProgress: updateItems(prev.inProgress),
				completed: updateItems(prev.completed),
			};
		});
	};

	const RoadmapCard = ({ item }: { item: RoadmapItem }) => (
		<Card className="h-full hover:shadow-md transition-shadow">
			<CardHeader>
				<div className="flex items-start justify-between">
					<div className="flex-1">
						<CardTitle className="text-lg">{item.title}</CardTitle>
						<CardDescription className="mt-1">
							{item.description.length > 150
								? `${item.description.substring(0, 150)}...`
								: item.description}
						</CardDescription>
					</div>
					<Badge
						variant={
							item.priority === "high"
								? "destructive"
								: "secondary"
						}
					>
						{item.priority || "medium"}
					</Badge>
				</div>
			</CardHeader>
			<CardContent>
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-4 text-sm text-muted-foreground">
						<span className="flex items-center gap-1">
							<MessageSquare className="h-4 w-4" />
							{formatDistanceToNow(new Date(item.createdAt), {
								addSuffix: true,
							})}
						</span>
					</div>
					<Button
						variant={item.hasVoted ? "secondary" : "outline"}
						size="sm"
						onClick={() => handleVote(item.id)}
						disabled={item.hasVoted}
					>
						<ThumbsUp
							className={`h-4 w-4 mr-1 ${item.hasVoted ? "fill-current" : ""}`}
						/>
						{item.voteCount || 0}
					</Button>
				</div>
			</CardContent>
		</Card>
	);

	if (isLoading) {
		return (
			<div className="space-y-4">
				{[...Array(6)].map((_, i) => (
					<Skeleton key={i} className="h-32 w-full" />
				))}
			</div>
		);
	}

	return (
		<div className="space-y-8">
			<Tabs defaultValue="planned" className="w-full">
				<TabsList className="grid w-full grid-cols-3">
					<TabsTrigger value="planned">
						Planned ({roadmapItems.planned.length})
					</TabsTrigger>
					<TabsTrigger value="in-progress">
						In Progress ({roadmapItems.inProgress.length})
					</TabsTrigger>
					<TabsTrigger value="completed">
						Completed ({roadmapItems.completed.length})
					</TabsTrigger>
				</TabsList>

				<TabsContent value="planned" className="mt-6">
					<div className="space-y-4">
						<div className="flex items-center gap-2 mb-4">
							<Sparkles className="h-5 w-5 text-blue-500" />
							<h3 className="text-lg font-semibold">
								Planned Features
							</h3>
							<p className="text-sm text-muted-foreground">
								Features we're considering based on your
								feedback
							</p>
						</div>
						{roadmapItems.planned.length === 0 ? (
							<Card>
								<CardContent className="py-8 text-center text-muted-foreground">
									No planned features at the moment
								</CardContent>
							</Card>
						) : (
							<div className="grid gap-4 md:grid-cols-2">
								{roadmapItems.planned.map((item) => (
									<RoadmapCard key={item.id} item={item} />
								))}
							</div>
						)}
					</div>
				</TabsContent>

				<TabsContent value="in-progress" className="mt-6">
					<div className="space-y-4">
						<div className="flex items-center gap-2 mb-4">
							<div className="h-5 w-5 rounded-full bg-yellow-500 animate-pulse" />
							<h3 className="text-lg font-semibold">
								In Progress
							</h3>
							<p className="text-sm text-muted-foreground">
								Features currently being developed
							</p>
						</div>
						{roadmapItems.inProgress.length === 0 ? (
							<Card>
								<CardContent className="py-8 text-center text-muted-foreground">
									No features in progress
								</CardContent>
							</Card>
						) : (
							<div className="grid gap-4 md:grid-cols-2">
								{roadmapItems.inProgress.map((item) => (
									<RoadmapCard key={item.id} item={item} />
								))}
							</div>
						)}
					</div>
				</TabsContent>

				<TabsContent value="completed" className="mt-6">
					<div className="space-y-4">
						<div className="flex items-center gap-2 mb-4">
							<div className="h-5 w-5 rounded-full bg-green-500" />
							<h3 className="text-lg font-semibold">Completed</h3>
							<p className="text-sm text-muted-foreground">
								Features that have been shipped
							</p>
						</div>
						{roadmapItems.completed.length === 0 ? (
							<Card>
								<CardContent className="py-8 text-center text-muted-foreground">
									No completed features yet
								</CardContent>
							</Card>
						) : (
							<div className="grid gap-4 md:grid-cols-2">
								{roadmapItems.completed.map((item) => (
									<RoadmapCard key={item.id} item={item} />
								))}
							</div>
						)}
					</div>
				</TabsContent>
			</Tabs>

			{/* Call to Action */}
			<Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 border-blue-200 dark:border-blue-800">
				<CardContent className="py-8 text-center">
					<h3 className="text-xl font-semibold mb-2">
						Have a feature request?
					</h3>
					<p className="text-muted-foreground mb-4">
						We'd love to hear your ideas! Use the feedback button to
						submit your suggestions.
					</p>
					<Button
						onClick={() => {
							// Trigger the feedback widget
							const event = new CustomEvent("openFeedback", {
								detail: { type: "feature" },
							});
							window.dispatchEvent(event);
						}}
					>
						<Lightbulb className="h-4 w-4 mr-2" />
						Submit Feature Request
					</Button>
				</CardContent>
			</Card>
		</div>
	);
}
