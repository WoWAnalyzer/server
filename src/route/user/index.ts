import { FastifyPluginCallback } from "fastify";
import passport from "@fastify/passport";

import githubStrategy, { refreshGitHubLastContribution } from "./github.ts";
import patreonStrategy, { refreshPatreonProfile } from "./patreon.ts";
import User from "../../models/User.ts";
import { addDays, differenceInDays } from "date-fns";

declare module "fastify" {
  interface PassportUser extends User {}
}

export const GITHUB_COMMIT_PREMIUM_DURATION_DAYS = 30;
// Don't refresh the 3rd party status more often than this, improving performance of this API and reducing the number of API requests to the third parties.
const PATREON_REFRESH_INTERVAL_DAYS = 7;
const GITHUB_REFRESH_INTERVAL_DAYS = 7;

function hasGitHubPremium({ data: { github } }: User): boolean {
  return github && github.lastContribution
    ? differenceInDays(Date.now(), github.lastContribution) <
        GITHUB_COMMIT_PREMIUM_DURATION_DAYS
    : false;
}

function hasPatreonPremium({ data: { patreon } }: User): boolean {
  return Boolean(patreon && (patreon.pledgeAmount ?? 0) >= 100);
}

const user: FastifyPluginCallback = (app, _, done) => {
  const loginRedirect = process.env.LOGIN_REDIRECT_LOCATION;
  if (!loginRedirect) {
    console.warn("no login redirect set. login/logout will be unavailable.");
    done();
    return;
  }

  passport.registerUserSerializer(async (user: User) => user.id);
  passport.registerUserDeserializer(async (id: number) => {
    return await User.findByPk(id);
  });

  const options = {
    successRedirect: loginRedirect,
    failureRedirect: loginRedirect,
  };

  if (patreonStrategy) {
    passport.use(patreonStrategy);
    app.get("/login/patreon", passport.authenticate("patreon"));
    app.get(
      "/login/patreon/callback",
      passport.authenticate("patreon", options),
    );
  } else {
    console.warn("Unable to initialize Patreon auth. Patreon login disabled");
  }
  if (githubStrategy) {
    passport.use(githubStrategy);
    app.get("/login/github", passport.authenticate("github"));
    app.get("/login/github/callback", passport.authenticate("github", options));
  } else {
    console.warn("Unable to initialize Github auth. Github login disabled");
  }

  // note that the frontend makes a GET for logouts
  app.get("/logout", (req, reply) => {
    req.logOut();
    return reply.send(true);
  });

  app.get("/user", async (req, reply) => {
    if (!req.user) {
      return reply.status(403).send();
    }

    const response: Record<string, unknown> = {
      name: req.user.data.name,
      avatar: req.user.data.avatar,
      premium: false,
    };

    const { patreon, github } = req.user.data;

    if (patreon) {
      const isOutdated =
        differenceInDays(Date.now(), patreon.updatedAt) >=
        PATREON_REFRESH_INTERVAL_DAYS;
      if (isOutdated) {
        await refreshPatreonProfile(req.user);
      }
    }

    if (github) {
      const isOutdated =
        differenceInDays(Date.now(), github.updatedAt) >=
        GITHUB_REFRESH_INTERVAL_DAYS;
      if (isOutdated) {
        await refreshGitHubLastContribution(req.user);
      }
    }

    if (hasPatreonPremium(req.user)) {
      response.premium = true;
      response.patreon = {
        premium: true,
      };
    }
    if (hasGitHubPremium(req.user)) {
      response.premium = true;
      response.github = {
        premium: true,
        expires: addDays(
          github?.lastContribution ?? 0,
          GITHUB_COMMIT_PREMIUM_DURATION_DAYS,
        ),
      };
    }

    return reply.send(response);
  });
  done();
};

export default user;
