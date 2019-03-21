import Express from 'express';
import Sequelize from 'sequelize';
import querystring from 'querystring';
import * as Sentry from '@sentry/node';

import models from 'models';

import fetchFromWarcraftLogsApi, { WCL_REPORT_DOES_NOT_EXIST_HTTP_CODE } from './fetchFromWarcraftLogsApi';
import WarcraftLogsApiError from './WarcraftLogsApiError';

const WclApiResponse = models.WclApiResponse;
const WCL_API_KEY = process.env.WCL_API_KEY;

function serializeUrl(path, query) {
  return `/${path}?${querystring.stringify(query)}`;
}
// The max cache size is currently based on the database's max_allowed_packet
// value. This is set to 16MB which also seems like a fine limit to skip
// caching at as it's uncommon (only happens for M+ logs).
const MAX_CACHE_ENTRY_SIZE = 16 * 1024 * 1024; // 16 MB
async function cacheWclApiResponse(cacheKey, content) {
  const contentLength = content.length;
  if (contentLength > MAX_CACHE_ENTRY_SIZE) {
    console.debug('Not caching', cacheKey, 'since it\'s too large.', (contentLength / 1024 / 1024).toFixed(1), 'MB (max is', MAX_CACHE_ENTRY_SIZE / 1024 / 1024, 'MB)');
    return;
  }
  // Regardless of already existing, set `numAccesses` to 1 since we want to
  // know accesses since last cache bust which helps us determine if we should
  // keep certain responses in our cache. If an url is regularly cache busted
  // it's not as valuable in the cache.
  await WclApiResponse.upsert({
    url: cacheKey,
    content,
    wclResponseTime: 0, // TODO: Drop this column
    numAccesses: 1,
    lastAccessedAt: Sequelize.fn('NOW'),
  });
}
function determineCategory(path) {
  if (path.includes('/events/')) {
    return 'events';
  } else if (path.includes('/fights/')) {
    return 'fights';
  } else if (path.includes('/tables/')) {
    return 'tables';
  } else if (path.includes('/character/')) {
    return 'character';
  } else {
    return 'other';
  }
}

const router = Express.Router();
const relativePath = '/i/v1/';
const relativePathLength = relativePath.length;
router.get(`${relativePath}*`, async (req, res) => {
  const resolve = jsonString => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.send(jsonString);
  };
  const reject = (statusCode, jsonString) => {
    res.status(statusCode);
    resolve(jsonString);
  };

  try {
    // remove / prefix
    const path = req.path.substr(relativePathLength);
    // Don't use `req.params[0]` here as this automatically (url)decodes parts, breaking special characters in name!
    const query = req.query;
    // This allows users to skip the cache and refresh always. This is useful when live logging. It stores the result in the regular (uncachebusted) spot so that future requests for the regular request are also updated.
    let skipCache = false;
    if (query._) {
      skipCache = true;
      delete query._;
    }
    let apiKey = WCL_API_KEY;
    if (query.api_key) {
      apiKey = query.api_key;
      delete query.api_key; // avoid serializing this
    }

    const cacheKey = serializeUrl(path, query);
    if (!skipCache) {
      const cachedWclApiResponse = await WclApiResponse.findByPk(cacheKey);
      if (cachedWclApiResponse) {
        console.log('cache HIT', cacheKey);
        // noinspection JSIgnoredPromiseFromCall No need to wait for this as it doesn't affect the result.
        cachedWclApiResponse.update({
          numAccesses: cachedWclApiResponse.numAccesses + 1,
          lastAccessedAt: Sequelize.fn('NOW'),
        });
        resolve(cachedWclApiResponse.content);
        return;
      } else {
        console.log('cache MISS', cacheKey);
      }
    } else {
      console.log('cache SKIP', cacheKey);
    }

    const wclResponse = await fetchFromWarcraftLogsApi(path, query, apiKey, { category: determineCategory(path) });
    // noinspection JSIgnoredPromiseFromCall No need to wait for this as it doesn't affect the result.
    cacheWclApiResponse(cacheKey, wclResponse);
    resolve(wclResponse);
  } catch (err) {
    if (err instanceof WarcraftLogsApiError) {
      // An error on WCL's side
      console.error(`WCL Error (${err.statusCode}): ${err.message}`);
      if (err.statusCode !== WCL_REPORT_DOES_NOT_EXIST_HTTP_CODE) {
        // Ignore "This report does not exist or is private."
        Sentry.captureException(err, {
          extra: err.context,
        });
      }
      reject(err.statusCode, {
        error: 'Warcraft Logs API error',
        message: err.message,
      });
    } else {
      // An error on our side
      console.error('A server error occured', err);
      Sentry.captureException(err);
      reject(500, {
        error: 'A server error occured',
        message: err.message,
      });
    }
  }
});

export default router;
