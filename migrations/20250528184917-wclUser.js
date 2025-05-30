/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, DataTypes) => {
    await queryInterface.addColumn("User", "wclId", {
      type: DataTypes.INTEGER,
      allowNull: true,
    });
    await queryInterface.addIndex("User", ["wclId"]);
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.dropTable("WclUser");
  },
};
