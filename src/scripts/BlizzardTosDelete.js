import models from '../models';
import Sequelize from 'sequelize';
import * as Sentry from '@sentry/node';
const Op = Sequelize.Op;
const Character = models.Character;

async function updateCharacter(character) {
    await Character.upsert({
        ...character,
        name: null,
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
      });
}

var charactersModified = 0;

Character.findAll({
    where: {
        blizzardUpdatedAt: {
            [Op.between]: [new Date("1/1/2020"), new Date(new Date().setDate(new Date().getDate() - 30))]
        }
    }
}).then(characters => {
    console.log("Characters: " + characters.length)

    try {
        characters.forEach(character => {
            charactersModified++;
            updateCharacter(character.dataValues);
            });
    }
    catch (error) {
        Sentry.captureException(error);
    }

    console.log("Total Characters Nullified: " + charactersModified);
});

