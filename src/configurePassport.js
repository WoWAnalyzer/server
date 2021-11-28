import Passport from 'passport';

import models from './models';

const User = models.User;

export default function configurePassport(app) {
  app.use(Passport.initialize());
  app.use(Passport.session());
  Passport.serializeUser(function (user, done) {
    done(null, user.id);
  });
  Passport.deserializeUser(async function (id, done) {
    const user = await User.findByPk(id);
    done(null, user);
  });
}
