import { Sequelize as DataTypes } from "sequelize";

module.exports = {
  up: ({ context: queryInterface }) => {
    return queryInterface
      .createTable("User", {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
        },
        gitHubId: {
          type: DataTypes.INTEGER,
          allowNull: true,
        },
        patreonId: {
          type: DataTypes.INTEGER,
          allowNull: true,
        },
        authKey: {
          type: DataTypes.CHAR(32),
          allowNull: false,
          unique: true,
        },
        data: {
          type: DataTypes.TEXT("long"),
          allowNull: false,
        },
        createdAt: {
          type: DataTypes.DATE, // this is actually DATETIME
          defaultValue: DataTypes.NOW,
          allowNull: false,
        },
        lastSeenAt: {
          type: DataTypes.DATE, // this is actually DATETIME
          defaultValue: DataTypes.NOW,
          allowNull: false,
        },
      })
      .then((result) =>
        Promise.all([
          queryInterface.addIndex("User", ["gitHubId"]),
          queryInterface.addIndex("User", ["patreonId"]),
        ]),
      );
  },

  down: ({ context: queryInterface }) => {
    return queryInterface.dropTable("User");
  },
};
