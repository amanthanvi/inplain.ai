"""PostHog reverse proxy service.

This exists only to expose the PostHog "Web" service via Railway's required $PORT.
The upstream PostHog template containers listen on fixed ports (8000/...), so the
Railway edge cannot connect directly.
"""
