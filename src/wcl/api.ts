import { request, Variables } from "graphql-request";
import axios from "axios";

async function fetchToken(): Promise<string | undefined> {
  const basicAuth = Buffer.from(
    `${process.env.WCL_CLIENT_ID}:${process.env.WCL_CLIENT_SECRET}`,
  ).toString("base64");
  const response = await axios.postForm(
    "https://www.warcraftlogs.com/oauth/token",
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

export async function query<T, V extends Variables>(
  gql: string,
  variables: V,
): Promise<T> {
  let token = await getToken();
  const run = () =>
    request<T>("https://www.warcraftlogs.com/api/v2/client", gql, variables, {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Accept-Encoding": "deflate,gzip",
    });
  let data;
  try {
    data = await run();
  } catch (error) {
    // TODO: actually check status code
    token = await getToken(true);
    data = await run();
  }

  return data;
}
