import { Umzug, SequelizeStorage } from "umzug";

import db from "../src/db";

const umzug = new Umzug({
  migrations: { glob: "migrations/*.js" },
  context: db.getQueryInterface(),
  storage: new SequelizeStorage({ sequelize: db }),
  logger: console,
});

(async () => {
await umzug.up();

})();
