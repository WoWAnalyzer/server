import Express from 'express';

const router = Express.Router();

router.get('/i/healthcheck', function (req, res) {
  res.sendStatus(200);
});

export default router;
