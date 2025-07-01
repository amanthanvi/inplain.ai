import React, { useState, useEffect } from "react";
import {
	Save,
	Key,
	Bell,
	Moon,
	RefreshCw,
	Trash2,
	ExternalLink,
} from "lucide-react";
import { StorageManager } from "../lib/storage";
import { cn } from "../lib/utils";

export function OptionsApp() {
	const [apiKey, setApiKey] = useState("");
	const [showApiKey, setShowApiKey] = useState(false);
	const [settings, setSettings] = useState({
		notifications: true,
		darkMode: false,
		autoCheck: true,
	});
	const [isSaving, setIsSaving] = useState(false);
	const [saveMessage, setSaveMessage] = useState("");

	const storage = new StorageManager();

	useEffect(() => {
		loadSettings();
	}, []);

	const loadSettings = async () => {
		const [savedApiKey, savedSettings] = await Promise.all([
			storage.getAPIKey(),
			storage.getSettings(),
		]);

		if (savedApiKey) {
			setApiKey(savedApiKey);
		}

		setSettings(savedSettings);
	};

	const handleSave = async () => {
		setIsSaving(true);
		setSaveMessage("");

		try {
			await Promise.all([
				storage.setAPIKey(apiKey),
				storage.updateSettings(settings),
			]);

			setSaveMessage("Settings saved successfully!");
			setTimeout(() => setSaveMessage(""), 3000);
		} catch (error) {
			setSaveMessage("Failed to save settings. Please try again.");
		} finally {
			setIsSaving(false);
		}
	};

	const handleClearCache = async () => {
		if (confirm("Are you sure you want to clear all cached data?")) {
			await storage.clearCache();
			setSaveMessage("Cache cleared successfully!");
			setTimeout(() => setSaveMessage(""), 3000);
		}
	};

	const handleToggleSetting = (key: keyof typeof settings) => {
		setSettings((prev) => ({
			...prev,
			[key]: !prev[key],
		}));
	};

	return (
		<div
			className={cn(
				"min-h-screen bg-background text-foreground",
				settings.darkMode && "dark"
			)}
		>
			<div className="max-w-2xl mx-auto p-8">
				{/* Header */}
				<div className="mb-8">
					<h1 className="text-3xl font-bold mb-2">
						Inplain.ai Settings
					</h1>
					<p className="text-muted-foreground">
						Configure your privacy monitoring preferences
					</p>
				</div>

				{/* API Key Section */}
				<section className="mb-8 p-6 bg-card rounded-lg border">
					<div className="flex items-center gap-3 mb-4">
						<Key className="w-5 h-5 text-primary" />
						<h2 className="text-xl font-semibold">
							API Configuration
						</h2>
					</div>

					<div className="space-y-4">
						<div>
							<label
								htmlFor="apiKey"
								className="block text-sm font-medium mb-2"
							>
								API Key
							</label>
							<div className="relative">
								<input
									id="apiKey"
									type={showApiKey ? "text" : "password"}
									value={apiKey}
									onChange={(e) => setApiKey(e.target.value)}
									placeholder="Enter your API key"
									className="w-full px-3 py-2 pr-20 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
								/>
								<button
									onClick={() => setShowApiKey(!showApiKey)}
									className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1 text-sm text-muted-foreground hover:text-foreground"
								>
									{showApiKey ? "Hide" : "Show"}
								</button>
							</div>
							<p className="mt-2 text-sm text-muted-foreground">
								Your API key is used to authenticate requests to
								Inplain.ai
							</p>
						</div>

						<div>
							<a
								href="https://inplain.ai/settings"
								target="_blank"
								rel="noopener noreferrer"
								className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
							>
								Get your API key from Inplain.ai
								<ExternalLink className="w-3 h-3" />
							</a>
						</div>
					</div>
				</section>

				{/* Preferences Section */}
				<section className="mb-8 p-6 bg-card rounded-lg border">
					<h2 className="text-xl font-semibold mb-4">Preferences</h2>

					<div className="space-y-4">
						{/* Notifications */}
						<div className="flex items-center justify-between p-4 rounded-md bg-secondary">
							<div className="flex items-center gap-3">
								<Bell className="w-5 h-5 text-muted-foreground" />
								<div>
									<p className="font-medium">Notifications</p>
									<p className="text-sm text-muted-foreground">
										Get notified about privacy policy
										changes
									</p>
								</div>
							</div>
							<button
								onClick={() =>
									handleToggleSetting("notifications")
								}
								className={cn(
									"relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
									settings.notifications
										? "bg-primary"
										: "bg-input"
								)}
							>
								<span
									className={cn(
										"inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
										settings.notifications
											? "translate-x-6"
											: "translate-x-1"
									)}
								/>
							</button>
						</div>

						{/* Dark Mode */}
						<div className="flex items-center justify-between p-4 rounded-md bg-secondary">
							<div className="flex items-center gap-3">
								<Moon className="w-5 h-5 text-muted-foreground" />
								<div>
									<p className="font-medium">Dark Mode</p>
									<p className="text-sm text-muted-foreground">
										Use dark theme for the extension
									</p>
								</div>
							</div>
							<button
								onClick={() => handleToggleSetting("darkMode")}
								className={cn(
									"relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
									settings.darkMode
										? "bg-primary"
										: "bg-input"
								)}
							>
								<span
									className={cn(
										"inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
										settings.darkMode
											? "translate-x-6"
											: "translate-x-1"
									)}
								/>
							</button>
						</div>

						{/* Auto Check */}
						<div className="flex items-center justify-between p-4 rounded-md bg-secondary">
							<div className="flex items-center gap-3">
								<RefreshCw className="w-5 h-5 text-muted-foreground" />
								<div>
									<p className="font-medium">
										Automatic Checks
									</p>
									<p className="text-sm text-muted-foreground">
										Periodically check for policy updates
									</p>
								</div>
							</div>
							<button
								onClick={() => handleToggleSetting("autoCheck")}
								className={cn(
									"relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
									settings.autoCheck
										? "bg-primary"
										: "bg-input"
								)}
							>
								<span
									className={cn(
										"inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
										settings.autoCheck
											? "translate-x-6"
											: "translate-x-1"
									)}
								/>
							</button>
						</div>
					</div>
				</section>

				{/* Data Management Section */}
				<section className="mb-8 p-6 bg-card rounded-lg border">
					<h2 className="text-xl font-semibold mb-4">
						Data Management
					</h2>

					<div className="space-y-4">
						<button
							onClick={handleClearCache}
							className="flex items-center gap-3 w-full p-4 rounded-md bg-secondary hover:bg-secondary/80 transition-colors text-left"
						>
							<Trash2 className="w-5 h-5 text-muted-foreground" />
							<div>
								<p className="font-medium">Clear Cache</p>
								<p className="text-sm text-muted-foreground">
									Remove all cached privacy data
								</p>
							</div>
						</button>
					</div>
				</section>

				{/* Save Button and Message */}
				<div className="flex items-center justify-between">
					<button
						onClick={handleSave}
						disabled={isSaving}
						className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
					>
						<Save className="w-4 h-4" />
						{isSaving ? "Saving..." : "Save Settings"}
					</button>

					{saveMessage && (
						<p
							className={cn(
								"text-sm",
								saveMessage.includes("success")
									? "text-green-600"
									: "text-destructive"
							)}
						>
							{saveMessage}
						</p>
					)}
				</div>
			</div>
		</div>
	);
}
