const Sequelize = require('sequelize');
const Sentry = require('@sentry/node');
const models = require('../models').default;

const Op = Sequelize.Op;
const Character = models.Character;

async function updateCharacter(character) {
    await Character.upsert({
        ...character,
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

