import { gql } from "graphql-request";
import { EventsQuery } from "./events";
import { ReportParams, camelCase, wrapEndpoint } from "./common";
import * as api from "../../wcl/api";

type TableQuery = EventsQuery;

const tableQuery = gql`
  query getTable(
    $code: String!
    $translate: Boolean!
    $startTime: Float!
    $endTime: Float!
    $playerId: Int
    $filter: String
    $type: TableDataType!
    $abilityId: Float
    $sourceclass: String
    $hostility: HostilityType
  ) {
    reportData {
      report(code: $code) {
        table(
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

interface TableData {
  reportData: {
    report: {
      table: { data?: unknown };
    };
  };
}

const tables = wrapEndpoint<TableQuery, ReportParams & { type: string }>(
  "/i/v1/report/tables/:type/:code",
  "wcl-table",
  async (req) => {
    const rawData = await api.query<
      TableData,
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
      tableQuery,
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
      req.user?.data.wcl?.accessToken
    );
    const { data } = rawData.reportData.report.table;
    return data;
  },
);

export default tables;
