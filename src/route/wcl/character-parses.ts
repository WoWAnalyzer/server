import { FastifyInstance } from "fastify";
import axios from "axios";
import * as cache from "../../cache";
import * as Sentry from "@sentry/node";
import { shouldSkipCache } from "./common";

// FIXME we cheat on the character parses due to significant changes to the
// response from WCL. specifically: it is not currently possible to get all
// ranks for all zones for all specs in all roles for a single character in
// the v2 api without some pain (aka dynamic query construction).
//
// this is one of the areas that is most likely to get outright replaced as
// we move forward with using the v2 api to get info about your characters,
// reports, guilds, etc so rather than do a lot of legwork to manage this
// change, we just use the v1 API for this call.

type Query = {
  includeCombatantInfo?: string;
  metric: string;
  zone: string;
  timeframe?: string;
  partition?: string;
  game?: "classic" | "retail";
};

const characterParses = (app: FastifyInstance) => {
  app.get<{
    Params: { region: string; server: string; name: string };
    Querystring: Query;
  }>("/i/v1/parses/character/:name/:server/:region", async (req, reply) => {
    const thunk = async () => {
      return (
        await axios.get(
          `https://${
            req.query.game === "classic" ? "classic" : "www"
          }.warcraftlogs.com/v1/parses/character/${req.params.name}/${
            req.params.server
          }/${req.params.region}`,
          {
            params: {
              api_key: process.env.WCL_V1_API_KEY,
              ...req.query,
            },
            headers: {
              Accept: "application/json",
            },
          },
        )
      )?.data;
    };
    let data;
    const cacheKey = `character-parses-${req.params.region}-${req.params.server}-${req.params.name}`;
    if (!shouldSkipCache(req)) {
      data = await cache.remember(cacheKey, thunk);
    } else {
      data = await thunk();
      data && cache.set(cacheKey, data).catch(Sentry.captureException);
    }
    if (data) {
      return reply.send(data);
    } else {
      return reply.status(404).send();
    }
  });
};

export default characterParses;
