import { Sequelize } from 'sequelize';
module.exports = {
  up: ({ context: queryInterface}) => {
    return Promise.all([
      queryInterface.addColumn('Character', 'blizzardUpdatedAt', Sequelize.DATEONLY, {
        allowNull: true,
      })
    ]);
  },

  down: ({context: queryInterface}) => {
    return Promise.all([
      queryInterface.removeColumn('Character', 'blizzardUpdatedAt'),
    ]);
  },
};
