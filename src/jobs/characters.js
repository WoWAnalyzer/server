const CronJob = require('cron').CronJob;
import moment from 'moment';
import models from '../models';
import { Op } from 'sequelize';

const Character = models.Character;

async function updateCharacter(character) {
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
    heartOfAzeroth: null
  }, {
    where: {
      id: character.id
    }
  });
}

async function deleteExpiredCharacters() {
  Character.findAll({
    where: {
      // we don't want to wipe data that is already wiped
      [Op.or]: [
        { battlegroup: { [Op.ne]: null } },
        { faction: { [Op.ne]: null } },
        { class: { [Op.ne]: null } },
        { race: { [Op.ne]: null } },
        { gender: { [Op.ne]: null } },
        { achievementPoints: { [Op.ne]: null } },
        { thumbnail: { [Op.ne]: null } },
        { spec: { [Op.ne]: null } },
        { role: { [Op.ne]: null } },
        { talents: { [Op.ne]: null } },
        { heartOfAzeroth: { [Op.ne]: null } },
      ],
      // we only want to wipe data after the TOS were changed
      blizzardUpdatedAt: {
        [Op.between]: [moment.utc('2020-01-01'), moment().subtract(30, 'days').toDate()]
      }
    }
  }).then(characters => {
    console.log('Resetting', characters.length, 'characters');

    let charactersModified = 0;
    try {
      characters.forEach(character => {
        updateCharacter(character.dataValues);
        charactersModified++;
      });
    } catch (error) {
      Sentry.captureException(error);
    }

    console.log("Total Characters Nullified: " + charactersModified);
  });
}

// run the job every day at 00:00
export const deleteExpiredCharactersJob = new CronJob('0 0 * * * *', deleteExpiredCharacters);
