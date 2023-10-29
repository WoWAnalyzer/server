import axios, { AxiosError } from "axios";
enum Region {
  EU = "EU",
  US = "US",
  TW = "TW",
  KR = "KR",
}

function isSupportedRegion(value: string): value is Region {
  return Object.values(Region).includes(value as Region);
}

const accessTokenByRegion: Partial<Record<Region, string>> = {};

const HTTP_CODES = {
  UNAUTHORIZED: 401, // access token invalid/expired
  NOT_FOUND: 404,
};

const localeByRegion: Record<Region, string> = {
  [Region.EU]: "en_US",
  [Region.US]: "en_US",
  [Region.TW]: "zh_TW",
  [Region.KR]: "ko_KR",
};

export async function fetchGuild(
  region: Region,
  realm: string,
  nameSlug: string,
): Promise<unknown> {
  const realmSlug = getRealmSlug(realm);
  return fetchApi(
    region,
    "guild",
    `/data/wow/guild/${encodeURIComponent(realmSlug)}/${encodeURIComponent(
      nameSlug,
    )}`,
    {
      namespace: `profile-${region}`,
    },
  );
}

type BaseCharacterData = {
  id: string;
  name: string;
  realm?: { name: string };
  faction: { type: string };
  character_class?: { id: number; name: string };
  race?: { id: number };
  gender?: string;
  achievement_points: number;
};

export async function fetchCharacterData<T = BaseCharacterData>(
  region: string,
  realm: string,
  name: string,
  subset?: string,
): Promise<T | undefined> {
  const realmSlug = getRealmSlug(realm);

  let url = `/profile/wow/character/${encodeURIComponent(
    realmSlug,
  )}/${encodeURIComponent(name.toLowerCase())}`;

  if (subset) {
    url += "/" + subset;
  }

  return fetchApi<T>(region, "character", url, {
    namespace: `profile-${region}`,
  });
}

/**
 * Blizzard does not expose an Armory for Classic characters, but they expose structured data from the forum about the character, including a thumbnail (which is what we mostly care about).
 *
 * This approach is taken from the method that WCL uses for claiming characters and collecting thumbnails for Classic.
 */
export async function fetchClassicCharacter(
  region: string,
  realm: string,
  name: string,
): Promise<unknown> {
  if (!isSupportedRegion(region)) {
    return undefined;
  }

  const realmSlug = getRealmSlug(realm);
  const encodedUrl =
    `https://${region.toLowerCase()}.forums.blizzard.com/en/wow/u/` +
    encodeURIComponent(name) +
    `-${realmSlug}.json`;

  return axios.get(encodedUrl);
}

type CharacterDataSubsetFn<T = unknown> = (
  regionCode: string,
  realm: string,
  name: string,
) => Promise<T | undefined>;

export const fetchCharacterEquipment: CharacterDataSubsetFn = (...args) =>
  fetchCharacterData(...args, "equipment");

type MediaData = {
  avatar_url?: string;
  assets?: Array<{ key: string; value: string }>;
};

export const fetchCharacterMedia: CharacterDataSubsetFn<MediaData> = (
  ...args
) => fetchCharacterData(...args, "character-media");

type Spec = {
  name: string;
};

type Talent = {
  id: number;
  rank: number;
};

type Loadout = {
  is_active: boolean;
  talent_loadout_code: string;
  selected_class_talents: Talent[];
  selected_spec_talents: Talent[];
};

type SpecData = {
  active_specialization?: Spec;
  specializations?: Array<{
    specialization: Spec;
    loadouts?: Loadout[];
  }>;
};

export const fetchCharacterSpecializations: CharacterDataSubsetFn<SpecData> = (
  ...args
) => fetchCharacterData(...args, "specializations");

export async function fetchSpell(spellId: number) {
  return fetchApi("US", "spell", `/data/wow/spell/${spellId}`, {
    namespace: "static-us",
    locale: undefined, // without specifying one locale we get strings for all locales
  });
}
export async function fetchSpellMedia(spellId: number) {
  return fetchApi("US", "spell", `/data/wow/media/spell/${spellId}`, {
    namespace: "static-us",
    locale: undefined, // without specifying one locale we get strings for all locales
  });
}

export async function fetchItem(id: number, region = Region.US) {
  return fetchApi(region, "item", `/data/wow/item/${encodeURIComponent(id)}`, {
    namespace: `static-${region}`,
    locale: undefined, // without specifying one locale we get strings for all locales
  });
}

