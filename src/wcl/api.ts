import { ClientError, request, Variables } from "graphql-request";
import axios from "axios";
import * as cache from "../cache.ts";
import { currentUserQuery, userRefreshTokenKey } from "../route/user/wcl.ts";

async function fetchToken(): Promise<string | undefined> {
  const basicAuth = Buffer.from(
    `${process.env.WCL_CLIENT_ID}:${process.env.WCL_CLIENT_SECRET}`,
  ).toString("base64");
  const response = await axios.postForm(
    `https://www.${process.env.WCL_PRIMARY_DOMAIN}/oauth/token`,
    {
      grant_type: "client_credentials",
    },
    {
      headers: {
        Accept: "application/json",
        Authorization: `Basic ${basicAuth}`,
      },
    },
  );

  return response.data?.access_token;
}

async function getUserToken(userToken: {
  refreshToken?: string;
  accessToken?: string;
}): Promise<string | undefined> {
  if (userToken.accessToken) return userToken.accessToken;
  if (!userToken.refreshToken) return undefined;

  const accessToken = await cache.get<string>(
    await userRefreshTokenKey(userToken.refreshToken),
  );
  return accessToken;
}

async function isValidUserToken(accessToken?: string) {
  if (!accessToken) return;
  try {
    const isValid = await request(
      `https://www.${process.env.WCL_PRIMARY_DOMAIN}/api/v2/user`,
      currentUserQuery,
      {},
      {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Accept-Encoding": "deflate,gzip",
      },
    );
    return Boolean(isValid);
  } catch (error) {}
}

const TOKEN_REFRESH_TIMEOUT = 30_000;
let lastTokenRefreshTime: Date | undefined;
let token: string | undefined = undefined;
async function getToken(force: boolean = false): Promise<string | undefined> {
  if (!force && token) {
    return token;
  }

  // do not allow attempting a token refresh more than once per 30s to avoid the /oauth/token rate limit.
  if (
    token &&
    lastTokenRefreshTime &&
    new Date().getTime() - lastTokenRefreshTime.getTime() <
      TOKEN_REFRESH_TIMEOUT
  ) {
    return token;
  }

  token = await fetchToken();
  return token;
}

export enum ApiErrorType {
  /** The log is private or does not exist. */
  NoSuchLog,
  Unknown,
  Unauthorized,
  TokenRevoked,
  TokenExpired,
  RateLimit,
}

export class ApiError extends Error {
  public readonly type: ApiErrorType;
  public readonly cause: Error;
  constructor(cause: Error, type: ApiErrorType, message?: string) {
    super(message ?? cause.message);
    this.cause = cause;
    this.type = type;
  }
}

export enum GameType {
  Retail,
  Classic,
}

function subdomain(gameType: GameType): string {
  if (gameType === GameType.Classic) {
    return "classic";
  }

  return "www";
}

export async function query<T, V extends Variables>(
  gql: string,
  variables: V,
  userToken?: {
    refreshToken?: string;
    accessToken?: string;
  },
  gameType: GameType = GameType.Retail,
  retries = 1,
): Promise<T> {
  const hasUserToken =
    userToken?.accessToken !== undefined ||
    userToken?.refreshToken !== undefined;
  let token = hasUserToken ? await getUserToken(userToken) : await getToken();

  const requestUrl = `https://${subdomain(gameType)}.${
    process.env.WCL_PRIMARY_DOMAIN
  }/api/v2/${hasUserToken ? "user" : "client"}`;

  const run = () =>
    request<T>(requestUrl, gql, variables, {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Accept-Encoding": "deflate,gzip",
    });
  let data;
  try {
    data = await run();
  } catch (error) {
    if (error instanceof ClientError) {
      if (isPrivateLogError(error)) {
        throw new ApiError(error, ApiErrorType.NoSuchLog);
      }

      if (hasUserToken && !(await isValidUserToken(token))) {
        throw new ApiError(error, ApiErrorType.Unauthorized);
      }
      if (error.response.status === 429) {
        throw new ApiError(
          error,
          ApiErrorType.RateLimit,
          `429 Response accessing "${requestUrl}"`,
        );
      }

      if (
        (error.response.status === 403 || error.response.status === 401) &&
        !hasUserToken &&
        retries > 0
      ) {
        await getToken(true);
        return query(gql, variables, userToken, gameType, 0);
      }
    }

    throw error;
  }

  return data;
}

function isPrivateLogError(error: ClientError): boolean {
  return (
    error.response.errors?.some(
      (err) =>
        err.message === "You do not have permission to view this report.",
    ) === true
  );
}
