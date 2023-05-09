import Express from 'express';
import { Sequelize, Op } from 'sequelize';
import * as Sentry from '@sentry/node';
import { StatusCodeError } from 'request-promise-native/errors';

import BlizzardApi, { getFactionFromRace, getFactionFromType, getCharacterGender, getCharacterRole } from 'helpers/BlizzardApi';
import RegionNotSupportedError from 'helpers/RegionNotSupportedError';

import models from '../../models';

const Character = models.Character;

/**
 * Handle requests for character information, and return data from the Blizzard API or Blizzard Forum (Classic).
 *
 * This takes 3 formats since at different points of the app we know different types of data:
 *
 * When we are in a Warcraft Logs report that was exported for rankings, we have a character id and the region, realm and name of the character. In that case we call:
 * /140165460/EU/Tarren Mill/Mufre - exported fights
 * This will create a new character with all that data so it can be discovered if we only have partial data. It will then send the battle.net character data.
 *
 * When we are in a Warcraft Logs report that hasn't been exported yet (this primarily happens during prime time where the WCL export queue is slow), we only have a character id. We try to fetch the character info in the hopes that it was stored in the past:
 * /140165460 - unexported fights
 * This will look for the character data by the character id. If it doesn't exist then return 404. If it does exist it will send the battle.net character data.
 *
 * The final option is when the user enters his region, realm and name in the character search box. Then we don't have the character id and call:
 * /EU/Tarren Mill/Mufre - character search
 * This will skip looking for the character and just send the battle.net character data.
 *
 * The caching strategy being used here is to always return cached data first if it exists. then refresh in the background
 */
function sendJson(res, json) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.send(json);
}
function send404(res) {
  res.sendStatus(404);
}

const characterIdFromThumbnailRegex = /\/([0-9]+)-/;
function getCharacterId(thumbnail) {
  const [,characterId] = characterIdFromThumbnailRegex.exec(thumbnail);
  return characterId;
}

async function getCharacterFromBlizzardApi(region, realm, name) {
  const characterResponse = await BlizzardApi.fetchCharacter(region, realm, name);
  const characterData = JSON.parse(characterResponse);
  if (!characterData) {
    throw new Error('Invalid character response received');
  }

  const characterEquipmentResponse = await BlizzardApi.fetchCharacterEquipment(region, realm, name);
  const characterEquipmentData = JSON.parse(characterEquipmentResponse);
  if (!characterEquipmentData) {
    throw new Error('Invalid character equipment response received');
  }

  const characterMediaResponse = await BlizzardApi.fetchCharacterMedia(region, realm, name);
  const characterMediaData = JSON.parse(characterMediaResponse);
  if (!characterMediaData) {
    throw new Error('Invalid character media response received');
  }
  const thumbnailAsset = characterMediaData.avatar_url || characterMediaData.assets.find(asset => asset.key === 'avatar').value;
  if(!thumbnailAsset) {
    throw new Error('Invalid character media response received');
  }

  const characterSpecializationsResponse = await BlizzardApi.fetchCharacterSpecializations(region, realm, name);
  const characterSpecializationsData = JSON.parse(characterSpecializationsResponse);
  if (!characterSpecializationsData) {
    throw new Error('Invalid character specializations response received');
  }

  const currentSpecName = characterSpecializationsData.active_specialization && characterSpecializationsData.active_specialization.name;

  const json = {
    id: characterData.id,
    region: region.toLowerCase(),
    realm: characterData.realm && characterData.realm.name,
    name: characterData.name,
    battlegroup: null, // deprecated in the new Blizzard API
    faction: getFactionFromType(characterData.faction.type),
    class: characterData.character_class && characterData.character_class.id,
    race: characterData.race && characterData.race.id,
    gender: characterData.gender && getCharacterGender(characterData.gender.type),
    achievementPoints: characterData.achievement_points,
    thumbnail: thumbnailAsset && thumbnailAsset.split('character/')[1],
    spec: currentSpecName,
    role: getCharacterRole(characterData.character_class && characterData.character_class.name, currentSpecName),
    blizzardUpdatedAt: new Date(),
    // creation date isn't returned by the new Blizzard API, and this is a required column in the DB
    createdAt: new Date(),
    lastSeenAt: characterData.last_login_timestamp ? new Date(characterData.last_login_timestamp) : null
  };

  const currentSpec = characterSpecializationsData.specializations.find(it => it.specialization.name === currentSpecName);
  if (currentSpec && currentSpec.talents) {
    json.talents = currentSpec.talents.map(it => it.column_index).join('');
  }

  return json;
}

