import { FastifyReply } from "fastify";
import fp from "fastify-plugin";

export const CACHE_ONE_WEEK = 604800;

export const cacheControl = fp<{ cacheDuration?: number }>(
  async (app, options) => {
    app.addHook("onSend", async (_req, reply, payload) => {
      if (reply.statusCode >= 299) {
        // do not cache errors or redirects
        reply.header("cache-control", "no-cache");
      } else if (!Boolean(reply.getHeader("cache-control"))) {
        // do not override existing cache control headers
        setCacheControlHeader(reply, options.cacheDuration);
      }
      return payload;
    });
  },
);

const getCacheControlHeader = (
  cacheDuration?: number,
  privateCache?: boolean
) => {
  return `max-age=${cacheDuration ?? CACHE_ONE_WEEK}${
    privateCache ? ", private" : ""
  }`;
};

export const setCacheControlHeader = (
  reply: FastifyReply,
  cacheDuration?: number,
  privateCache?: boolean
) => {
  reply.header(
    "cache-control",
    getCacheControlHeader(cacheDuration, privateCache)
  );
};
