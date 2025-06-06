import * as api from "../../wcl/api";
import { gql } from "graphql-request";
import User from "../../models/User";
import {
  Strategy as OAuth2Strategy,
  StrategyOptions,
  VerifyFunction,
} from "passport-oauth2";
import * as cache from "../../cache.ts";
import * as Sentry from "@sentry/node";
import * as crypto from "node:crypto";
import axios, { AxiosError } from "axios";
import { ApiError, ApiErrorType } from "../../wcl/api";
import { FastifyRequest } from "fastify";

export const currentUserQuery = gql`
  query {
    userData {
      currentUser {
        id
      }
    }
  }
`;

const userQuery = gql`
  query getUser($id: Int!) {
    userData {
      user(id: $id) {
        id
        avatar
        name
      }
    }
  }
`;

type CurrentUserData = {
  userData: {
    currentUser: { id: number };
  };
};

type UserData = {
  userData: {
    user: { id: number; avatar: string; name: string };
  };
};

type WclTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
};

type WclRefreshTokenResponse = WclTokenResponse & {
  refresh_token: string;
};

type WclProfile = {
  id: number;
  name: string;
  avatar: string;
};

async function fetchWclCurrentUserId(accessToken: string): Promise<number> {
  const response = await api.query<CurrentUserData, {}>(
    currentUserQuery,
    {},
    {
      accessToken,
    },
  );

  return response.userData.currentUser.id;
}

async function fetchRawWclProfile(
  accessToken: string,
  id?: number | null,
): Promise<UserData> {
  id = id ?? (await fetchWclCurrentUserId(accessToken));
  const response = await api.query<UserData, {}>(
    userQuery,
    {
      id,
    },
    {
      accessToken,
    },
  );

  return response;
}

function parseWclProfile(profile: UserData): WclProfile {
  const id = profile.userData.user.id;
  const name = profile.userData.user.name;
  const avatar = profile.userData.user.avatar;
  return {
    id,
    name,
    avatar,
  };
}

async function fetchWclProfile(
  accessToken: string,
  id?: number | null,
): Promise<WclProfile> {
  const profile = await fetchRawWclProfile(accessToken, id);
  return parseWclProfile(profile);
}

async function refreshToken(
  refreshToken: string,
): Promise<WclRefreshTokenResponse | undefined> {
  const basicAuth = Buffer.from(
    `${process.env.WCL_CLIENT_ID}:${process.env.WCL_CLIENT_SECRET}`,
  ).toString("base64");

  try {
    const response = await axios.postForm(
      `https://www.${process.env.WCL_PRIMARY_DOMAIN}/oauth/token`,
      {
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      },
      {
        headers: {
          Accept: "application/json",
          Authorization: `Basic ${basicAuth}`,
        },
      },
    );

    if (!response.data.refresh_token) {
      throw new Error("Missing refresh token");
    }

    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      switch (error.response?.data.hint) {
        case "Token has been revoked":
        case "Authorization code has been revoked":
          throw new ApiError(error, ApiErrorType.TokenRevoked);
        case "Token has expired":
          throw new ApiError(error, ApiErrorType.TokenExpired);
      }
    }
    throw new ApiError(error as Error, ApiErrorType.Unknown);
  }
}

/** Try to refresh the WCL profile & token for a user
 * @returns true if the profile was refreshed, false or an error if something went wrong */
export async function refreshWclProfile(
  user: User,
): Promise<boolean | api.ApiError> {
  console.log(`Refreshing Wcl data for ${user.data.name} (${user.wclId})`);
  if (!user.data.wcl) {
    return false;
  }

  let tokenResponse;
  try {
    tokenResponse = await refreshToken(user.data.wcl.refreshToken);
  } catch (error) {
    await cache.set(
      await userRefreshTokenKey(user.data.wcl.refreshToken),
      null,
    );
    if (error instanceof ApiError) {
      return error;
    }
    return false;
  }

  if (!tokenResponse) {
    await cache.set(
      await userRefreshTokenKey(user.data.wcl.refreshToken),
      null,
    );
    return false;
  }

  const wclProfile = await fetchWclProfile(
    tokenResponse.access_token,
    user.wclId,
  );

  await cache
    .set(
      await userRefreshTokenKey(tokenResponse.refresh_token),
      tokenResponse.access_token,
    )
    .catch(Sentry.captureException);

  await user.update({
    data: {
      ...user.data,
      name: wclProfile.name,
      avatar: wclProfile.avatar,
      wcl: {
        refreshToken: tokenResponse.refresh_token,
        expiresAt: Date.now() + tokenResponse.expires_in * 1000,
      },
    },
  });

  return true;
}

export async function userRefreshTokenKey(refreshToken: string) {
  const hasher = crypto.createHash("sha256");
  hasher.update(refreshToken);
  return `wcl-token-${hasher.digest("hex")}`;
}

class WclStrategy extends OAuth2Strategy {
  constructor(options: StrategyOptions, verify: VerifyFunction) {
    super(options, verify);
    this.name = "wcl";
  }

  // this override has an awkward type because it is written for express and uses the express request type (just named `Request`)
  authenticate(...[req, options]: Parameters<OAuth2Strategy["authenticate"]>) {
    // this call forces the session data to be resent to the client, which prevents the client from getting stuck
    // with an old value for `state` if you exit the flow early / abnormally
    (req as unknown as FastifyRequest).session.touch();
    super.authenticate(req, options);
  }

  userProfile(
    accessToken: string,
    done: (err?: Error | null, profile?: WclProfile) => void,
  ): void {
    fetchWclProfile(accessToken)
      .then((profile) => done(null, profile))
      .catch((err) => done(err));
  }
}

const wcl =
  process.env.WCL_CLIENT_ID &&
  process.env.WCL_CLIENT_SECRET &&
  process.env.WCL_REDIRECT_URL
    ? new WclStrategy(
        {
          authorizationURL: `https://www.${process.env.WCL_PRIMARY_DOMAIN}/oauth/authorize`,
          tokenURL: `https://www.${process.env.WCL_PRIMARY_DOMAIN}/oauth/token`,
          clientID: process.env.WCL_CLIENT_ID,
          clientSecret: process.env.WCL_CLIENT_SECRET,
          callbackURL: process.env.WCL_REDIRECT_URL,
          state: true,
          skipUserProfile: false,
        },
        async function (
          accessToken: string,
          refreshToken: string,
          params: WclTokenResponse,
          profile: WclProfile,
          done: (err: null, user: User) => void,
        ) {
          if (process.env.NODE_ENV === "development") {
            console.log("Wcl login:", profile);
          } else {
            console.log(`Wcl login by ${profile.name} (${profile.id})`);
          }

          await cache
            .set(await userRefreshTokenKey(refreshToken), accessToken)
            .catch(Sentry.captureException);

          const [user, created] = await User.findOrCreate({
            where: { wclId: profile.id },
            defaults: {
              wclId: profile.id,
              data: {
                name: profile.name,
                avatar: profile.avatar,
                wcl: {
                  refreshToken: refreshToken,
                  expiresAt: Date.now() + params.expires_in * 1000,
                },
              },
            },
          });

          if (!created) {
            await user.update({
              data: {
                ...user.data,
                name: profile.name,
                avatar: profile.avatar,
                wcl: {
                  refreshToken,
                  expiresAt: Date.now() + params.expires_in * 1000,
                },
              },
            });
          }

          done(null, user);
        },
      )
    : undefined;

export default wcl;
