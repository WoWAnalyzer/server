import { wrapEndpoint } from "./common";
import * as api from "../../wcl/api";
import { gql } from "graphql-request";
import { Actor, ActorId, WCLFight, WCLReport } from "./v1-types";

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
    friendlies: Array.from(friendlies).map(({ subType, ...actor }) => ({
      ...actor,
      // in the v2 API, type is the top-level actor type (Player, NPC, Pet, etc), while subType is the class. in the old API the player list put the class in the "type" field
      type: subType,
      subType: "",
    })),
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
