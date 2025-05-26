import * as api from "../../wcl/api";
import { gql } from "graphql-request";
import User from "../../models/User";
import { addDays } from "date-fns";
import {
  Strategy as OAuth2Strategy,
  StrategyOptions,
  VerifyFunction,
} from "passport-oauth2";

const userInfoQuery = gql`
  query {
    userData {
      currentUser {
        id
        name
      }
    }
  }
`;

type WclUserInfo = {
  userData: {
    currentUser: { id: number; name: string };
  };
};

type WclProfile = {
  id: number;
  name: string;
};

async function fetchRawWclProfile(accessToken: string): Promise<WclUserInfo> {
  const response = await api.query<WclUserInfo, {}>(
    userInfoQuery,
    {},
    accessToken
  );

  return response;
}

function parseWclProfile(profile: WclUserInfo): WclProfile {
  const id = profile.userData.currentUser.id;
  const name = profile.userData.currentUser.name;
  return {
    id,
    name,
  };
}

async function fetchWclProfile(
  accessToken: string,
  refreshToken: string
): Promise<WclProfile> {
  const profile = await fetchRawWclProfile(accessToken);
  return parseWclProfile(profile);
}

class WclStrategy extends OAuth2Strategy {
  constructor(options: StrategyOptions, verify: VerifyFunction) {
    super(options, verify);
    this.name = "wcl";
  }

  userProfile(
    accessToken: string,
    done: (err?: Error | null, profile?: WclProfile) => void
  ): void {
    fetchWclProfile(accessToken, "")
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
          profile: WclProfile,
          done: (err: null, user: User) => void
        ) {
          if (process.env.NODE_ENV === "development") {
            console.log("Wcl login:", profile);
          } else {
            console.log(`Wcl login by ${profile.name} (${profile.id})`);
          }

          const [user, created] = await User.findOrCreate({
            where: { wclId: profile.id },
            defaults: {
              wclId: profile.id,
              data: {
                name: profile.name,
                wcl: {
                  accessToken: accessToken,
                  refreshToken: refreshToken,
                  expiresAt: addDays(Date.now(), 1),
                },
              },
            },
          });

          if (!created) {
            await user.update({
              data: {
                ...user.data,
                name: profile.name,
                wcl: {
                  accessToken,
                  refreshToken,
                  expiresAt: addDays(Date.now(), 1),
                },
              },
            });
          }

          done(null, user);
        }
      )
    : undefined;

export default wcl;
