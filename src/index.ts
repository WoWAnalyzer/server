import Fastify from "fastify";
import * as env from "./env.ts";
import fs from "fs";
import path from "path";
import * as Sentry from "@sentry/node";

import secureSession from "@fastify/secure-session";
import passport from "@fastify/passport";
import cors from "@fastify/cors";
import replyFrom from "@fastify/reply-from";

import ads from "./route/ad.ts";
import healthcheck from "./route/healthcheck.ts";
import externalLinks from "./route/external-links.ts";
import user from "./route/user/index.ts";
import * as blizzard from "./route/blizzard";
import * as gameData from "./route/game-data";
import wcl from "./route/wcl";
import serverMetrics from "./route/metrics.ts";

env.setup();

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
  });
}

const app = Fastify({
  logger: true,
});

const SESSION_DURATION = 365 * 24 * 60 * 60;

app.register(secureSession, {
  key:
    process.env.NODE_ENV === "development"
      ? fs.readFileSync(path.join(__dirname, "../.secret-key.development"))
      : fs.readFileSync(path.join(__dirname, "../secret-key")),
  expiry: SESSION_DURATION,
  cookie: {
    path: "/",
    maxAge: SESSION_DURATION,
  },
});
app.register(cors, {
  origin: [
    /127\.0\.0\.1:[0-9]{2,5}/,
    /localhost:[0-9]{2,5}/,
    /wowanalyzer.com/,
  ],
  credentials: true,
});

app.setErrorHandler((err, _request, reply) => {
  console.error("uncaught exception", err);
  Sentry.captureException(err);
  return reply.status(500).send({
    error: err.message,
  });
});

app.register(passport.initialize());
app.register(passport.secureSession());

app.register(ads);
app.register(healthcheck);
app.register(externalLinks);
app.register(user);
app.register(blizzard.character);
app.register(blizzard.guild);
app.register(gameData.spells);
app.register(gameData.items);
app.register(wcl);
app.register(serverMetrics);

app.register(replyFrom, {
  base: process.env.SPA_PROXY_HOST,
});

app.get("/*", async (req, reply) => {
  if (req.originalUrl === "/") {
    reply.headers({
      "cache-control": "private, no-cache, no-store, must-revalidate",
      expires: "-1",
      pragma: "no-cache",
    });
  }
  return reply.from(req.originalUrl);
});

app.listen(
  { host: "0.0.0.0", port: process.env.PORT ? Number(process.env.PORT) : 3001 },
  (err) => {
    if (err) {
      console.error(err);
    } else {
      console.log(`Listening to port ${process.env.PORT}`);
    }
  },
);
