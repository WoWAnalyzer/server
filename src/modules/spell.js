import * as Sentry from '@sentry/node';
import Express from 'express';
import { Sequelize } from 'sequelize';
import fetch from 'node-fetch';
import FormData from 'form-data';

import BlizzardApi from 'helpers/BlizzardApi';

import models from '../models';

const Spell = models.Spell;
const DEFAULT_LOCALE = 'en_US';
const REFRESH_INTERVAL = 86400; // no point making this very long, the rate limit is high enough

/**
 * Fetches Spell info(name and icon) from the battle net API.
 * After fetching from API it'll store in MySQL DB in order to reduce the number of calls to the battle net API
 * and reduce latency on subsequent calls
 */
// TODO: Refresh automatically after x time

function sendJson(res, json) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.send(json);
}

function send404(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.sendStatus(404);
}

async function fetchToken() {
  const requestBody = new FormData();
  requestBody.append('grant_type', 'client_credentials');
  const response = await fetch('https://www.warcraftlogs.com/oauth/token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization:
        'Basic ' +
        Buffer.from(`${process.env.WCL_CLIENT_ID}:${process.env.WCL_SECRET}`).toString('base64'),
    },
    body: requestBody,
  });
  if (!response.ok) {
    throw new Error(
      `Failed to fetch hook status: ${response.status} ${
        response.statusText
      }. Body: ${await response.text()}`,
    );
  }

  const { access_token } = await response.json();

  return access_token;
}
let token = null;
function getToken() {
  if (!token) {
    // This sets token to Promise<string> so simultaneous requests use the same token-update request
    token = fetchToken();
  }

  return token;
}
function resetToken() {
  token = null;
}

const wclQuery = async (graphQlQuery, attempt = 0) => {
  const token = await getToken();
  const response = await fetch('https://www.warcraftlogs.com/api/v2/client', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: graphQlQuery,
    }),
  });
  if (!response.ok) {
    if (response.status === 401 && attempt === 0) {
      // Token expired - retry once.
      resetToken();
      return wclQuery(queryString, attempt + 1);
    }

    throw new Error(
      `Failed to query WCL: ${response.status} ${
        response.statusText
      }. Body: ${await response.text()}`,
    );
  }

  const { data } = await response.json();

  return data;
};

async function fetchSpell(spellId) {
  const {
    gameData: { ability },
  } = await wclQuery(`
    {
      gameData {
        ability(id: ${spellId}) {
          id
          icon
          name
        }
      }
    }
  `);

  return {
    ...ability,
    icon: ability.icon.replace(/.jpg$/, ''),
  };
}

async function updateSpell(id) {
  try {
    console.log('SPELL', 'Fetching spell', id);
    const spell = await fetchSpell(id);
    await Spell.upsert({
      id: id,
      name: spell.name,
      icon: spell.icon,
      createdAt: Sequelize.fn('NOW'),
    });
    return spell;
  } catch (error) {
    if (error.statusCode === 404) {
      return null;
    } else {
      throw error;
    }
  }
}

async function getSpell(id) {
  const spell = await Spell.findByPk(id);
  if (spell) {
    const age = (new Date() - spell.createdAt) / 1000;
    if (age > REFRESH_INTERVAL) {
      // Background update, show stale data meanwhile (nothing probably changed)
      updateSpell(id);
    }

    return spell;
  }

  return await updateSpell(id);
}

function sendSpell(res, { id, name, icon }, locale) {
  sendJson(res, {
    id,
    name,
    icon,
  });
}

const router = Express.Router();
router.get('/i/spell/:id([0-9]+)', async (req, res) => {
  const { id } = req.params;
  const locale = req.query.locale || DEFAULT_LOCALE;
  try {
    const spell = await getSpell(id);
    if (spell) {
      sendSpell(res, spell, locale);
    } else {
      send404(res);
    }
  } catch (error) {
    const { statusCode, message, response } = error;
    console.log('REQUEST', 'Error fetching Spell', statusCode, message);
    console.error(error);
    const body = response ? response.body : null;
    Sentry.captureException(error);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(statusCode || 500);
    sendJson(res, {
      error: 'Blizzard API error',
      message: body || error.message,
    });
  }
});

export default router;
