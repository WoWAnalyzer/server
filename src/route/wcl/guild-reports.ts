import { wrapEndpoint } from "./common";
import * as api from "../../wcl/api";
import { gql } from "graphql-request";
import { GameType } from "../../wcl/api";

interface Input {
  id: string;
  title: string;
  start: number;
  end: number;
  zone?: { id: number };
  owner: { name: string };
}

interface Output {
  id: string;
  title: string;
  owner: string;
  zone: number;
  start: number;
  end: number;
}

interface QueryData {
  reportData: {
    reports: {
      data: Input[];
    };
  };
}

const mapReportData = ({ zone, owner, ...input }: Input): Output => ({
  ...input,
  zone: zone?.id ?? 0,
  owner: owner.name,
});

const query = gql`
  query getGuildReports(
    $region: String!
    $server: String!
    $name: String!
    $start: Float
  ) {
    reportData {
      reports(
        guildName: $name
        guildServerSlug: $server
        guildServerRegion: $region
        startTime: $start
      ) {
        data {
          id: code
          start: startTime
          end: endTime
          title
          zone {
            id
          }
          owner {
            name
          }
        }
      }
    }
  }
`;

const guildReports = wrapEndpoint<{
  translate?: string;
  _?: string;
  start?: string;
  game?: string;
}>(
  "/i/v1/reports/guild/:name/:server/:region",
  "wcl-reports",
  async (req) => {
    const rawData: QueryData = await api.query(
      query,
      {
        ...req.params,
        start: Number(req.query.start),
      },
      req.user?.data.wcl?.accessToken,
      req.query.game === "classic" ? GameType.Classic : GameType.Retail
    );

    return rawData.reportData.reports.data.map(mapReportData);
  },
  false,
  12 * 60 * 60, // only cache reports for 12 hours
);

export default guildReports;
