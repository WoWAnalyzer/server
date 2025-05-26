import { gql } from "graphql-request";
import { wrapEndpoint } from "./common";
import * as api from "../../wcl/api";

const query = gql`
  query getEncounterRankings(
    $encounterId: Int!
    $class: String!
    $spec: String!
    $difficulty: Int!
    $metric: CharacterRankingMetricType
    $includeCombatantInfo: Boolean
  ) {
    worldData {
      encounter(id: $encounterId) {
        characterRankings(
          className: $class
          specName: $spec
          difficulty: $difficulty
          metric: $metric
          includeCombatantInfo: $includeCombatantInfo
        )
      }
    }
  }
`;

type Data = {
  worldData: {
    encounter: {
      characterRankings: unknown;
    };
  };
};

const encounterRankings = wrapEndpoint<
  {
    className: string;
    specName: string;
    difficulty: string;
    translate?: string;
    _?: string;
    metric?: string;
    includeCombatantInfo?: string;
  },
  { encounterId: string }
>(
  "/i/v1/rankings/encounter/:encounterId",
  "wcl-encounter-ranks",
  async (req) => {
    const rawData = await api.query<
      Data,
      {
        encounterId: number;
        class: string;
        spec: string;
        difficulty: number;
        metric?: string;
        includeCombatantInfo?: boolean;
      }
    >(
      query,
      {
        encounterId: Number(req.params.encounterId),
        class: req.query.className,
        spec: req.query.specName,
        difficulty: Number(req.query.difficulty),
        metric: req.query.metric,
        includeCombatantInfo: req.query.includeCombatantInfo !== "false",
      },
      req.user?.data.wcl?.accessToken
    );

    return rawData.worldData.encounter.characterRankings;
  },
);

export default encounterRankings;
