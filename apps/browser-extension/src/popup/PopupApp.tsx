import React, { useState, useEffect } from "react";
import { Settings, ExternalLink, AlertCircle, RefreshCw } from "lucide-react";
import {
	apiClient,
	type Company,
	type PrivacyScore,
	type PolicyChange,
} from "../lib/api";
import { StorageManager } from "../lib/storage";
import { cn, formatDate, getScoreColor, getScoreBgColor } from "../lib/utils";
import { SetupView } from "../components/SetupView";
import { CompanyView } from "../components/CompanyView";
import { LoadingView } from "../components/LoadingView";
import { ErrorView } from "../components/ErrorView";

type ViewState =
	| { type: "loading" }
	| { type: "setup" }
	| { type: "error"; message: string }
	| { type: "no-data"; domain: string }
	| {
			type: "company";
			data: {
				domain: string;
				company: Company;
				score: PrivacyScore | null;
				changes: PolicyChange[];
				isWatched: boolean;
			};
	  };

export function PopupApp() {
	const [viewState, setViewState] = useState<ViewState>({ type: "loading" });
	const [isRefreshing, setIsRefreshing] = useState(false);
	const storage = new StorageManager();

	useEffect(() => {
		checkCurrentSite();
	}, []);

	const checkCurrentSite = async () => {
		try {
			// Check if API key is configured
			const apiKey = await storage.getAPIKey();
			if (!apiKey) {
				setViewState({ type: "setup" });
				return;
			}

			// Get current tab domain
			const response = await chrome.runtime.sendMessage({
				type: "GET_CURRENT_DOMAIN",
			});
			if (!response.domain) {
				setViewState({
					type: "error",
					message: "Could not determine current website",
				});
				return;
			}

			const domain = response.domain;

			// Check if we have data for this domain
			const result = await chrome.runtime.sendMessage({
				type: "CHECK_PRIVACY_POLICY",
				domain,
			});

			if (!result.success) {
				setViewState({ type: "no-data", domain });
				return;
			}

			const company = result.company;

			// Fetch additional data in parallel
			const [score, changes, watchlist] = await Promise.all([
				chrome.runtime.sendMessage({
					type: "GET_PRIVACY_SCORE",
					slug: company.slug,
				}),
				chrome.runtime.sendMessage({
					type: "GET_RECENT_CHANGES",
					slug: company.slug,
					limit: 5,
				}),
				chrome.runtime.sendMessage({ type: "GET_WATCHLIST" }),
			]);

			const isWatched = watchlist.includes(company.slug);

			setViewState({
				type: "company",
				data: {
					domain,
					company,
					score,
					changes: changes || [],
					isWatched,
				},
			});
		} catch (error) {
			console.error("Failed to check current site:", error);
			setViewState({
				type: "error",
				message: "Failed to load privacy information",
			});
		}
	};

	const handleRefresh = async () => {
		setIsRefreshing(true);

		// Clear cache for current domain
		if (viewState.type === "company") {
			const domain = viewState.data.company.slug;
			await storage.clearCache(`company:${domain}`);
			await storage.clearCache(`score:${domain}`);
			await storage.clearCache(`changes:${domain}:*`);
		}

		await checkCurrentSite();
		setIsRefreshing(false);
	};

	const handleApiKeySaved = () => {
		setViewState({ type: "loading" });
		checkCurrentSite();
	};

	const handleToggleWatchlist = async () => {
		if (viewState.type !== "company") return;

		const { company, isWatched } = viewState.data;

		try {
			const success = isWatched
				? await chrome.runtime.sendMessage({
						type: "REMOVE_FROM_WATCHLIST",
						slug: company.slug,
					})
				: await chrome.runtime.sendMessage({
						type: "ADD_TO_WATCHLIST",
						slug: company.slug,
					});

			if (success) {
				setViewState({
					...viewState,
					data: {
						...viewState.data,
						isWatched: !isWatched,
					},
				});
			}
		} catch (error) {
			console.error("Failed to update watchlist:", error);
		}
	};

	const openSettings = () => {
		chrome.runtime.sendMessage({ type: "OPEN_OPTIONS" });
	};

	return (
		<div className="w-[400px] min-h-[500px] bg-background text-foreground">
			{/* Header */}
			<div className="flex items-center justify-between p-4 border-b">
				<div className="flex items-center gap-2">
					<h1 className="text-lg font-semibold">Inplain.ai</h1>
					{viewState.type === "company" && (
						<button
							onClick={handleRefresh}
							disabled={isRefreshing}
							className={cn(
								"p-1 rounded hover:bg-accent",
								isRefreshing && "animate-spin"
							)}
						>
							<RefreshCw className="w-4 h-4" />
						</button>
					)}
				</div>
				<button
					onClick={openSettings}
					className="p-1 rounded hover:bg-accent"
				>
					<Settings className="w-5 h-5" />
				</button>
			</div>

			{/* Content */}
			<div className="flex-1">
				{viewState.type === "loading" && <LoadingView />}

				{viewState.type === "setup" && (
					<SetupView onApiKeySaved={handleApiKeySaved} />
				)}

				{viewState.type === "error" && (
					<ErrorView
						message={viewState.message}
						onRetry={checkCurrentSite}
					/>
				)}

				{viewState.type === "no-data" && (
					<div className="p-6 text-center">
						<AlertCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
						<h2 className="text-lg font-semibold mb-2">
							No Privacy Data Available
						</h2>
						<p className="text-sm text-muted-foreground mb-4">
							We don't have privacy policy information for{" "}
							{viewState.domain} yet.
						</p>
						<a
							href="https://inplain.ai"
							target="_blank"
							rel="noopener noreferrer"
							className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
						>
							Visit Inplain.ai
							<ExternalLink className="w-3 h-3" />
						</a>
					</div>
				)}

				{viewState.type === "company" && (
					<CompanyView
						{...viewState.data}
						onToggleWatchlist={handleToggleWatchlist}
					/>
				)}
			</div>
		</div>
	);
}
