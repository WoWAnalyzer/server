module.exports = {
  up: (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.addIndex('Character', ['blizzardUpdatedAt'])
    ]);
  },

  down: (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.removeIndex('Character', ['blizzardUpdatedAt']),
    ]);
  },
};
