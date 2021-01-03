import querystring from 'querystring';

import { blizzardApiResponseLatencyHistogram } from 'helpers/metrics';
import RequestTimeoutError from './request/RequestTimeoutError';
import RequestSocketTimeoutError from './request/RequestSocketTimeoutError';
import RequestConnectionResetError from './request/RequestConnectionResetError';
import RequestUnknownError from './request/RequestUnknownError';

import retryingRequest from './retryingRequest';
import RegionNotSupportedError from './RegionNotSupportedError';

const REGIONS = {
  EU: 'EU',
  US: 'US',
  TW: 'TW',
  KR: 'KR',
};

const HTTP_CODES = {
  UNAUTHORIZED: 401, // access token invalid/expired
  NOT_FOUND: 404,
};

class BlizzardApi { // TODO: extends ExternalApi that provides a generic _fetch method for third party APIs
  static localeByRegion = {
    [REGIONS.EU]: 'en_US',
    [REGIONS.US]: 'en_US',
    [REGIONS.TW]: 'zh_TW',
    [REGIONS.KR]: 'ko_KR',
  };

  async fetchGuild(regionCode, realm, nameSlug) {
    const region = this._getRegion(regionCode);
    const realmSlug = this._getRealmSlug(realm);
    return this._fetchApi(region, 'guild', `/data/wow/guild/${encodeURIComponent(realmSlug)}/${encodeURIComponent(nameSlug)}`, {
      namespace: `profile-${region}`,
    });
  }

  async fetchCharacter(regionCode, realm, name) {
    const region = this._getRegion(regionCode);
    const realmSlug = this._getRealmSlug(realm);

    return this._fetchApi(region, 'character', `/profile/wow/character/${encodeURIComponent(realmSlug)}/${encodeURIComponent(name.toLowerCase())}`, {
      namespace: `profile-${region}`,
    });
  }

  async fetchCharacterEquipment(regionCode, realm, name) {
    const region = this._getRegion(regionCode);
    const realmSlug = this._getRealmSlug(realm);

    return this._fetchApi(region, 'character-equipment', `/profile/wow/character/${encodeURIComponent(realmSlug)}/${encodeURIComponent(name.toLowerCase())}/equipment`, {
      namespace: `profile-${region}`,
    });
  }

  async fetchCharacterMedia(regionCode, realm, name) {
    const region = this._getRegion(regionCode);
    const realmSlug = this._getRealmSlug(realm);

    return this._fetchApi(region, 'character-media', `/profile/wow/character/${encodeURIComponent(realmSlug)}/${encodeURIComponent(name.toLowerCase())}/character-media`, {
      namespace: `profile-${region}`,
    });
  }

  async fetchCharacterSpecializations(regionCode, realm, name) {
    const region = this._getRegion(regionCode);
    const realmSlug = this._getRealmSlug(realm);

    return this._fetchApi(region, 'character-specializations', `/profile/wow/character/${encodeURIComponent(realmSlug)}/${encodeURIComponent(name.toLowerCase())}/specializations`, {
      namespace: `profile-${region}`,
    });
  }

  async fetchSpell(spellId) {
    return this._fetchApi('US', 'spell', `/data/wow/spell/${spellId}`, {
      namespace: 'static-us',
      locale: undefined, // without specifying one locale we get strings for all locales
    })
  }
  async fetchSpellMedia(spellId) {
    return this._fetchApi('US', 'spell', `/data/wow/media/spell/${spellId}`, {
      namespace: 'static-us',
      locale: undefined, // without specifying one locale we get strings for all locales
    })
  }

  // region Internals
  _accessTokenByRegion = {};

  _makeUrl(region, path, query = {}) {
    return `https://${region.toLowerCase()}.api.blizzard.com${path}?${querystring.stringify({
      locale: this.constructor.localeByRegion[region],
      ...query,
    })}`;
  }

