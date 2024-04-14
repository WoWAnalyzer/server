import { FastifyPluginAsync } from "fastify";
import fights from "./wcl/fights";
import events, { eventsByType } from "./wcl/events";
import tables from "./wcl/tables";
import graph from "./wcl/graph";
import parses from "./wcl/character-parses";
import encounterRankings from "./wcl/encounter-rankings";
import { cacheControl } from "../common/cache-control";
import guildReports from "./wcl/guild-reports";

const wcl: FastifyPluginAsync = async (app) => {
  app.register(cacheControl);
  fights(app);
  events(app);
  eventsByType(app);
  tables(app);
  graph(app);
  parses(app);
  encounterRankings(app);
  guildReports(app);
};

export default wcl;
