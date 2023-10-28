module.exports = {
  up: ({context: queryInterface}) => {
    return Promise.all([
      queryInterface.sequelize.query('ALTER TABLE `Character` CHANGE COLUMN `realm` `realm` VARCHAR(255) NOT NULL COLLATE \'utf8mb4_general_ci\''),
      queryInterface.sequelize.query('ALTER TABLE `Character` CHANGE COLUMN `name` `name` VARCHAR(255) NOT NULL COLLATE \'utf8mb4_general_ci\''),
    ]);
  },

  down: ({context: queryInterface}) => {
    return Promise.all([
      queryInterface.sequelize.query('ALTER TABLE `Character` CHANGE COLUMN `realm` `realm` VARCHAR(255) NOT NULL COLLATE \'latin1_general_cs\''),
      queryInterface.sequelize.query('ALTER TABLE `Character` CHANGE COLUMN `name` `name` VARCHAR(255) NOT NULL COLLATE \'latin1_general_cs\''),
    ]);
  },
};
