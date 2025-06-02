import * as api from "../../wcl/api";
import { gql } from "graphql-request";
import { ReportParams, camelCase, compress, wrapEndpoint } from "./common";

const EVENT_LIMIT = 20000;

// TODO: migrate useAbilityIDs to true.
// requires frontend changes, but is more efficient
const eventQuery = gql`
  query getEvents(
    $code: String!
    $translate: Boolean!
    $startTime: Float!
    $endTime: Float!
    $playerId: Int
    $filter: String
    $limit: Int!
    $type: EventDataType
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
          limit: $limit
          dataType: $type
        ) {
          data
          nextPageTimestamp
        }
      }
    }
  }
`;
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

export type EventsQuery = {
  translate?: string;
  _?: string;
  start: string;
  end: string;
  actorid?: string;
  filter?: string;
  abilityid?: string;
  hostility?: string;
  sourceclass?: string;
};

const events = wrapEndpoint<EventsQuery>(
  "/i/v1/report/events/:code",
  "wcl-events",
  async (req) => {
    const rawData = await api.query<
      EventData,
      {
        code: string;
        translate: boolean;
        startTime: number;
        endTime: number;
        playerId?: number;
        filter?: string;
        limit: number;
      }
    >(
      eventQuery,
      {
        code: req.params.code,
        translate: req.query.translate !== "false",
        startTime: Number(req.query.start),
        endTime: Number(req.query.end),
        playerId: req.query.actorid ? Number(req.query.actorid) : undefined,
        filter: req.query.filter,
        limit: EVENT_LIMIT,
      },
      {
        refreshToken: req.user?.data.wcl?.refreshToken,
      }
    );
    const { data: events, nextPageTimestamp } =
      rawData.reportData.report.events;
    const data = {
      events: events,
      nextPageTimestamp,
      count: events.length,
    };

    return compress(JSON.stringify(data));
  },
  true
);
export default events;

export const eventsByType = wrapEndpoint<
  EventsQuery,
  ReportParams & { type: string }
>(
  "/i/v1/report/events/:type/:code",
  "wcl-events",
  async (req) => {
    const rawData = await api.query<
      EventData,
      {
        code: string;
        translate: boolean;
        startTime: number;
        endTime: number;
        playerId?: number;
        filter?: string;
        type?: string;
        limit: number;
      }
    >(
      eventQuery,
      {
        type: req.params.type ? camelCase(req.params.type) : undefined,
        code: req.params.code,
        translate: req.query.translate !== "false",
        startTime: Number(req.query.start),
        endTime: Number(req.query.end),
        playerId: req.query.actorid ? Number(req.query.actorid) : undefined,
        filter: req.query.filter,
        limit: EVENT_LIMIT,
      },
      {
        refreshToken: req.user?.data.wcl?.refreshToken,
      }
    );
    const { data: events, nextPageTimestamp } =
      rawData.reportData.report.events;
    const data = {
      events: events,
      nextPageTimestamp,
      count: events.length,
    };

    return compress(JSON.stringify(data));
  },
  true
);
