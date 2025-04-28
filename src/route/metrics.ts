import { FastifyPluginAsync } from "fastify";
import MetricKey from "../models/MetricKey";
import { z } from "zod";
import MetricValue from "../models/MetricValue";
import db from "../db";
import { QueryTypes } from "sequelize";
import * as cache from "../cache";

const serverMetrics: FastifyPluginAsync = async (app) => {
  app.post<{ Body: Body }>("/i/v1/server-data", async (req, reply) => {
    const bodyResult = parser.safeParse(req.body);
    if (!bodyResult.success) {
      return reply.status(400).send(bodyResult.error);
    }

    const { selection, serverMetrics } = bodyResult.data;
    const key = await keyId(selection);

    for (const [metricName, metricValue] of Object.entries(serverMetrics)) {
      await storeMetric(key, metricName, metricValue);
    }

    return reply.status(200).send();
  });

  app.get("/i/v1/server-data", async (_req, reply) => {
    const data = await cache.remember(
      "server-data-output",
      async () => {
        const data = await db.query(
          `
      select configName, metricId, min(metricValue) as minValue, median(metricValue) over (partition by configName, metricId) as medValue, avg(metricValue) as avgValue, max(metricValue) as \`maxValue\`
    from spec_analysis_metric_key as k
    join spec_analysis_metric_data data on data.keyId = k.id
    where k.analysisTimestamp >= now() - interval 2 week
    group by configName, metricId;
`,
          { type: QueryTypes.SELECT },
        );
        return (data as Record<string, unknown>[]).map((v) => ({
          ...v,
          metricId: METRIC_NAMES_BY_ID[v.metricId as number],
        }));
      },
      60,
    );

    return reply.header("content-type", "application/json").send(data);
  });
};

export default serverMetrics;

enum Metric {
  CooldownErrorRate = 0,
  UnknownAbilityErrorRate = 1,
  GcdErrorRate = 2,
  ActiveTimeRatio = 3,
}

// Note: sync with `server-metrics.Selection` on the frontend
const parser = z.object({
  selection: z.object({
    reportCode: z.string(),
    fightId: z.number().int(),
    playerId: z.number().int(),
    configName: z.string(),
  }),
  serverMetrics: z.record(z.number()),
});

type Body = z.infer<typeof parser>;

type Selection = Body["selection"];

async function keyId(selection: Selection): Promise<number> {
  // note: the instance actually returned by `upsert` for mysql doesn't have the id on it
  await MetricKey.upsert({
    reportCode: selection.reportCode,
    playerId: selection.playerId,
    fightId: selection.fightId,
    configName: selection.configName,
    analysisTimestamp: Date.now(),
  });

  const instance = await MetricKey.findOne({
    where: {
      reportCode: selection.reportCode,
      playerId: selection.playerId,
      fightId: selection.fightId,
    },
  });

  return instance!.id;
}

async function storeMetric(
  key: number,
  metricName: string,
  metricValue: number,
): Promise<void> {
  const metricId = METRIC_IDS_BY_NAME[metricName];
  if (metricId === undefined) {
    console.log(`not storing metric ${metricName} with value ${metricValue}`);
    return;
  }

  await MetricValue.upsert({
    keyId: key,
    metricId,
    metricValue,
  });
}

const METRIC_IDS_BY_NAME: Record<string, Metric> = {
  cooldownErrorRate: Metric.CooldownErrorRate,
  unknownAbilityErrorRate: Metric.UnknownAbilityErrorRate,
  gcdErrorRate: Metric.GcdErrorRate,
  activeTimeRatio: Metric.ActiveTimeRatio,
};

const METRIC_NAMES_BY_ID = Object.fromEntries(
  Object.entries(METRIC_IDS_BY_NAME).map(([k, v]) => [v, k]),
);
