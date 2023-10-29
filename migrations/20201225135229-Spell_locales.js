'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
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

  down: (queryInterface, Sequelize) => {
    return queryInterface.changeColumn('Spell', 'name', {
      type: Sequelize.STRING(255),
      allowNull: false,
    })
  }
};
