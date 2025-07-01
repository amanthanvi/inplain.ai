"use client";

// Force dynamic rendering to prevent static export
export const dynamic = "force-dynamic";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle, Mail, AlertCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";

interface UnsubscribeState {
	loading: boolean;
	success: boolean;
	error: string | null;
	email: string | null;
}

const unsubscribeReasons = [
	{ id: "too-frequent", label: "Too many emails" },
	{ id: "not-relevant", label: "Content not relevant to me" },
	{ id: "never-subscribed", label: "I never subscribed to these emails" },
	{ id: "privacy-concerns", label: "Privacy concerns" },
	{ id: "technical-issues", label: "Technical issues with emails" },
	{ id: "temporary-break", label: "Taking a temporary break" },
	{ id: "other", label: "Other reason" },
];

function UnsubscribeContent() {
	const searchParams = useSearchParams();
	const token = searchParams.get("token");

	const [state, setState] = useState<UnsubscribeState>({
		loading: false,
		success: false,
		error: null,
		email: null,
	});

	const [showFeedback, setShowFeedback] = useState(false);
	const [selectedReason, setSelectedReason] = useState("");
	const [feedback, setFeedback] = useState("");
	const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

	// Auto-unsubscribe if token is present
	useEffect(() => {
		if (token && !state.success && !state.loading) {
			handleUnsubscribe();
		}
	}, [token]);

	const handleUnsubscribe = async () => {
		setState((prev) => ({ ...prev, loading: true, error: null }));

		try {
			const response = await fetch(`/api/unsubscribe?token=${token}`, {
				method: "GET",
			});

			const data = await response.json();

			if (response.ok) {
				setState((prev) => ({
					...prev,
					success: true,
					email: data.email,
					loading: false,
				}));
				setShowFeedback(true);
			} else {
				setState((prev) => ({
					...prev,
					error: data.error || "Failed to unsubscribe",
					loading: false,
				}));
			}
		} catch (error) {
			setState((prev) => ({
				...prev,
				error: "Network error. Please try again.",
				loading: false,
			}));
		}
	};

	const handleFeedbackSubmit = async () => {
		if (!selectedReason && !feedback.trim()) return;

		try {
			await fetch("/api/unsubscribe", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					token,
					reason: selectedReason,
					feedback: feedback.trim(),
				}),
			});

			setFeedbackSubmitted(true);
		} catch (error) {
			console.error("Failed to submit feedback:", error);
		}
	};

	if (state.loading) {
		return (
			<div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
				<Card className="w-full max-w-md">
					<CardContent className="pt-6">
						<div className="flex items-center justify-center space-x-2">
							<div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
							<span>Processing unsubscribe request...</span>
						</div>
					</CardContent>
				</Card>
			</div>
		);
	}

	if (state.error) {
		return (
			<div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
				<Card className="w-full max-w-md">
					<CardHeader className="text-center">
						<AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
						<CardTitle className="text-red-600">
							Unsubscribe Failed
						</CardTitle>
						<CardDescription>{state.error}</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="space-y-4">
							<p className="text-sm text-gray-600 text-center">
								If you continue to have issues, please contact
								our support team.
							</p>
							<div className="flex justify-center space-x-4">
								<Button asChild variant="outline">
									<Link href="/">
										<ArrowLeft className="h-4 w-4 mr-2" />
										Back to Home
									</Link>
								</Button>
								<Button asChild>
									<Link href="/help">Contact Support</Link>
								</Button>
							</div>
						</div>
					</CardContent>
				</Card>
			</div>
		);
	}

	if (state.success) {
		return (
			<div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
				<Card className="w-full max-w-lg">
					<CardHeader className="text-center">
						<CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
						<CardTitle className="text-green-600">
							Successfully Unsubscribed
						</CardTitle>
						<CardDescription>
							{state.email && (
								<>
									You have been unsubscribed from all
									Inplain.ai email notifications for{" "}
									<strong>{state.email}</strong>.
								</>
							)}
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-6">
						{showFeedback && !feedbackSubmitted && (
							<div className="space-y-4">
								<div>
									<Label className="text-base font-medium">
										Help us improve - why are you
										unsubscribing? (optional)
									</Label>
									<RadioGroup
										value={selectedReason}
										onValueChange={setSelectedReason}
										className="mt-3"
									>
										{unsubscribeReasons.map((reason) => (
											<div
												key={reason.id}
												className="flex items-center space-x-2"
											>
												<RadioGroupItem
													value={reason.id}
													id={reason.id}
												/>
												<Label
													htmlFor={reason.id}
													className="text-sm font-normal"
												>
													{reason.label}
												</Label>
											</div>
										))}
									</RadioGroup>
								</div>

								<div>
									<Label
										htmlFor="feedback"
										className="text-sm font-medium"
									>
										Additional feedback (optional)
									</Label>
									<Textarea
										id="feedback"
										placeholder="Tell us more about your experience or how we could improve..."
										value={feedback}
										onChange={(e) =>
											setFeedback(e.target.value)
										}
										className="mt-1"
										rows={3}
									/>
								</div>

								<Button
									onClick={handleFeedbackSubmit}
									className="w-full"
								>
									Submit Feedback
								</Button>
							</div>
						)}

						{feedbackSubmitted && (
							<div className="bg-green-50 border border-green-200 rounded-lg p-4">
								<p className="text-green-800 text-sm">
									Thank you for your feedback! It helps us
									improve Inplain.ai for everyone.
								</p>
							</div>
						)}

						<div className="border-t pt-6 space-y-4">
							<div className="text-center space-y-2">
								<h3 className="font-medium">
									What happens next?
								</h3>
								<ul className="text-sm text-gray-600 space-y-1 text-left">
									<li>
										• You will no longer receive email
										notifications from Inplain.ai
									</li>
									<li>
										• Your account and data remain active
										and accessible
									</li>
									<li>
										• You can resubscribe anytime in your
										account settings
									</li>
									<li>
										• Critical security emails may still be
										sent if required
									</li>
								</ul>
							</div>

							<div className="flex justify-center space-x-4">
								<Button asChild variant="outline">
									<Link href="/">
										<ArrowLeft className="h-4 w-4 mr-2" />
										Back to Home
									</Link>
								</Button>
								<Button asChild>
									<Link href="/settings/notifications">
										<Mail className="h-4 w-4 mr-2" />
										Manage Settings
									</Link>
								</Button>
							</div>
						</div>
					</CardContent>
				</Card>
			</div>
		);
	}

	// Manual unsubscribe form (if no token provided)
	return (
		<div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
			<Card className="w-full max-w-md">
				<CardHeader className="text-center">
					<Mail className="h-12 w-12 text-blue-500 mx-auto mb-4" />
					<CardTitle>Unsubscribe from Inplain.ai</CardTitle>
					<CardDescription>
						Enter your email address to unsubscribe from all email
						notifications
					</CardDescription>
				</CardHeader>
				<CardContent>
					<ManualUnsubscribeForm />
				</CardContent>
			</Card>
		</div>
	);
}

