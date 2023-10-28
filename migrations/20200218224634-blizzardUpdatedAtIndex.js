module.exports = {
  up: ({context: queryInterface}) => {
    return Promise.all([
      queryInterface.addIndex('Character', ['blizzardUpdatedAt'])
    ]);
  },

  down: ({context: queryInterface}) => {
    return Promise.all([
      queryInterface.removeIndex('Character', ['blizzardUpdatedAt']),
    ]);
  },
};
