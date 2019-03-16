import Express from 'express';

const router = Express.Router();

router.use('/login', require('./login').default);
router.use('/logout', require('./logout').default);
router.use('/user', require('./user').default);

export default router;