// Loading fallback component
function UnsubscribeLoading() {
	return (
		<div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
			<Card className="w-full max-w-md">
				<CardContent className="pt-6">
					<div className="flex items-center justify-center space-x-2">
						<div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
						<span>Loading...</span>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}

// Main export with Suspense boundary
export default function UnsubscribePage() {
	return (
		<Suspense fallback={<UnsubscribeLoading />}>
			<UnsubscribeContent />
		</Suspense>
	);
}

function ManualUnsubscribeForm() {
	const [email, setEmail] = useState("");
	const [loading, setLoading] = useState(false);
	const [success, setSuccess] = useState(false);
	const [error, setError] = useState("");

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!email.trim()) return;

		setLoading(true);
		setError("");

		try {
			const response = await fetch("/api/unsubscribe", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: email.trim() }),
			});

			const data = await response.json();

			if (response.ok) {
				setSuccess(true);
			} else {
				setError(data.error || "Failed to unsubscribe");
			}
		} catch (error) {
			setError("Network error. Please try again.");
		} finally {
			setLoading(false);
		}
	};

	if (success) {
		return (
			<div className="space-y-4">
				<div className="bg-green-50 border border-green-200 rounded-lg p-4">
					<p className="text-green-800 text-sm">
						Successfully unsubscribed! You will no longer receive
						email notifications.
					</p>
				</div>
				<Button asChild className="w-full">
					<Link href="/">Back to Home</Link>
				</Button>
			</div>
		);
	}

	return (
		<form onSubmit={handleSubmit} className="space-y-4">
			<div>
				<Label htmlFor="email">Email Address</Label>
				<input
					type="email"
					id="email"
					value={email}
					onChange={(e) => setEmail(e.target.value)}
					className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
					placeholder="your@email.com"
					required
				/>
			</div>

			{error && (
				<div className="bg-red-50 border border-red-200 rounded-lg p-3">
					<p className="text-red-800 text-sm">{error}</p>
				</div>
			)}

			<Button type="submit" disabled={loading} className="w-full">
				{loading ? "Processing..." : "Unsubscribe"}
			</Button>

			<p className="text-xs text-gray-500 text-center">
				You can resubscribe anytime by updating your notification
				preferences in your account settings.
			</p>
		</form>
	);
}
