import fp from "fastify-plugin";

export const CACHE_ONE_WEEK = 604800;

export const cacheControl = fp<{ cacheDuration?: number }>(
  async (app, options) => {
    app.addHook("onSend", async (_req, reply, payload) => {
      if (reply.statusCode >= 299) {
        // do not cache errors or redirects
        reply.header("cache-control", "no-cache");
      } else {
        reply.header(
          "cache-control",
          `max-age=${options.cacheDuration ?? CACHE_ONE_WEEK}`,
        );
      }
      return payload;
    });
  },
);
