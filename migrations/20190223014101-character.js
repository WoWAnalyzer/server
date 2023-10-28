import { Sequelize} from 'sequelize';
module.exports = {
  up: ({ context: queryInterface }) => {
    return Promise.all([
      queryInterface.addColumn("Character", "heartOfAzeroth", Sequelize.JSON, {
        allowNull: true,
      }),
    ]);
  },

  down: ({ context: queryInterface }) => {
    return Promise.all([
      queryInterface.removeColumn("Character", "heartOfAzeroth"),
    ]);
  },
};
