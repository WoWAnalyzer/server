const CronJob = require('cron').CronJob;
const Sentry = require('@sentry/node');

import moment from 'moment';
import models from '../models';
import { Op } from 'sequelize';

const Character = models.Character;
const newTosDate = moment.utc('2020-01-01').toDate();

async function wipeExpiredCharacters() {
  const expirationDate = moment().subtract(30, 'days').toDate();
  console.log(`Wiping characters between ${newTosDate} and ${expirationDate}...`);

  await Character.update({
    battlegroup: null,
    faction: null,
    class: null,
    race: null,
    gender: null,
    achievementPoints: null,
    thumbnail: null,
    spec: null,
    role: null,
    talents: null,
    heartOfAzeroth: null,
    blizzardUpdatedAt: new Date()
  }, {
    where: {
      blizzardUpdatedAt: {
        [Op.between]: [newTosDate, expirationDate]
      }
    }
  })
  .then(() => {
    console.log("Done");
  })
  .catch(error => {
    console.log("Error while wiping characters", error);
    Sentry.captureException(error);
  });
}

// run the job every day at 00:00
export const wipeExpiredCharactersJob = new CronJob('0 0 * * * *', wipeExpiredCharacters);
