import fp from "fastify-plugin";

export const CACHE_ONE_WEEK = 604800;

export const cacheControl = fp<{ cacheDuration?: number }>(
  async (app, options) => {
    app.addHook("onSend", async (_req, reply, payload) => {
      reply.header(
        "cache-control",
        `max-age=${options.cacheDuration ?? CACHE_ONE_WEEK}`,
      );
      return payload;
    });
  },
);
