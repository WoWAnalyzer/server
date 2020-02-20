const Sequelize = require('sequelize');
const Sentry = require('@sentry/node');

const models = require(process.env.NODE_ENV === 'production' ? '../models' : '../src/models').default;

const Op = Sequelize.Op;
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
            id: character.id,
        }
    });
}

Character.findAll({
    where: {
        blizzardUpdatedAt: {
            [Op.between]: [new Date('2020-01-01'), new Date(new Date().setDate(new Date().getDate() - 30))]
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

