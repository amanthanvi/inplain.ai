import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN?.trim() || process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0"),
    profilesSampleRate: Number(process.env.SENTRY_PROFILES_SAMPLE_RATE ?? "0"),
  });
}