async function getCharacterFromBlizzardForum(guid, region, realm, name) {
  const characterResponse = await BlizzardApi.fetchClassicCharacter(region, realm, name);
  const characterData = JSON.parse(characterResponse);
  if (!characterData) {
    throw new Error('Invalid character response received');
  }

  let thumbnailAsset = characterData.user.avatar_template || characterData.assets.find(asset => asset.key === 'avatar_template').value;
  if (thumbnailAsset) {
    thumbnailAsset = thumbnailAsset.split('character/')[1];
    thumbnailAsset = thumbnailAsset.split('?alt=/')[0];
  }

  const json = {
    id: guid,
    region: region.toLowerCase(),
    realm: realm,
    name: name,
    battlegroup: null, // deprecated in the new Blizzard API
    faction: getFactionFromRace(characterData.user.character.race),
    class: characterData.user.character.class,
    race: characterData.user.character.race,
    gender: null,
    achievementPoints: characterData.user.character.achievement_points || 0,
    thumbnail: thumbnailAsset,
    spec: null,
    role: null,
    blizzardUpdatedAt: new Date(),
    createdAt: new Date(), // Not provided but this is a required DB column
    lastSeenAt: characterData.user.last_seen_at ? new Date(characterData.user.last_seen_at) : null
  };

  return json;
}

async function getStoredCharacter(id, realm, region, name) {
  if (id) {
    return Character.findByPk(id);
  }
  if (realm && name && region) {
    return Character.findOne({
      where: {
        name,
        region,
        realm,
        // Prevent returning characters that were wiped through the background
        // job. See: jobs/characters.js
        class: { [Op.ne]: null }
      },
    });
  }
  return null;
}

async function storeCharacter(char) {
  await Character.upsert({
    ...char,
    lastSeenAt: Sequelize.fn('NOW'),
  });
}

async function fetchCharacter(region, realm, name, res = null) {
  try {
    // noinspection JSIgnoredPromiseFromCall Nothing depends on this, so it's quicker to let it run asynchronous
    const charFromApi = await getCharacterFromBlizzardApi(region, realm, name);
    if (res) {
      sendJson(res, charFromApi);
    }
    // noinspection JSIgnoredPromiseFromCall Nothing depends on this, so it's quicker to let it run asynchronous
    storeCharacter(charFromApi);
  } catch (error) {
    const body = error.response ? error.response.body : null;

    // We can't currently support the CN region because of Blizzard API restrictions
    if (error instanceof RegionNotSupportedError) {
      // Record the error because we want to know how often this occurs and if it breaks anything
      Sentry.captureException(error);
      if (res) {
        res.status(500);
        sendJson(res, {
          error: 'This region is not supported',
        });
      }
      return;
    }

    // Handle 404: character not found errors.
    if (error instanceof StatusCodeError) {
      // We check for the text so this doesn't silently break when the API endpoint changes.
      const isCharacterNotFoundError = error.statusCode === 404 && body && body.includes('Character not found.');
      if (isCharacterNotFoundError) {
        if (res) {
          send404(res);
        }
        return;
      }
    }

    // Everything else is unexpected
    Sentry.captureException(error);
    if (res) {
      res.status(error.statusCode || 500);
      sendJson(res, {
        error: 'Blizzard API error',
        message: body || error.message,
      });
    }
  }
}

