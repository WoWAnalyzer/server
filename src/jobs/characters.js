const CronJob = require('cron').CronJob;
import moment from 'moment';
import models from '../models';
import { Op } from 'sequelize';

const Character = models.Character;

async function deleteExpiredCharacters() {
  const expirationDate = moment().subtract(30, 'days').toDate();
  console.log(`Deleting characters older than ${expirationDate}...`);

  await Character.destroy({
    where: {
      blizzardUpdatedAt: {
        [Op.lte]: expirationDate
      }
    }
  });
}

// run the job every day at 00:00
export const deleteExpiredCharactersJob = new CronJob('0 0 * * * *', deleteExpiredCharacters);
