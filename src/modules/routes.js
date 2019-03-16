import Express from 'express';

const router = Express.Router();

router.use(require('./user').default);
router.use(require('./wacraftlogs').default);
router.use(require('./character').default);
router.use(require('./item').default);
router.use(require('./spell').default);
router.use(require('./thirdparty').default);
router.use(require('./spa').default);

export default router;