async function fetchClassicCharacter(guid, region, realm, name, res = null) {
  try {
    // noinspection JSIgnoredPromiseFromCall Nothing depends on this, so it's quicker to let it run asynchronous
    const charFromForum = await getCharacterFromBlizzardForum(guid, region, realm, name);
    if (res) {
      sendJson(res, charFromForum);
    }
    // noinspection JSIgnoredPromiseFromCall Nothing depends on this, so it's quicker to let it run asynchronous
    storeCharacter(charFromForum);
  } catch (error) {
    const body = error.response ? error.response.body : null;

    // CN Region not supported
    if (error instanceof RegionNotSupportedError) {
      // Record the error because we want to know how often this occurs and if it breaks anything
      Sentry.captureException(error);
      if (res) {
        res.status(500);
        sendJson(res, {
          error: 'This region is not supported',
        });
      }
      return;
    }

    // Handle 404: character not found errors.
    if (error instanceof StatusCodeError) {
      // We check for the text so this doesn't silently break when the API endpoint changes.
      const isCharacterNotFoundError = error.statusCode === 404 && body && body.includes('Character not found.');
      if (isCharacterNotFoundError) {
        if (res) {
          send404(res);
        }
        return;
      }
    }

    // Everything else is unexpected
    Sentry.captureException(error);
    if (res) {
      res.status(error.statusCode || 500);
      sendJson(res, {
        error: 'Blizzard Forum error',
        message: body || error.message,
      });
    }
  }
}

const router = Express.Router();

function cors(req, res, next) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
}
router.get('/i/character/:id([0-9]+)', cors, async (req, res) => {
  const { id } = req.params;
  const character = await getStoredCharacter(id);
  if (!character) {
    // No character found, and we can't find a character by just its id, so this is all we can do.
    send404(res);
    return;
  }

  // Match found, send cached info and then refresh.
  sendJson(res, character);

  // noinspection JSIgnoredPromiseFromCall
  fetchCharacter(character.region, character.realm, character.name);
});
router.get('/i/character/:region([A-Z]{2})/:realm([^/]{2,})/:name([^/]{2,})', cors, async (req, res) => {
  const { region, realm, name } = req.params;

  const storedCharacter = await getStoredCharacter(null, realm, region, name);

  let responded = false;
  //checking if thumbnail exists in cache here because Parses.js will throw up without it here
  //If it's not here then it's better to wait on the API call to come back
  if (storedCharacter && storedCharacter.thumbnail) {
    sendJson(res, storedCharacter);
    responded = true;
  }

  // noinspection JSIgnoredPromiseFromCall
  fetchCharacter(region, realm, name, !responded ? res : null);
});
router.get('/i/character/:id([0-9]+)/:region([A-Z]{2})/:realm([^/]{2,})/:name([^/]{2,})', cors, async (req, res) => {
  const { id, region, realm, name } = req.params;
  const storedCharacter = await getStoredCharacter(id);
  let responded = false;
  // Old cache entries won't have the thumbnail value. We want the thumbnail value. So don't respond yet if it's missing.
  if (storedCharacter && storedCharacter.thumbnail) {
    sendJson(res, storedCharacter);
    responded = true;
  }

  // noinspection JSIgnoredPromiseFromCall
  fetchCharacter(region, realm, name, !responded ? res : null);
});
router.get('/i/character/classic/:id([0-9]+)/:region([A-Z]{2})/:realm([^/]{2,})/:name([^/]{2,})', cors, async (req, res) => {
  const { id, region, realm, name } = req.params;
  const storedCharacter = await getStoredCharacter(id);
  let responded = false;
  // Old cache entries won't have the thumbnail value. We want the thumbnail value. So don't respond yet if it's missing.
  if (storedCharacter && storedCharacter.thumbnail) {
    sendJson(res, storedCharacter);
    responded = true;
  }

  // noinspection JSIgnoredPromiseFromCall
  fetchClassicCharacter(id, region, realm, name, !responded ? res : null);
});

export default router;
