import Express from 'express';
import Sequelize from 'sequelize';
import * as Sentry from '@sentry/node';

import BlizzardApi from 'helpers/BlizzardApi';

import models from '../../models';

const Spell = models.Spell;

/**
 * Fetches Spell info(name and icon) from the battle net API.
 * After fetching from API it'll store in MySQL DB in order to reduce the number of calls to the battle net API
 * and reduce latency on subsequent calls
 */

function sendJson(res, json) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.send(json);
}
function send404(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.sendStatus(404);
}

// TODO: Store result in DB
// TODO: Send only 1 locale to client and clean up the response
// TODO: Refresh automatically after x time
// TODO: Only update lastSeenAt once an hour to reduce DB load

async function fetchSpell(spellId) {
  const [spellData, spellMediaData] = await Promise.all([
    BlizzardApi.fetchSpell(spellId),
    BlizzardApi.fetchSpellMedia(spellId)
  ]);
  const spell = JSON.parse(spellData);
  const spellMedia = JSON.parse(spellMediaData);

  return {
    spell,
    spellMedia,
  }
}

async function proxySpellApi(res, spellId) {
  try {
    const { spell, spellMedia } = await fetchSpell(spellId)
    const json = {
      spell,
      spellMedia,
    }
    sendJson(res, json);
    return json;
  } catch (error) {
    const { statusCode, message, response } = error;
    console.log('REQUEST', 'Error fetching Spell', statusCode, message);
    const body = response ? response.body : null;
    if (statusCode === 404) {
      send404(res);
    } else {
      Sentry.captureException(error);
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.status(statusCode || 500);
      sendJson(res, {
        error: 'Blizzard API error',
        message: body || error.message,
      });
    }
    return null;
  }
}
async function storeSpell({ id, name, icon }) {
  await Spell.upsert({
    id,
    name,
    icon,
    lastSeenAt: Sequelize.fn('NOW'),
  });
}

const router = Express.Router();
router.get('/i/spell/:id([0-9]+)', async (req, res) => {
  const { id } = req.params;
  let spell = await Spell.findByPk(id);
  if (spell) {
    sendJson(res, spell);
    spell.update({
      lastSeenAt: Sequelize.fn('NOW'),
    });
  } else {
    spell = await proxySpellApi(res, id);
    if (spell) {
      storeSpell(spell);
    }
  }
});
export default router;
