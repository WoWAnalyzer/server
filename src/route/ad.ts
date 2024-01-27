import type { FastifyPluginCallback } from "fastify";
import { cacheControl } from "../common/cache-control";

const ad: FastifyPluginCallback = (app, _, done) => {
  app.register(cacheControl);
  app.get("/ads.txt", (req, reply) =>
    reply.redirect(
      301,
      "https://config.playwire.com/dyn_ads/1024476/73270/ads.txt",
    ),
  );
  done();
};

export default ad;
