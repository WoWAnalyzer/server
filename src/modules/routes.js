import Express from 'express';

const router = Express.Router();

router.use(require('modules/user').default);
router.use(require('modules/wacraftlogs').default);
router.use(require('modules/character').default);
router.use(require('modules/item').default);
router.use(require('modules/spell').default);
router.use(require('modules/thirdparty').default);
router.use(require('modules/spa').default);

export default router;
