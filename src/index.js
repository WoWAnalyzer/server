import Express from 'express';
import compression from 'compression';
import BodyParser from 'body-parser';
import fs from 'fs';

import { createServer as createMetricsServer } from 'helpers/metrics';

import loadDotEnv from './config/env';
import configureRaven from './configureRaven';
import configureSession from './configureSession';
import configurePassport from './configurePassport';
import routes from './modules/routes';

process.env.NODE_ENV = process.env.NODE_ENV || 'development';
const appDirectory = fs.realpathSync(process.cwd());
loadDotEnv(appDirectory);

const app = Express();
configureRaven(app);
app.use(compression());
app.use(BodyParser.urlencoded({ extended: false }));
configureSession(app);
configurePassport(app);
app.use(routes);

app.listen(process.env.PORT, () => {
  console.log(`Listening to port ${process.env.PORT}`);
});

createMetricsServer();
