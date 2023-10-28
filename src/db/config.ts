import { Dialect, Options } from "sequelize";
import * as env from "../env.ts";

env.setup();

const config = {
  host: process.env.MYSQL_HOST,
  port: process.env.MYSQL_PORT ? Number.parseInt(process.env.MYSQL_PORT) : 3306,
  dialect: (process.env.MYSQL_DIALECT as Dialect | undefined) ?? "mariadb",
  username: process.env.MYSQL_USER ?? "root",
  password: process.env.MYSQL_ROOT_PASSWORD,
  database: process.env.MYSQL_DATABASE,

  define: {
    timestamps: false,
    freezeTableName: true,
  },

  logging: false,
} satisfies Options;

export default config;
