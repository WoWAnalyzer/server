import * as zlib from "node:zlib";
import * as crypto from "node:crypto";
import { FastifyInstance, FastifyRequest } from "fastify";
import * as cache from "../../cache.ts";

export type WclProxy<T, P = ReportParams> = { Params: P; Querystring: T };
export type ReportParams = { code: string };

export async function queryKey(data: Record<string, unknown>): Promise<string> {
  const hasher = crypto.createHash("sha256");
  const encoded = Object.entries(data)
    .filter(([k]) => k !== "_")
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, val]) => `${key}=${val}`)
    .join("-");
  hasher.update(encoded);

  return hasher.digest("hex");
}

export function camelCase(type: string): string {
  return type
    .split("-")
    .map((t) => t[0].toUpperCase() + t.slice(1))
    .join("");
}

export async function compress(data: string): Promise<string> {
  return new Promise((cb, err) => {
    zlib.deflate(data, (error, value) => {
      if (error) {
        return err(error);
      }
      return cb(value.toString("base64"));
    });
  });
}

export async function decompress(data: string): Promise<unknown> {
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

/**
 * Wrap a request to WCL in a caching & compression layer.
 */
export function wrapEndpoint<
  Q extends { translate?: string; _?: string },
  P = ReportParams,
>(
  url: string,
  keyPrefix: string,
  thunk: (req: FastifyRequest<WclProxy<Q, P>>) => Promise<unknown>,
  compressed = false,
  timeout: number | undefined = undefined,
) {
  return (app: FastifyInstance) =>
    app.get<WclProxy<Q, P>>(url, async (req, reply) => {
      const cacheKey = `${keyPrefix}-${await queryKey(
        req.params as ReportParams & P,
      )}-${await queryKey(req.query as Q)}`;

      try {
        if ((req.query as Q)._) {
          const data = await thunk(req);
          if (data) {
            cache.set(cacheKey, data, timeout);
            return reply.send(
              compressed ? await decompress(data as string) : data,
            );
          } else {
            return reply.send(404);
          }
        } else {
          const data = await cache.remember(
            cacheKey,
            thunk.bind(null, req),
            timeout,
          );

          if (data) {
            return reply.send(
              compressed ? await decompress(data as string) : data,
            );
          } else {
            return reply.send(404);
          }
        }
      } catch (error) {
        console.error(error);
        // TODO handle error
        return reply.code(500).send({
          message: error instanceof Error ? error.message : "unknown",
        });
      }
    });
}