  _getRealmSlug(realmName) {
    return realmName.replace(/'/g, "").replace(/\s/g, "-").toLowerCase();
  }

  _getRegion(regionCode) {
    const region = REGIONS[regionCode.toUpperCase()];

    if (!region) {
      throw new RegionNotSupportedError();
    }

    return region;
  }

  async _fetchAccessToken(region) {
    if (!this._accessTokenByRegion[region]) {
      const url = `https://${region.toLowerCase()}.battle.net/oauth/token?grant_type=client_credentials&client_id=${process.env.BATTLE_NET_API_CLIENT_ID}&client_secret=${process.env.BATTLE_NET_API_CLIENT_SECRET}`;

      const tokenRequest = await this._fetch(url, {
        category: 'token',
        region,
      });

      const tokenData = JSON.parse(tokenRequest);
      this._accessTokenByRegion[region] = tokenData.access_token;
    }

    return this._accessTokenByRegion[region];
  }

  async _fetchApi(region, operation, path, query = null) {
    const accessToken = await this._fetchAccessToken(region);
    const url = this._makeUrl(region, path, {
      access_token: accessToken,
      ...query,
    });

    const metricLabels = { category: operation, region };
    try {
      return await this._fetch(url, metricLabels);
    } catch (err) {
      if (err.statusCode === HTTP_CODES.UNAUTHORIZED) {
        delete this._accessTokenByRegion[region];
        // We can recursively call ourself because we just deleted the access token so it will just retry that and if that fails then it will actually stop instead of retrying *forever*.
        // This is unless Blizzard's API breaks and starts throwing out 401s for valid keys. Let's hope that won't happen.
        return this._fetchApi(region, endpoint, path, query);
      }
      throw err;
    }
  }

  _fetch(url, metricLabels) {
    let commitMetric;
    return retryingRequest({
      url,
      headers: {
        'User-Agent': process.env.USER_AGENT,
      },
      gzip: true,
      // we'll be making several requests, so pool connections
      forever: true,
      // ms after which to abort the request, when a character is uncached it's not uncommon to take ~2sec
      timeout: 4000,
      // The Blizzard API isn't very reliable in its HTTP codes, so we're very liberal
      shouldRetry: error => error.statusCode !== HTTP_CODES.NOT_FOUND,
      onBeforeAttempt: () => {
        commitMetric = blizzardApiResponseLatencyHistogram.startTimer(metricLabels);
      },
      onFailedAttempt: async err => {
        if (err instanceof RequestTimeoutError) {
          commitMetric({ statusCode: 'timeout' });
        } else if (err instanceof RequestSocketTimeoutError) {
          commitMetric({ statusCode: 'socket timeout' });
        } else if (err instanceof RequestConnectionResetError) {
          commitMetric({ statusCode: 'connection reset' });
        } else if (err instanceof RequestUnknownError) {
          commitMetric({ statusCode: 'unknown' });
        } else {
          commitMetric({ statusCode: err.statusCode });
        }
      },
      onSuccess: () => {
        commitMetric({ statusCode: 200 });
      },
    });
  }
  // endregion
}

export default new BlizzardApi();

export function getFactionFromType(type) {
  switch (type) {
    case "HORDE":
      return 1;
    case "ALLIANCE":
      return 2;
    default:
      return null;
  }
}

export function getCharacterGender(type) {
  switch (type) {
    case "MALE":
      return 0;
    case "FEMALE":
      return 1;
    default:
      return null;
  }
}

export function getCharacterRole(className, specName) {
  const rolesByClassAndSpec = {
    "death knight": {
      "blood": "TANK",
      "frost": "DPS",
      "unholy": "DPS",
    },
    "demon hunter": {
      "havoc": "DPS",
      "vengeance": "TANK",
    },
    "druid": {
      "balance": "DPS",
      "feral": "DPS",
      "guardian": "TANK",
      "restoration": "HEALING",
    },
    "hunter": {
      "beast mastery": "DPS",
      "marksmanship": "DPS",
      "survival": "DPS",
    },
    "mage": {
      "arcane": "DPS",
      "fire": "DPS",
      "frost": "DPS",
    },
    "monk": {
      "brewmaster": "TANK",
      "mistweaver": "HEALING",
      "windwalker": "DPS",
    },
    "paladin": {
      "holy": "HEALING",
      "protection": "TANK",
      "retribution": "DPS",
    },
    "priest": {
      "discipline": "HEALING",
      "holy": "HEALING",
      "shadow": "DPS",
    },
    "rogue": {
      "assassination": "DPS",
      "outlaw": "DPS",
      "subtlety": "DPS",
    },
    "shaman": {
      "elemental": "DPS",
      "enhancement": "DPS",
      "restoration": "HEALING",
    },
    "warlock": {
      "affliction": "DPS",
      "demonology": "DPS",
      "destruction": "DPS",
    },
    "warrior": {
      "arms": "DPS",
      "fury": "DPS",
      "protection": "TANK",
    }
  }

  return className && specName && rolesByClassAndSpec[className.toLowerCase()][specName.toLowerCase()];
}
