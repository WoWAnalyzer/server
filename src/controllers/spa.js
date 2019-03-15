import Express from 'express';
import proxy from 'express-http-proxy';

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

const SPA_HOST = 'http://localhost:3000';
const PROXY_CONFIG = {
  timeout: 500,
  proxyReqPathResolver: req => req.originalUrl,
};

router.get([
  '/report/:reportCode([A-Za-z0-9]+)/:fightId([0-9]+)?:fightName(-[^/]+)?/:playerId([0-9]+)?:playerName(-[^/]{2,})?/:tab([A-Za-z0-9-]+)?',
  // This is the same route as above but without `playerId` since this breaks links without player id and with special characters such as: https://wowanalyzer.com/report/Y8GbgcB6d9ptX3K7/7-Mythic+Demonic+Inquisition+-+Wipe+1+(5:15)/Rootzô
  '/report/:reportCode([A-Za-z0-9]+)/:fightId([0-9]+)?:fightName(-[^/]+)?/:playerName([^/]{2,})?/:tab([A-Za-z0-9-]+)?',
], nocache, proxy(SPA_HOST, {
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
}, proxy(SPA_HOST, PROXY_CONFIG));

export default router;
