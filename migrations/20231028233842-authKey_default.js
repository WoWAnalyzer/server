'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.sequelize.query("alter table `User` alter `authKey` set default ''");
    await queryInterface.sequelize.query("alter table `User` drop constraint `authKey`");
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.sequelize.query("alter table `User` alter `authKey` drop default")
    await queryInterface.sequelize.query("alter table `User` add constraint `authKey` unique (`authKey`)");
  }
};
