import express from 'express';
const router = express.Router();

router.get('/ads.txt', function(_req, res) {
  res.redirect(301, "https://config.playwire.com/dyn_ads/1024476/73270/ads.txt");
});

export default router;
