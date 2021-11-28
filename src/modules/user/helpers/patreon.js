import request from 'helpers/request';

export async function fetchRawPatreonProfile(accessToken) {
  // return require('./__fixtures__/patreon-active.json');
  const jsonString = await request({
    url: 'https://api.patreon.com/oauth2/v2/identity?include=memberships&fields%5Buser%5D=full_name,image_url&fields%5Bmember%5D=patron_status,currently_entitled_amount_cents',
    headers: {
      'User-Agent': 'WoWAnalyzer.com API',
      Authorization: `Bearer ${accessToken}`,
    },
    gzip: true, // using gzip was quicker for WCL, so maybe here too
  });
  return JSON.parse(jsonString);
}
export function parseProfile(profile) {
  const id = profile.data.id;
  const name = profile.data.attributes.full_name;
  const avatar = profile.data.attributes.image_url;
  const member = profile.included && profile.included.find((item) => item.type === 'member');
  const pledgeAmount =
    member && member.attributes.patron_status === 'active_patron'
      ? member.attributes.currently_entitled_amount_cents
      : null;

  return {
    id,
    name,
    avatar,
    pledgeAmount,
  };
}
export async function fetchPatreonProfile(accessToken, refreshToken) {
  // TODO: Handle refreshToken https://www.patreondevelopers.com/t/how-can-i-refresh-an-oauth2-token-do-i-need-to-wait-for-the-token-to-expire-patreon-api/615/2
  const patreonProfile = await fetchRawPatreonProfile(accessToken);
  return parseProfile(patreonProfile);
}
export async function refreshPatreonProfile(user) {
  console.log(`Refreshing Patreon data for ${user.data.name} (${user.patreonId})`);
  const patreonProfile = await fetchPatreonProfile(user.data.patreon.accessToken);

  // We shouldn't have to wait for this update to finish, since it immediately updates the local object's data
  user.update({
    data: {
      ...user.data,
      name: patreonProfile.name,
      avatar: patreonProfile.avatar,
      patreon: {
        ...user.data.patreon,
        pledgeAmount: patreonProfile.pledgeAmount,
        updatedAt: new Date(),
      },
    },
  });
}
