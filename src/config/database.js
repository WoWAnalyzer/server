const fs = require('fs');

process.env.NODE_ENV = process.env.NODE_ENV || 'development';

const loadDotEnv = require('./env');
const appDirectory = fs.realpathSync(process.cwd());
loadDotEnv(appDirectory);

function config() {
  const env = process.env.NODE_ENV;

  return {
    host: process.env.MYSQL_HOST,
    port: process.env.MYSQL_PORT,
    username: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_ROOT_PASSWORD,
    dialect: process.env.MYSQL_DIALECT,
    database: process.env.MYSQL_DATABASE,

    // Sequelize defaults
    define: {
      timestamps: false, // I prefer manual control
      freezeTableName: true, // naming pattern: table name should reflect 1 entry (so it matches 1 instance of a model)
    },
    logging: false, // I prefer to do my own logging
  };
}

module.exports = config();
