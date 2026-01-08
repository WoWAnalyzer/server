import { ReportParams, wrapEndpoint } from "./common";
import * as api from "../../wcl/api";
import { gql } from "graphql-request";

type PlayerDetailsResponse = {
  reportData: {
    report: {
      playerDetails: {
        data: {
          playerDetails: {
            tanks?: PlayerDetailsPlayer[];
            dps?: PlayerDetailsPlayer[];
            healers?: PlayerDetailsPlayer[];
          };
        };
      };
    };
  };
};

type PlayerDetailsPlayer = {
  name: string;
  id: number;
  guid: number;
  type: string;
  server: string;
  region: string;
  icon: string;
  minItemLevel?: number;
  maxItemLevel?: number;
  specs: Array<{ spec: string; count: number }>;
  combatantInfo?: {
    specIDs: number[];
  };
};

type PlayerDetails = {
  id: number;
  name: string;
  server: string;
  region: string;
  ilvl?: number;
  className: string;
  specName?: string;
  specID?: number;
  role: "tank" | "dps" | "healer";
  guid: number;
};

function extractPlayerDetails(
  player: PlayerDetailsPlayer,
  role: "dps" | "tanks" | "healers",
): PlayerDetails {
  return {
    id: player.id,
    name: player.name,
    server: player.server,
    region: player.region,
    // since we are only querying a single fight, min = max
    ilvl: player.minItemLevel,
    className: player.type,
    specName: player.specs[0]?.spec,
    specID: player.combatantInfo?.specIDs[0],
    role: (role === "dps" ? "dps" : role.slice(0, -1)) as PlayerDetails["role"],
    guid: player.guid,
  };
}

const playerDetailsQuery = gql`
  query getPlayerDetails($code: String, $fight: Int) {
    reportData {
      report(code: $code) {
        playerDetails(fightIDs: [$fight], includeCombatantInfo: true)
      }
    }
  }
`;

const fightPlayers = wrapEndpoint<{}, ReportParams & { fight: string }>(
  "/i/v2/report/:code/fight/:fight/players",
  "wcl-fight-players",
  async (req) => {
    const rawData = await api.query<
      PlayerDetailsResponse,
      { code: string; fight: number }
    >(
      playerDetailsQuery,
      {
        code: req.params.code,
        fight: parseInt(req.params.fight),
      },
      {
        refreshToken: req.user?.data.wcl?.refreshToken,
      },
    );

    const details = rawData.reportData.report.playerDetails.data.playerDetails;

    const result = [];
    for (const key of Object.keys(details) as (keyof typeof details)[]) {
      for (const player of details[key] ?? []) {
        result.push(extractPlayerDetails(player, key));
      }
    }

    return {
      players: result,
    };
  },
);

export default fightPlayers;
