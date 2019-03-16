import Express from 'express';
import proxy from 'express-http-proxy';
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
  proxyReqPathResolver: req => req.originalUrl,
  proxyErrorHandler: function(err, res, next) {
    switch (err && err.code) {
      case 'ENOTFOUND': // this may occur in production because we access other servers through DNS names that can not be found if the server is down
      case 'ECONNREFUSED':
        return res
          .status(503)
          .header('Retry-After', 5)
          .send('App is down. This is probably due to a new version being deployed. This usually takes about 5 seconds. If this persists please let us know: https://discord.gg/AxphPxU');
      default:
        next(err);
        break;
    }
  },
};

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
router.get('*', function (req, res, next) {
  if (req.originalUrl === '/') {
    // Make sure the root isn't cached to avoid browsers caching old versions of the app
    nocache(req, res, next);
  } else {
    // Cache away! (maybe we should even encourage this more)
    next();
  }
}, proxy(PROXY_HOST, PROXY_CONFIG));

export default router;
