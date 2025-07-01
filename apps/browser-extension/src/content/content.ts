// Content script for Inplain.ai browser extension
// This script runs on every webpage and can interact with the DOM

// Listen for messages from the popup or background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	if (request.type === "GET_PAGE_INFO") {
		// Extract relevant information from the current page
		const pageInfo = {
			title: document.title,
			url: window.location.href,
			hostname: window.location.hostname,
			// Look for privacy policy links
			privacyLinks: findPrivacyPolicyLinks(),
		};

		sendResponse(pageInfo);
	}

	return true; // Keep the message channel open for async response
});

function findPrivacyPolicyLinks(): string[] {
	const privacyKeywords = [
		"privacy",
		"policy",
		"privacidad",
		"datenschutz",
		"confidentialité",
		"privacidade",
		"プライバシー",
	];

	const links = Array.from(document.querySelectorAll("a"));
	const privacyLinks: string[] = [];

	links.forEach((link) => {
		const text = link.textContent?.toLowerCase() || "";
		const href = link.href?.toLowerCase() || "";

		const hasPrivacyKeyword = privacyKeywords.some(
			(keyword) => text.includes(keyword) || href.includes(keyword)
		);

		if (hasPrivacyKeyword && link.href) {
			try {
				const url = new URL(link.href);
				if (url.protocol === "http:" || url.protocol === "https:") {
					privacyLinks.push(link.href);
				}
			} catch (e) {
				// Invalid URL, skip
			}
		}
	});

	// Remove duplicates
	return [...new Set(privacyLinks)];
}

// Optional: Add visual indicators for sites with privacy concerns
function addPrivacyIndicators() {
	// This could be expanded to add visual badges or warnings
	// on sites with poor privacy scores
}

// Initialize content script
console.log("Inplain.ai content script loaded");
