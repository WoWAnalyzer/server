import Express from 'express';

const router = Express.Router();

router.use('/i', require('./api').default);
router.use('/login', require('./login').default);
router.use('/logout', require('./logout').default);
router.use('/user', require('./user').default);
router.use('/discord', require('./discord').default);
router.use(require('./spa').default);

export default router;
