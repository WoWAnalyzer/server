"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    /**
     * Add altering commands here.
     *
     * Example:
     * await queryInterface.createTable('users', { id: Sequelize.INTEGER });
     */

    await queryInterface.createTable(
      "spec_analysis_metric_key",
      {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        reportCode: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        fightId: {
          type: Sequelize.INTEGER,
          allowNull: false,
        },
        playerId: {
          type: Sequelize.INTEGER,
          allowNull: false,
        },
        configName: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        analysisTimestamp: { type: Sequelize.DATE, allowNull: false },
      },
      {
        uniqueKeys: {
          UniqueSelection: { fields: ["reportCode", "fightId", "playerId"] },
        },
      },
    );

    await queryInterface.createTable(
      "spec_analysis_metric_data",
      {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        keyId: {
          type: Sequelize.INTEGER,
          references: {
            model: "spec_analysis_metric_key",
            key: "id",
          },
          allowNull: false,
        },
        metricId: {
          type: Sequelize.INTEGER,
          allowNull: false,
        },
        metricValue: {
          type: Sequelize.FLOAT,
          allowNull: false,
        },
      },
      {
        uniqueKeys: {
          UniqueMetric: { fields: ["keyId", "metricId"] },
        },
      },
    );
  },

  async down(queryInterface, Sequelize) {
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */
    await queryInterface.dropTable("spec_analysis_metric_data");
    await queryInterface.dropTable("spec_analysis_metric_key");
  },
};
