import * as Sentry from '@sentry/node';

export default function configureSentry(app) {
  if (process.env.SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
    });
    // The Sentry request handler must be the first middleware on the app
    // app.use(Sentry.Handlers.requestHandler());
    // The error handler must be before any other error middleware
    // app.use(Sentry.Handlers.errorHandler());
  }
}
