import { wrapEndpoint } from "./common";
import * as api from "../../wcl/api";
import { gql } from "graphql-request";
import {
  Actor,
  ActorId,
  ReportEnemy,
  ReportPet,
  ReportPlayer,
  WCLFight,
  WCLReport,
  WithFights,
} from "./v1-types";

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
            icon
          }
        }

        fights(translate: $translate) {
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
            instanceCount
          }
          enemyPlayers
          enemyPets {
            id
            groupCount
            instanceCount
          }
          enemyNPCs {
            id
            groupCount
            instanceCount
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
          friendlyNPCs?: (ActorId & { instanceCount: number })[];
          enemyPlayers?: number[];
          enemyPets?: Enemy[];
          enemyNPCs?: Enemy[];
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

type Enemy = ActorId & { instanceCount: number; groupCount: number };

type ActorKind =
  | "friendlyPlayers"
  | "friendlyPets"
  | "friendlyNPCs"
  | "enemyPlayers"
  | "enemyPets"
  | "enemyNPCs";

type ActorType = {
  friendlyPlayers: ReportPlayer;
  friendlyPets: ReportPet;
  friendlyNPCs: ReportPet;
  enemyPlayers: ReportPlayer;
  enemyPets: ReportEnemy;
  enemyNPCs: ReportEnemy;
};

type ActorInput<T extends ActorKind> = Required<
  FightData["reportData"]["report"]["fights"][number]
>[T][number];
type ActorAppender<T extends ActorKind> = (
  v: ActorInput<T>,
  actor: ActorType[T],
) => void;

const mapEnemy: ActorAppender<"enemyNPCs" | "enemyPets"> = (input, actor) => {
  actor.fights.push({
    id: input.id,
    instances: input.instanceCount,
    groups: input.groupCount,
  });
};

const mapPet: ActorAppender<"friendlyPets"> = (input, actor) => {
  actor.fights.push({
    id: input.id,
    instances: input.instanceCount,
  });
};

function withFights<T extends ActorKind>(
  report: FightData["reportData"]["report"],
  kind: T,
  appender: ActorAppender<T>,
): Array<ActorType[T]> {
  const result: Map<number, ActorType[typeof kind]> = report.masterData.actors
    .map((actor) => ({
      ...actor,
      fights: [],
    }))
    .reduce((map, actor) => map.set(actor.id, actor), new Map());

  for (const fight of report.fights) {
    const data = fight[kind];
    if (!data) {
      continue;
    }

    data.forEach((entry) => {
      const id = typeof entry === "number" ? entry : entry.id;
      const actor = result.get(id);
      if (!actor) {
        return;
      }
      appender(entry, actor);
    });
  }

  return Array.from(result.values()).filter((v) => v.fights.length > 0);
}

function reportDataCompat({ reportData: { report } }: FightData): WCLReport {
  return {
    ...report,
    fights: report.fights.map(
      ({ bossPercentage, fightPercentage, ...fight }) => {
        // the v2 api presents these on a 0-100 scale, but the v1 api uses 0-10000
        if (bossPercentage !== undefined) {
          (fight as WCLFight).bossPercentage = bossPercentage * 100;
        }
        if (fightPercentage !== undefined) {
          (fight as WCLFight).fightPercentage = fightPercentage * 100;
        }

        return fight;
      },
    ),
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
    friendlies: withFights(report, "friendlyPlayers", (id, actor) => {
      actor.fights.push({ id });
      return actor;
    }).map(({ subType, ...actor }) => ({
      ...actor,
      // in the v2 API, type is the top-level actor type (Player, NPC, Pet, etc), while subType is the class. in the old API the player list put the class in the "type" field
      type: subType,
      subType: "",
    })),
    enemies: withFights(report, "enemyNPCs", mapEnemy),
    friendlyPets: withFights(report, "friendlyPets", mapPet),
    enemyPets: withFights(report, "enemyPets", mapEnemy),
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
const fights = wrapEndpoint(
  "/i/v1/report/fights/:code",
  "wcl-fights",
  async (req) => {
    const rawData = await api.query<
      FightData,
      { code: string; translate: boolean }
    >(fightQuery, {
      code: req.params.code,
      translate: req.query.translate !== "false",
    });
    return reportDataCompat(rawData);
  },
);

export default fights;
