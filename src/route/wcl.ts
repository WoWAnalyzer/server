import { FastifyPluginAsync } from "fastify";
import fights from "./wcl/fights";
import events from "./wcl/events";
import tables from "./wcl/tables";
import graph from "./wcl/graph";
import parses from "./wcl/character-parses";
import encounterRankings from "./wcl/encounter-rankings";

const wcl: FastifyPluginAsync = async (app) => {
  fights(app);
  events(app);
  tables(app);
  graph(app);
  parses(app);
  encounterRankings(app);
};

export default wcl;
