import Express from 'express';
import proxy from 'express-http-proxy';
import path from 'path';
// express-http-proxy might have a memory leak. We already have a memory leak, so this might complicate things further.
// https://github.com/villadora/express-http-proxy/issues/365

import escapeHtml from 'helpers/escapeHtml';

const router = Express.Router();

// source: https://stackoverflow.com/a/20429914/684353
// Putting these headers here since I'm getting desperate. A lot of 404 errors all the time,
function nocache(req, res, next) {
  res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
  res.header('Expires', '-1');
  res.header('Pragma', 'no-cache');
  next();
}

const PROXY_HOST = process.env.SPA_PROXY_HOST;
const PROXY_CONFIG = {
  // It takes the proxy about 1 second to realize the server is down if it's down. Since the SPA will always be right next to it and only hosts static content, it should normally respond within a few milliseconds or something is up.
  timeout: 1100,
  proxyReqPathResolver: (req) => req.originalUrl,
  proxyErrorHandler: function(err, res, next) {
    switch (err && err.code) {
      case 'ENOTFOUND': // this may occur in production because we access other servers through DNS names that can not be found if the server is down
      case 'ECONNREFUSED':
        console.error(err.message);
        return res
            .status(503)
            .header('Retry-After', 11)
            .sendFile(path.join(__dirname + '/503.html'));
      default:
        next(err);
        break;
    }
  },
  userResHeaderDecorator: (headers, userReq, userRes, proxyReq, proxyRes) => {
    if (userRes.statusCode === 404) {
      // In very rare situations, we may receive a request to a chunk that
      // returns a 404. CloudFlare would then cache this at an edge server,
      // breaking part of the site for users near that server. We need to set
      // cache-control to no-cache to avoid CF from caching these responses.
      // See https://community.cloudflare.com/t/how-to-avoid-caching-404/196262/15
      //
      // Important note: it's only possible to have a reference to a chunk from
      // the index.html when it already exists, since we do not scale the SPA
      // host and it always contains a single artifact with the index and all
      // associated chunks. This means it should be impossible to have chunks
      // that are referenced from the current index.html return a 404. And yet
      // it happens.
      //
      // The only theory left that is feasible is that since we scale the
      // server, server1 may be talking with SPAv2 which gives us the new
      // index.html while server2 is talking to SPAv1. Docker load balances this
      // (round robin), so if server2 is used for the chunk, it may 404.
      // This is hard to believe too, since we haven't implemented 0 second
      // downtime redeploys yet, and currently v1 is always stopped before v2
      // is started.
      //
      // Maybe the SPA nginx is broken?
      //
      // In any case, this header should minimize the impact of this issue as CF
      // should automatically purge the 404 chunk from cache within a short
      // duration.
      //
      // Excessive logging to further investigate.
      console.warn('Encountered 404 for request', userReq.url, userReq, userRes, proxyReq, proxyRes);

      return {
        ...headers,
        'Cache-Control': 'No-Cache',
      };
    }

    return headers;
  },
};

router.get('/CharacterJourney.mp4', function(req, res) {
  return res.status(200).sendFile(path.join(__dirname + '/CharacterJourney.mp4'));
});
router.get([
  '/report/:reportCode([A-Za-z0-9]+)/:fightId([0-9]+)?:fightName(-[^/]+)?/:playerId([0-9]+)?:playerName(-[^/]{2,})?/:tab([A-Za-z0-9-]+)?',
  // This is the same route as above but without `playerId` since this breaks links without player id and with special characters such as: https://wowanalyzer.com/report/Y8GbgcB6d9ptX3K7/7-Mythic+Demonic+Inquisition+-+Wipe+1+(5:15)/Rootzô
  '/report/:reportCode([A-Za-z0-9]+)/:fightId([0-9]+)?:fightName(-[^/]+)?/:playerName([^/]{2,})?/:tab([A-Za-z0-9-]+)?',
], nocache, proxy(PROXY_HOST, {
  ...PROXY_CONFIG,
  userResDecorator: (proxyRes, proxyResData, userReq, userRes) => {
    let response = proxyResData.toString('utf8');
    if (userReq.params.fightName) {
      const fightName = decodeURI(userReq.params.fightName.substr(1).replace(/\+/g, ' '));
      const playerName = userReq.params.playerName && decodeURI(userReq.params.playerName);

      let title = '';
      if (playerName) {
        title = `${fightName} by ${playerName}`;
      } else {
        title = fightName;
      }

      // This is a bit hacky, better solution welcome
      response = response
          .replace('property="og:title" content="WoWAnalyzer"', `property="og:title" content="WoWAnalyzer: ${escapeHtml(title)}"`)
          .replace('<title>WoWAnalyzer</title>', `<title>WoWAnalyzer: ${escapeHtml(title)}</title>`);
    }

    return response;
  },
}));
router.get('*', function(req, res, next) {
  if (req.originalUrl === '/') {
    // Make sure the root isn't cached to avoid browsers caching old versions of the app
    nocache(req, res, next);
  } else {
    // Cache away! (maybe we should even encourage this more)
    next();
  }
}, proxy(PROXY_HOST, PROXY_CONFIG));

export default router;
