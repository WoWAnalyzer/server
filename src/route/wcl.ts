import { FastifyPluginAsync } from "fastify";
import * as api from "../wcl/api.ts";
import * as cache from "../cache.ts";
import { gql } from "graphql-request";
import * as zlib from "node:zlib";

type ReportParams = { code: string };
type FightsQuery = { translate?: string; _?: string };
type EventsQuery = {
  translate?: string;
  _?: string;
  start: string;
  end: string;
  actorid?: string;
  filter?: string;
};

type WclProxy<T> = { Params: ReportParams; Querystring: T };

const fightQuery = gql`
  query getFights($code: String, $translate: Boolean) {
    reportData {
      report(code: $code) {
        title
        start: startTime
        end: endTime
        owner {
          id
          name
        }

        zone {
          id
        }

        region {
          slug
        }

        exportedCharacters: rankedCharacters {
          id
          name
          server {
            slug
            region {
              slug
            }
          }
        }

        masterData(translate: $translate) {
          lang
          logVersion
          gameVersion

          actors {
            id
            name
            guid: gameID
            petOwner
            type
            subType
          }
        }

        fights(translate: $translate, killType: Encounters) {
          id
          start_time: startTime
          end_time: endTime
          boss: encounterID
          originalBoss: originalEncounterID
          name
          size
          difficulty
          kill
          bossPercentage
          fightPercentage
          hardModeLevel
          friendlyPlayers
          friendlyPets {
            id
            instanceCount
          }
          friendlyNPCs {
            id
          }
          enemyPlayers
          enemyPets {
            id
          }
          enemyNPCs {
            id
          }
          dungeonPulls {
            id
            boss: encounterID
            start_time: startTime
            end_time: endTime
            kill
          }
          phases: phaseTransitions {
            id
            startTime
          }
        }

        phases {
          boss: encounterID
          separatesWipes
          phases {
            id
            name
            isIntermission
          }
        }
      }
    }
  }
`;

// TODO: migrate useAbilityIDs to true.
// requires frontend changes, but means we no longer need to compress the event response (probably)
const eventQuery = gql`
  query getEvents(
    $code: String!
    $translate: Boolean!
    $startTime: Float!
    $endTime: Float!
    $playerId: Int
    $filter: String
  ) {
    reportData {
      report(code: $code) {
        events(
          startTime: $startTime
          endTime: $endTime
          translate: $translate
          sourceID: $playerId
          filterExpression: $filter
          includeResources: true
          useAbilityIDs: false
        ) {
          data
          nextPageTimestamp
        }
      }
    }
  }
`;

interface Actor {
  id: number;
  name: string;
  guid?: number;
  petOwner?: number;
  type: string;
  subType: string;
}

type ActorId = Pick<Actor, "id">;

interface FightData {
  reportData: {
    report: {
      reportArchiveStatus: string;
      title: string;
      owner: { id: number; name: string };
      start: number;
      end: number;

      masterData: {
        lang: string;
        logVersion: number;
        gameVersion: number;
        actors: Array<Actor>;
      };
      region: { slug: string };

      zone: { id: number };
      exportedCharacters: Array<{
        id: number;
        name: string;
        server: { slug: string; region: { slug: string } };
      }>;

      fights: Array<
        WCLFight & {
          friendlyPlayers?: number[];
          friendlyPets?: (ActorId & { instanceCount: number })[];
          friendlyNPCs?: ActorId[];
          enemyPlayers?: number[];
          enemyPets?: ActorId[];
          enemyNPCs?: ActorId[];
        }
      >;
      phases: Array<{
        boss: number;
        separatesWipes: boolean;
        phases: Array<{
          id: number;
          name: string;
          isIntermission: boolean;
        }>;
      }>;
    };
  };
}

interface EventData {
  reportData: {
    report: {
      events: {
        data: unknown[];
        nextPageTimestamp?: number;
      };
    };
  };
}

interface WCLDungeonPull {
  id: number;
  boss: number;
  start_time: number;
  end_time: number;
  name: string;
  kill?: boolean;
  enemies?: number[][];
}

interface WCLReportPhases {
  boss: number;
  separatesWipes: boolean;
  /**
   * Phase names.
   */
  phases: Record<number, string>;
  intermissions?: number[];
}

interface WCLFight {
  id: number;
  start_time: number;
  end_time: number;
  boss: number;
  /**
   * Set on fast wipe pulls (e.g. resets) and on trash "RP" fights when `boss`
   * has been overridden to 0.
   */
  originalBoss?: number;
  name: string;
  size?: number;
  difficulty?: number;
  kill?: boolean;
  bossPercentage?: number;
  fightPercentage?: number;
  hardModeLevel?: number;
  dungeonPulls?: WCLDungeonPull[];
  phases?: WCLPhaseTransition[];
}

interface WCLPhaseTransition {
  /**
   * The id of the phase. 1-indexed, names are stored in `WCLReport.phases`.
   */
  id: number;
  startTime: number;
}

export interface WCLReport {
  fights: WCLFight[];
  lang: string;
  friendlies: Actor[];
  enemies: Actor[];
  friendlyPets: (Actor & { fights: { id: number; instanceCount: number }[] })[];
  enemyPets: Actor[];
  phases?: WCLReportPhases[];
  logVersion: number;
  gameVersion: number;
  title: string;
  owner: string;
  start: number;
  end: number;
  zone: number;
  exportedCharacters?: Array<{
    id: number;
    name: string;
    region: string;
    server: string;
  }>;
}

