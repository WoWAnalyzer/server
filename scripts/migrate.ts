import { Umzug, SequelizeStorage } from "umzug";

import db from "../src/db";
import { Sequelize } from "sequelize";

const down = process.argv.at(-1) === "--down";

const umzug = new Umzug({
  migrations: {
    glob: "migrations/*.js",
    resolve: ({ name, path, context }) => {
      const migration = require(path!);
      return {
        name,
        up: async () => migration.up(context, Sequelize),
        down: async () => migration.down(context, Sequelize),
      };
    },
  },
  context: db.getQueryInterface(),
  storage: new SequelizeStorage({ sequelize: db }),
  logger: console,
});

(async () => {
  if (down) {
    await umzug.down();
  } else {
    await umzug.up();
  }
})();
