import { ReportParams, camelCase, wrapEndpoint } from "./common";
import { EventsQuery } from "./events";
import * as api from "../../wcl/api";
import { gql } from "graphql-request";

type GraphQuery = EventsQuery;
const graphQuery = gql`
  query getGraph(
    $code: String!
    $translate: Boolean!
    $startTime: Float!
    $endTime: Float!
    $playerId: Int
    $filter: String
    $type: GraphDataType!
    $abilityId: Float
    $sourceclass: String
    $hostility: HostilityType
  ) {
    reportData {
      report(code: $code) {
        graph(
          translate: $translate
          startTime: $startTime
          endTime: $endTime
          sourceID: $playerId
          filterExpression: $filter
          dataType: $type
          abilityID: $abilityId
          sourceClass: $sourceclass
          hostilityType: $hostility
        )
      }
    }
  }
`;

interface GraphData {
  reportData: {
    report: {
      graph: { data?: unknown };
    };
  };
}

const graph = wrapEndpoint<GraphQuery, ReportParams & { type: string }>(
  "/i/v1/report/graph/:type/:code",
  "wcl-graph",
  async (req) => {
    const rawData = await api.query<
      GraphData,
      {
        code: string;
        translate: boolean;
        startTime: number;
        endTime: number;
        playerId?: number;
        filter?: string;
        type: string;
        abilityId?: number;
        sourceclass?: string;
        hostility?: string;
      }
    >(
      graphQuery,
      {
        code: req.params.code,
        translate: req.query.translate !== "false",
        startTime: Number(req.query.start),
        endTime: Number(req.query.end),
        playerId: req.query.actorid ? Number(req.query.actorid) : undefined,
        filter: req.query.filter,
        type: camelCase(req.params.type),
        abilityId: req.query.abilityid
          ? Number(req.query.abilityid)
          : undefined,
        hostility: req.query.hostility,
        sourceclass: req.query.sourceclass,
      },
      {
        refreshToken: req.user?.data.wcl?.refreshToken,
      }
    );
    const { data } = rawData.reportData.report.graph;
    return data;
  }
);

export default graph;