function reportDataCompat({ reportData: { report } }: FightData): WCLReport {
  const friendlies = new Set<Actor>(),
    friendlyPets = new Map<
      number,
      Actor & { fights: { id: number; instanceCount: number }[] }
    >(),
    enemies = new Set<Actor>(),
    enemyPets = new Set<Actor>();
  const actorsById = Object.fromEntries(
    report.masterData.actors.map((actor) => [actor.id, actor]),
  );

  for (const fight of report.fights) {
    (fight.friendlyPlayers ?? [])
      .concat(fight.friendlyNPCs?.map(({ id }) => id) ?? [])
      .forEach((actor) => friendlies.add(actorsById[actor]));
    fight.friendlyPets?.forEach((pet) => {
      const actual = friendlyPets.has(pet.id)
        ? friendlyPets.get(pet.id)
        : friendlyPets
            .set(pet.id, {
              ...actorsById[pet.id],
              fights: [],
            })
            .get(pet.id);

      actual?.fights.push({
        id: fight.id,
        instanceCount: pet.instanceCount,
      });
    });
    (fight.enemyPlayers ?? [])
      .concat(fight.enemyNPCs?.map(({ id }) => id) ?? [])
      .forEach((actor) => enemies.add(actorsById[actor]));
    fight.enemyPets?.forEach((pet) => enemyPets.add(actorsById[pet.id]));
  }

  return {
    ...report,
    phases: report.phases.map(({ boss, phases, separatesWipes }) => ({
      boss,
      phases: phases.map(({ name }) => name),
      intermissions: phases
        .filter(({ isIntermission }) => isIntermission)
        .map(({ id }) => id),
      separatesWipes,
    })),
    owner: report.owner.name,
    lang: report.masterData.lang,
    logVersion: report.masterData.logVersion,
    gameVersion: report.masterData.gameVersion,
    friendlies: Array.from(friendlies),
    enemies: Array.from(enemies),
    friendlyPets: Array.from(friendlyPets.values()),
    enemyPets: Array.from(enemyPets),
    zone: report.zone.id,
    exportedCharacters: report.exportedCharacters?.map(
      ({ server, ...rest }) => ({
        ...rest,
        server: server.slug,
        region: server.region.slug,
      }),
    ),
  };
}

async function compress(data: string): Promise<string> {
  return new Promise((cb, err) => {
    zlib.deflate(data, (error, value) => {
      if (error) {
        return err(error);
      }
      return cb(value.toString("base64"));
    });
  });
}

async function decompress(data: string): Promise<unknown> {
  return new Promise((cb, err) => {
    zlib.inflate(Buffer.from(data, "base64"), (error, value) => {
      if (error) {
        return err(error);
      } else {
        return cb(value.toString());
      }
    });
  });
}

const wcl: FastifyPluginAsync = async (app) => {
  app.get<WclProxy<FightsQuery>>(
    "/i/v1/report/fights/:code",
    async (req, reply) => {
      const translate = req.query.translate !== "false";
      const cacheKey = `wcl-fights-${req.params.code}-${translate}`;
      const thunk = async () => {
        const rawData = await api.query<
          FightData,
          { code: string; translate: boolean }
        >(fightQuery, {
          code: req.params.code,
          translate,
        });
        return reportDataCompat(rawData);
      };
      try {
        if (req.query._) {
          const data = await thunk();
          cache.set(cacheKey, data);
          return reply.send(data);
        } else {
          const data = await cache.remember(cacheKey, thunk);

          return reply.send(data);
        }
      } catch (error) {
        console.error(error);
        // TODO handle error
        return reply.code(500).send({
          message: error instanceof Error ? error.message : "unknown",
        });
      }
    },
  );

  app.get<WclProxy<EventsQuery>>(
    "/i/v1/report/events/:code",
    async (req, reply) => {
      const translate = req.query.translate !== "false";
      const cacheKey = `wcl-events-${req.params.code}-${Object.entries(
        req.query,
      )
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([key, val]) => `${key}=${val}`)
        .join("-")}`;

      const thunk = async () => {
        const rawData = await api.query<
          EventData,
          {
            code: string;
            translate: boolean;
            startTime: number;
            endTime: number;
            playerId?: number;
            filter?: string;
          }
        >(eventQuery, {
          code: req.params.code,
          translate,
          startTime: Number(req.query.start),
          endTime: Number(req.query.end),
          playerId: req.query.actorid ? Number(req.query.actorid) : undefined,
          filter: req.query.filter,
        });
        const { data: events, nextPageTimestamp } =
          rawData.reportData.report.events;
        const data = {
          events: events,
          nextPageTimestamp,
          count: events.length,
        };

        return compress(JSON.stringify(data));
      };

      try {
        if (req.query._) {
          const data = await thunk();
          cache.set(cacheKey, data);
          return reply.send(await decompress(data));
        } else {
          const data = await cache.remember(cacheKey, thunk);

          return reply.send(data ? await decompress(data) : undefined);
        }
      } catch (error) {
        console.error(error);
        // TODO handle error
        return reply.code(500).send({
          message: error instanceof Error ? error.message : "unknown",
        });
      }
    },
  );
};

export default wcl;
