import Fastify from "fastify";
import * as env from "./env.ts";
import fs from "fs";
import path from "path";

import secureSession from "@fastify/secure-session";
import passport from "@fastify/passport";

import ads from "./route/ad.ts";
import healthcheck from "./route/healthcheck.ts";
import user from "./route/user/index.ts";

env.setup();

const app = Fastify({
  logger: true,
});

console.log(process.env.NODE_ENV);
app.register(secureSession, {
  key:
    process.env.NODE_ENV === "development"
      ? fs.readFileSync(path.join(__dirname, "../.secret-key.development"))
      : fs.readFileSync(path.join(__dirname, "../secret-key")),
});

app.register(passport.initialize());
app.register(passport.secureSession());

app.register(ads);
app.register(healthcheck);
app.register(user);

app.listen(
  { port: process.env.PORT ? Number(process.env.PORT) : 3001 },
  (err) => {
    if (err) {
      console.error(err);
    } else {
      console.log(`Listening to port ${process.env.PORT}`);
    }
  },
);
