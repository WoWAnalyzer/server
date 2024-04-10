import { FastifyPluginAsync } from "fastify";

const externalLinks: FastifyPluginAsync = async (app) => {
  app.get("/discord", (_req, reply) =>
    reply.redirect(307, "https://discord.gg/AxphPxU"),
  );
  app.get("/github", (_req, reply) =>
    reply.redirect(307, "https://github.com/WoWAnalyzer/WoWAnalyzer"),
  );
  app.get("/patreon", (_req, reply) =>
    reply.redirect(307, "https://www.patreon.com/join/wowanalyzer"),
  );
};
export default externalLinks;
