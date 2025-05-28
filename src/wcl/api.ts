import { ClientError, request, Variables } from "graphql-request";
import axios from "axios";
import * as cache from "../cache.ts";
import { currentUserQuery, userRefreshTokenKey } from "../route/user/wcl.ts";

async function fetchToken(): Promise<string | undefined> {
  const basicAuth = Buffer.from(
    `${process.env.WCL_CLIENT_ID}:${process.env.WCL_CLIENT_SECRET}`
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
    }
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
    await userRefreshTokenKey(userToken.refreshToken)
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
      }
    );
    return !!isValid;
  } catch (error) {}
}

// TODO: refresh token
let token: string | undefined = undefined;
async function getToken(force: boolean = false): Promise<string | undefined> {
  if (!force && token) {
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
}

export class ApiError extends Error {
  public readonly type: ApiErrorType;
  public readonly cause: Error;
  constructor(cause: Error, type: ApiErrorType) {
    super(cause.message);
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
  gameType: GameType = GameType.Retail
): Promise<T> {
  const hasUserToken =
    userToken?.accessToken !== undefined ||
    userToken?.refreshToken !== undefined;
  let token = hasUserToken ? await getUserToken(userToken) : await getToken();
  const run = () =>
    request<T>(
      `https://${subdomain(gameType)}.${
        process.env.WCL_PRIMARY_DOMAIN
      }/api/v2/${hasUserToken ? "user" : "client"}`,
      gql,
      variables,
      {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Accept-Encoding": "deflate,gzip",
      }
    );
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
    }

    // blindly attempt to reauthenticate and try again
    token = hasUserToken ? await getUserToken(userToken) : await getToken(true);
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

        // we only use Unknown here after attempting to re-auth to make sure that the re-auth happens
        throw new ApiError(error, ApiErrorType.Unknown);
      }

      throw error;
    }
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
