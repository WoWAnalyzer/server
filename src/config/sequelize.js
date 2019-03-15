const Sequelize = require('sequelize');
const config = require('./database.js');

module.exports = new Sequelize(config.database, config.username, config.password, config);
