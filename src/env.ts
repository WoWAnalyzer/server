import fs from "fs";
import path from "path";
import dotenv from "dotenv";

export function setup(): void {
  const cwd = fs.realpathSync(process.cwd());
  const basePath = path.resolve(cwd, ".env");
  const environment = process.env.NODE_ENV ?? "development";

  const files = [
    `${basePath}.${environment}.local`,
    `${basePath}.${environment}`,
    process.env.NODE_ENV !== "test" && `${basePath}.local`,
    basePath,
  ];

  files
    .filter((file): file is string => !!file && fs.existsSync(file))
    .forEach((file) => dotenv.config({ path: file }));
}
