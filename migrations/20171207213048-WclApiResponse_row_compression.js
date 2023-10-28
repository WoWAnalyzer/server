module.exports = {
  async up({ context: queryInterface }) {
    return queryInterface.sequelize.query(
      "ALTER TABLE `WclApiResponse` ENGINE=InnoDB ROW_FORMAT=COMPRESSED KEY_BLOCK_SIZE=16;",
    );
  },
  down({ context: queryInterface }) {
    return queryInterface.sequelize.query(
      "ALTER TABLE `WclApiResponse` ENGINE=InnoDB ROW_FORMAT=DYNAMIC;",
    );
  },
};
