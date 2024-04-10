import axios from "axios";
import { Strategy as PatreonStrategy } from "passport-patreon";
import User from "../../models/User";

type PatreonProfile = {
  data: {
    id: number;
    attributes: {
      full_name: string;
      image_url: string;
    };
  };
  included?: Array<{
    type: string;
    attributes: Record<string, unknown>;
  }>;
};

export async function fetchRawPatreonProfile(
  accessToken: string,
): Promise<PatreonProfile> {
  // return require('./__fixtures__/patreon-active.json');
  const response = await axios.get(
    "https://api.patreon.com/oauth2/v2/identity?include=memberships&fields%5Buser%5D=full_name,image_url&fields%5Bmember%5D=patron_status,currently_entitled_amount_cents",
    {
      headers: {
        "User-Agent": "WoWAnalyzer.com API",
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  return response.data;
}

export function parseProfile(profile: PatreonProfile) {
  const id = profile.data.id;
  const name = profile.data.attributes.full_name;
  const avatar = profile.data.attributes.image_url;
  const member =
    profile.included && profile.included.find((item) => item.type === "member");
  const pledgeAmount: number | null =
    member && member.attributes.patron_status === "active_patron"
      ? (member.attributes.currently_entitled_amount_cents as number)
      : null;

  return {
    id,
    name,
    avatar,
    pledgeAmount,
  };
}

async function fetchPatreonProfile(accessToken: string, refreshToken: string) {
  // TODO: Handle refreshToken https://www.patreondevelopers.com/t/how-can-i-refresh-an-oauth2-token-do-i-need-to-wait-for-the-token-to-expire-patreon-api/615/2
  const patreonProfile = await fetchRawPatreonProfile(accessToken);
  return parseProfile(patreonProfile);
}

export async function refreshPatreonProfile(user: User) {
  console.log(
    `Refreshing Patreon data for ${user.data.name} (${user.patreonId})`,
  );
  if (!user.data.patreon) {
    return;
  }
  const patreonProfile = await fetchPatreonProfile(
    user.data.patreon.accessToken,
    user.data.patreon.refreshToken,
  );

  // We shouldn't have to wait for this update to finish, since it immediately updates the local object's data
  user.update({
    data: {
      ...user.data,
      name: patreonProfile.name,
      avatar: patreonProfile.avatar,
      patreon: {
        ...user.data.patreon,
        pledgeAmount: patreonProfile.pledgeAmount,
        updatedAt: Date.now(),
      },
    },
  });
}

const patreon =
  process.env.PATREON_CLIENT_ID && process.env.PATREON_CLIENT_SECRET
    ? new PatreonStrategy(
        {
          clientID: process.env.PATREON_CLIENT_ID,
          clientSecret: process.env.PATREON_CLIENT_SECRET,
          callbackURL: process.env.PATREON_CALLBACK_URL,
          scope: "identity",
          skipUserProfile: true, // less unnecessary and duplicate code if we manually do this the same everywhere
        },
        async function (
          accessToken: string,
          refreshToken: string,
          _: unknown,
          done: (err: null, user: User) => void,
        ) {
          const patreonProfile = await fetchPatreonProfile(
            accessToken,
            refreshToken,
          );

          if (process.env.NODE_ENV === "development") {
            console.log("Patreon login:", patreonProfile);
          } else {
            console.log(
              `Patreon login by ${patreonProfile.name} (${patreonProfile.id})`,
            );
          }

          const user = await User.create({
            patreonId: patreonProfile.id,
            data: {
              name: patreonProfile.name,
              avatar: patreonProfile.avatar,
              patreon: {
                pledgeAmount: patreonProfile.pledgeAmount,
                updatedAt: Date.now(),
                accessToken,
                refreshToken,
              },
            },
          });

          done(null, user);
        },
      )
    : undefined;

export default patreon;
