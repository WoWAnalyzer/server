import { Client } from "memjs";
import * as env from "./env";

env.setup();

const client = Client.create(undefined, {
  expires: 7 * 24 * 60 * 60,
});

export async function get<T>(key: string): Promise<T | undefined> {
  const result = await client.get(key);
  if (!result.value) {
    return undefined;
  }

  const text = result.value.toString("utf8");
  return JSON.parse(text);
}

export async function set(key: string, value: any): Promise<void> {
  const repr = JSON.stringify(value);
  await client.set(key, repr);
}
