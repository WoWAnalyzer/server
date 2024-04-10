import { FastifyPluginCallback } from "fastify";

const healthcheck: FastifyPluginCallback = (app, _, done) => {
  app.get("/i/healthcheck", (req, reply) => reply.send());
  done();
};

export default healthcheck;
