module.exports = {
  up: (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.addColumn('Character', 'blizzardUpdatedAt', Sequelize.DATEONLY, {
        allowNull: true,
      }),
      queryInterface.changeColumn('Character', 'name', Sequelize.STRING, {
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
