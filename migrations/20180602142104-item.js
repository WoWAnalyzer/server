import { Sequelize as DataTypes } from "sequelize";
module.exports = {
  up: ({ context: queryInterface }) => {
    return Promise.all([
      queryInterface.createTable("Item", {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
        },
        name: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        icon: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        createdAt: {
          type: DataTypes.DATE, // this is actually DATETIME
          defaultValue: DataTypes.NOW,
          allowNull: false,
        },
      }),
    ]);
  },

  down: ({ context: queryInterface }) => {
    return queryInterface.dropTable("Item");
  },
};
