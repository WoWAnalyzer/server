import * as Sentry from '@sentry/node';

export default function configureRaven(app) {
  if (process.env.RAVEN_DSN) {
    Sentry.init({
      dsn: process.env.RAVEN_DSN,
    });
    // The Raven request handler must be the first middleware on the app
    app.use(Sentry.Handlers.requestHandler());
    // The error handler must be before any other error middleware
    app.use(Sentry.Handlers.errorHandler());
  }
  console.log(Sentry.installed)
}
