import { FastifyPluginCallback } from "fastify";
import passport from "@fastify/passport";

import githubStrategy, { refreshGitHubLastContribution } from "./github.ts";
import patreonStrategy, { refreshPatreonProfile } from "./patreon.ts";
import wclStrategy, { refreshWclProfile } from "./wcl.ts";
import User from "../../models/User.ts";
import { addDays, differenceInDays } from "date-fns";
import type { AnyStrategy } from "@fastify/passport/dist/strategies/index";
import { ApiError } from "../../wcl/api.ts";

declare module "fastify" {
  interface PassportUser extends User {}
}
declare module "@fastify/secure-session" {
  interface SessionData {
    returnTo: string;
  }
}

export const GITHUB_COMMIT_PREMIUM_DURATION_DAYS = 30;
// Don't refresh the 3rd party status more often than this, improving performance of this API and reducing the number of API requests to the third parties.
const PATREON_REFRESH_INTERVAL_DAYS = 7;
const GITHUB_REFRESH_INTERVAL_DAYS = 7;
const WCL_REFRESH_BEFORE_EXPIRY_DAYS = 10;

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
    passport.use(patreonStrategy as AnyStrategy);
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
  if (wclStrategy) {
    passport.use(wclStrategy);
    // TODO: This should redirect to separate WCL login page
    app.get<{ Querystring: { redirect?: string } }>(
      "/login/wcl",
      function (req, res) {
        const returnToUrl =
          req.query.redirect &&
          (req.query.redirect.startsWith("/")
            ? req.query.redirect
            : `/${req.query.redirect}`);
        req.session.set("returnTo", returnToUrl);
        passport.authenticate("wcl").call(this, req, res);
      }
    );
    app.get("/login/wcl/callback", function (req, reply) {
      passport
        .authenticate("wcl", async (_Request, _Reply, err, User) => {
          if (err || !User) {
            return reply.redirect(options.failureRedirect);
          }

          // Get return url before logging in the user or it will be lost
          const returnToUrl =
            req.session.get("returnTo") ?? options.successRedirect;

          await req.logIn(User);

          return reply.redirect(returnToUrl);
        })
        .call(this, req, reply);
    });
  } else {
    console.warn("Unable to initialize Wcl auth. Wcl login disabled");
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

    const { patreon, github, wcl } = req.user.data;

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

    if (wcl) {
      let validAuth = true;
      const isOutdated =
        differenceInDays(wcl.expiresAt, Date.now()) <=
        WCL_REFRESH_BEFORE_EXPIRY_DAYS;
      if (isOutdated) {
        const res = await refreshWclProfile(req.user);
        if (!res || res instanceof ApiError) {
          // TODO: ApiError can specify reason "Expired" or "Revoked", this could be sent to the client
          validAuth = false;
        }
      }
      response.wcl = {
        validAuth,
      };
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
