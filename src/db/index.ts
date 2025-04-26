import { Sequelize } from "sequelize";
import config from "./config.ts";

if (!config.database) {
  throw new Error("Database configuration is missing");
}

const db = new Sequelize(
  config.database,
  config.username,
  config.password,
  config,
);
export default db;
