import * as env from "./env.ts";
import * as Sentry from "@sentry/node";

env.setup();

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,

    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

    // Explcitly disable sending personally identifiable information (PII) to Sentry
    sendDefaultPii: false,
  });
}
