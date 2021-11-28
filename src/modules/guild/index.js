import Express from 'express';
import Sequelize from 'sequelize';
import * as Sentry from '@sentry/node';
import {StatusCodeError} from 'request-promise-native/errors';

import BlizzardApi, {getFactionFromType} from 'helpers/BlizzardApi';
import RegionNotSupportedError from 'helpers/RegionNotSupportedError';

import models from '/models';

const Guild = models.Guild;

/**
 * Handle requests for guild information and returns data from the Blizzard API.
 * The caching strategy being used here is to always return cached data first if it exists. then refresh in the background
 */
function sendJson(res, json) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.send(json);
}

function send404(res) {
  res.sendStatus(404);
}

async function getGuildFromBlizzardApi(region, realm, nameSlug) {
  const guildResponse = await BlizzardApi.fetchGuild(region, realm, nameSlug);
  const guildData = JSON.parse(guildResponse);
  if (!guildData) {
    throw new Error('Invalid guild response received');
  }
  const crest = guildData.crest; // Just some shorthand
  return {
    id: guildData.id,
    region: region.toLowerCase(),
    realm: realm,
    name: guildData.name,
    nameSlug: nameSlug,
    faction: getFactionFromType(guildData.faction.type),
    created: guildData.created_timestamp,
    achievementPoints: guildData.achievement_points,
    memberCount: guildData.member_count,
    crest: {
      emblemId: crest.emblem.id,
      emblemColor: [crest.emblem.color.rgba.r, crest.emblem.color.rgba.g, crest.emblem.color.rgba.b, crest.emblem.color.rgba.a],
      borderId: crest.border.id,
      borderColor: [crest.border.color.rgba.r, crest.border.color.rgba.g, crest.border.color.rgba.b, crest.border.color.rgba.a],
      backgroundColor: [crest.background.color.rgba.r, crest.background.color.rgba.g, crest.background.color.rgba.b, crest.background.color.rgba.a],
    },
  };
}

async function getStoredGuild(realm, region, nameSlug) {
  if (realm && nameSlug && region) {
    return Guild.findOne({
      where: {
        nameSlug,
        region,
        realm,
      },
    });
  }
  return null;
}

async function storeGuild(guild) {
  await Guild.upsert({
    ...guild,
    updatedAt: Sequelize.fn('NOW'),
  });
}

async function fetchGuild(region, realm, nameSlug, res = null) {
  try {
    const guildFromApi = await getGuildFromBlizzardApi(region, realm, nameSlug);
    if (res) {
      sendJson(res, guildFromApi);
    }
    storeGuild(guildFromApi);
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

    // Handle 404: guild not found errors.
    if (error instanceof StatusCodeError) {
      if (error.statusCode === 404) {
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

function cors(req, res, next) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
}

const router = Express.Router();
router.get('/i/guild/:region([A-Z]{2})/:realm([^/]{2,})/:name([^/]{2,})', cors, async (req, res) => {
  const {region, realm, name} = req.params;
  // Because guild name is used as an index, slug it for consistency
  const nameSlug = name.replace(/\s/g, '-').toLowerCase();
  const storedGuild = await getStoredGuild(realm, region, nameSlug);

  let responded = false;
  if (storedGuild) {
    sendJson(res, storedGuild);
    responded = true;
  }
  fetchGuild(region, realm, nameSlug, !responded ? res : null);
});

export default router;
