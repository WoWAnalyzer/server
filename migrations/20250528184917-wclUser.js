module.exports = {
  up: (queryInterface, DataTypes) => {
    return Promise.all([
      queryInterface.createTable("WclUser", {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
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
      }),
    ]);
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.dropTable("WclUser");
  },
};
