module.exports = {
  up: (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.addColumn('Character', 'blizzardUpdatedAt', Sequelize.DATEONLY, {
        allowNull: true,
      })
    ]);
  },

  down: (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.removeColumn('Character', 'blizzardUpdatedAt'),
    ]);
  },
};
