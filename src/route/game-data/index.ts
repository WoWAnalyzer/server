import { FastifyPluginAsync } from "fastify";
import * as cache from "../../cache";
import * as spellData from "./spells";
import * as itemData from "./items";

export const spells: FastifyPluginAsync = async (app) => {
  app.get<{ Params: { id: string } }>(
    "/i/spell/:id([0-9]+)",
    async (req, reply) => {
      const { id } = req.params;
      const cacheKey = `spell-${id}`;
      const value = await cache.remember(cacheKey, () =>
        spellData.get(Number.parseInt(id)),
      );

      if (value) {
        return reply.send(value);
      } else {
        return reply.code(404).send();
      }
    },
  );
};

export const items: FastifyPluginAsync = async (app) => {
  app.get<{ Params: { id: string } }>(
    "/i/item/:id([0-9]+)",
    async (req, reply) => {
      const { id } = req.params;
      const cacheKey = `item-${id}`;
      const value = await cache.remember(cacheKey, () =>
        itemData.get(Number.parseInt(id), "US"),
      );

      if (value) {
        return reply.send(value);
      } else {
        return reply.code(404).send();
      }
    },
  );
};
