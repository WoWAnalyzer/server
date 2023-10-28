module.exports = {
  up: ({context: queryInterface}) => {
    return Promise.all([
      queryInterface.sequelize.query('ALTER TABLE `WclApiResponse` CHANGE COLUMN `content` `content` LONGTEXT NOT NULL COLLATE \'utf8_general_ci\''),
    ]);
  },

  down: ({context: queryInterface}) => {
    return Promise.all([
      queryInterface.sequelize.query('ALTER TABLE `WclApiResponse` CHANGE COLUMN `content` `content` LONGTEXT NOT NULL COLLATE \'latin1_general_cs\''),
    ]);
  },
};
