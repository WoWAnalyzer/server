import Express from 'express';
import Sequelize from 'sequelize';
import * as Sentry from '@sentry/node';

import models from '../../models';
import BlizzardApi from '../../helpers/BlizzardApi';

const Item = models.Item;
const DEFAULT_LOCALE = 'en_US';
const REFRESH_INTERVAL = 864000; // 10 days, items don't really change that much

/**
 * Fetches Item info(name and icon) from the battle net API.
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

async function fetchItem(itemId) {
  const [itemData, itemMediaData] = await Promise.all([
    BlizzardApi.fetchItem(itemId),
    BlizzardApi.fetchItemMedia(itemId),
  ]);
  const item = JSON.parse(itemData);
  const itemMedia = JSON.parse(itemMediaData);

  return {
    item,
    itemMedia,
  };
}

async function updateItem(itemId) {
  try {
    console.log('ITEM', 'Fetching item', itemId);
    const {item, itemMedia} = await fetchItem(itemId);
    await Item.upsert({
      id: itemId,
      name: JSON.stringify(item.name[DEFAULT_LOCALE]),
      icon: itemMedia.assets.find((asset) => asset.key === 'icon').value,
      createdAt: Sequelize.fn('NOW'),
    });
  } catch (error) {
    if (error.statusCode === 404) {
      return null;
    } else {
      throw error;
    }
  }
}

async function getItem(itemId) {
  const item = await Item.findByPk(itemId);
  if (item) {
    const age = (new Date() - item.createdAt) / 1000;
    if (age > REFRESH_INTERVAL) {
      // Background update, show stale data meanwhile (nothing probably changed)
      updateItem(itemId);
    }

    return item;
  }

  await updateItem(itemId);

  return Item.findByPk(itemId);
}

function sendItem(res, {itemId, name, icon}, locale) {
  const nameObject = JSON.parse(name);
  sendJson(res, {
    itemId,
    name: nameObject[locale] || nameObject[DEFAULT_LOCALE],
    icon,
  });
}

const router = Express.Router();
router.get('/i/item/:id([0-9]+)', async (req, res) => {
  const {id} = req.params;
  const locale = req.query.locale || DEFAULT_LOCALE;
  try {
    const item = await getItem(id);
    if (item) {
      sendItem(res, item, locale);
    } else {
      send404(res);
    }
  } catch (error) {
    const {statusCode, message, response} = error;
    console.log('REQUEST', 'Error fetching Item', statusCode, message);
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
