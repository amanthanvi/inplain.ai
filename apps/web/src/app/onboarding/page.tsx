"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth, useUser } from "@clerk/nextjs";
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";
import { LoadingSpinner } from "@/components/LoadingSpinner";

export default function OnboardingPage() {
	const router = useRouter();
	const { userId, isLoaded: authLoaded } = useAuth();
	const { user, isLoaded: userLoaded } = useUser();
	const [checkingOnboarding, setCheckingOnboarding] = useState(true);

	useEffect(() => {
		// Redirect if user is not authenticated
		if (authLoaded && !userId) {
			router.push("/login?redirect=/onboarding");
			return;
		}

		// Check if user has already completed onboarding
		if (userLoaded && user) {
			const publicMetadata = user.publicMetadata as {
				onboarding?: { completed?: boolean };
			};
			const onboardingCompleted = publicMetadata?.onboarding?.completed;
			if (onboardingCompleted) {
				router.push("/dashboard");
			} else {
				setCheckingOnboarding(false);
			}
		}
	}, [userId, authLoaded, user, userLoaded, router]);

	if (!authLoaded || !userLoaded || checkingOnboarding) {
		return (
			<div className="min-h-screen flex items-center justify-center">
				<LoadingSpinner />
			</div>
		);
	}

	if (!userId) {
		return null; // Will redirect
	}

	return <OnboardingFlow />;
}