export async function fetchItemMedia(id: number, region = Region.US) {
  return fetchApi(
    region,
    "item",
    `/data/wow/media/item/${encodeURIComponent(id)}`,
    {
      namespace: `static-${region}`,
      locale: undefined, // without specifying one locale we get strings for all locales
    },
  );
}

function makeUrl(region: Region, path: string, query = {}): string {
  return `https://${region.toLowerCase()}.api.blizzard.com${path}?${new URLSearchParams(
    {
      locale: localeByRegion[region],
      ...query,
    },
  ).toString()}`;
}

function getRealmSlug(realmName: string): string {
  return realmName.replace(/'/g, "").replace(/\s/g, "-").toLowerCase();
}

async function fetchAccessToken(region: Region): Promise<string> {
  if (!accessTokenByRegion[region]) {
    const url = `https://${region.toLowerCase()}.battle.net/oauth/token?client_id=${
      process.env.BATTLE_NET_API_CLIENT_ID
    }&client_secret=${process.env.BATTLE_NET_API_CLIENT_SECRET}`;

    const tokenRequest = await axios.postForm(url, {
      grant_type: "client_credentials",
    });
    const tokenData = tokenRequest.data;

    accessTokenByRegion[region] = tokenData.access_token;
  }

  return accessTokenByRegion[region]!;
}

async function fetchApi<T>(
  region: string,
  operation: string,
  path: string,
  query?: Record<string, string | undefined>,
  noRetry = false,
): Promise<T | undefined> {
  if (!isSupportedRegion(region)) {
    return undefined;
  }
  const accessToken = await fetchAccessToken(region);
  const url = makeUrl(region, path, {
    access_token: accessToken,
    ...query,
  });

  try {
    return (await axios.get(url))?.data;
  } catch (err: unknown) {
    if (
      err instanceof AxiosError &&
      err.response?.status === HTTP_CODES.UNAUTHORIZED
    ) {
      delete accessTokenByRegion[region];
      if (!noRetry) {
        return fetchApi(region, operation, path, query, true);
      } else {
        throw err;
      }
    }
    throw err;
  }
}

export function getFactionFromRace(race: string): number | null {
  switch (race) {
    case "Blood Elf":
      return 1;
    case "Orc":
      return 1;
    case "Tauren":
      return 1;
    case "Troll":
      return 1;
    case "Undead":
      return 1;
    case "Draenei":
      return 2;
    case "Dwarf":
      return 2;
    case "Gnome":
      return 2;
    case "Human":
      return 2;
    case "Night Elf":
      return 2;
    default:
      return null;
  }
}

export function getFactionFromType(type: string): number | null {
  switch (type) {
    case "HORDE":
      return 1;
    case "ALLIANCE":
      return 2;
    default:
      return null;
  }
}

export function getCharacterGender(type: string): number | null {
  switch (type) {
    case "MALE":
      return 0;
    case "FEMALE":
      return 1;
    default:
      return null;
  }
}

const rolesByClassAndSpec: Record<string, Record<string, string>> = {
  "death knight": {
    blood: "TANK",
    frost: "DPS",
    unholy: "DPS",
  },
  "demon hunter": {
    havoc: "DPS",
    vengeance: "TANK",
  },
  druid: {
    balance: "DPS",
    feral: "DPS",
    guardian: "TANK",
    restoration: "HEALING",
  },
  hunter: {
    "beast mastery": "DPS",
    marksmanship: "DPS",
    survival: "DPS",
  },
  mage: {
    arcane: "DPS",
    fire: "DPS",
    frost: "DPS",
  },
  monk: {
    brewmaster: "TANK",
    mistweaver: "HEALING",
    windwalker: "DPS",
  },
  paladin: {
    holy: "HEALING",
    protection: "TANK",
    retribution: "DPS",
  },
  priest: {
    discipline: "HEALING",
    holy: "HEALING",
    shadow: "DPS",
  },
  rogue: {
    assassination: "DPS",
    outlaw: "DPS",
    subtlety: "DPS",
  },
  shaman: {
    elemental: "DPS",
    enhancement: "DPS",
    restoration: "HEALING",
  },
  warlock: {
    affliction: "DPS",
    demonology: "DPS",
    destruction: "DPS",
  },
  warrior: {
    arms: "DPS",
    fury: "DPS",
    protection: "TANK",
  },
  evoker: {
    devastation: "DPS",
    preservation: "HEALING",
  },
};

export function getCharacterRole(
  className: string | undefined,
  specName: string | undefined,
): string | undefined {
  return (
    className &&
    specName &&
    rolesByClassAndSpec[className.toLowerCase()][specName.toLowerCase()]
  );
}
