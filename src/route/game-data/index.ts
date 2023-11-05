import { FastifyPluginAsync } from "fastify";
import * as cache from "../../cache";
import * as spellData from "./spells";

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
        return reply.code(404);
      }
    },
  );
};
