import type { FastifyPluginCallback } from "fastify";

const ad: FastifyPluginCallback = (app, _, done) => {
  app.get("/ads.txt", (req, reply) =>
    reply.redirect(
      301,
      "https://config.playwire.com/dyn_ads/1024476/73270/ads.txt",
    ),
  );
  done();
};

export default ad;
