import { Sequelize } from 'sequelize';

module.exports = {
  up: ({context: queryInterface}) => {
    return Promise.all([
      queryInterface.bulkDelete('Spell', {}, {
        truncate: true,
      }),
      queryInterface.changeColumn('Spell', 'name', {
        type: Sequelize.STRING(2000),
        allowNull: false,
      }),
    ])
  },

  down: ({context: queryInterface}) => {
    return queryInterface.changeColumn('Spell', 'name', {
      type: Sequelize.STRING(255),
      allowNull: false,
    })
  }
};
