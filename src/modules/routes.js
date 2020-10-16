import Express from 'express';

const router = Express.Router();

router.use(require('./user').default);
router.use(require('./wacraftlogs').default);
router.use(require('./character').default);
router.use(require('./guild').default);
router.use(require('./item').default);
router.use(require('./spell').default);
router.use(require('./thirdparty').default);

// When requesting an API endpoint that doesn't exist we shouldn't fallback to the app
router.get('/i/*', function (req, res) {
  console.log('API 404', req.originalUrl);
  res.sendStatus(404);
});

router.use(require('./spa').default);

export default router;
