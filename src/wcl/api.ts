import { ClientError, request, Variables } from "graphql-request";
import axios from "axios";

async function fetchToken(): Promise<string | undefined> {
  const basicAuth = Buffer.from(
    `${process.env.WCL_CLIENT_ID}:${process.env.WCL_CLIENT_SECRET}`,
  ).toString("base64");
  const response = await axios.postForm(
    `${process.env.WCL_HOST}/oauth/token`,
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

export async function query<T, V extends Variables>(
  gql: string,
  variables: V,
): Promise<T> {
  let token = await getToken();
  const run = () =>
    request<T>(`${process.env.WCL_HOST}/api/v2/client`, gql, variables, {
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
    }

    // blindly attempt to reauthenticate and try again
    token = await getToken(true);
    try {
      data = await run();
    } catch (error) {
      if (error instanceof ClientError) {
        if (isPrivateLogError(error)) {
          throw new ApiError(error, ApiErrorType.NoSuchLog);
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
