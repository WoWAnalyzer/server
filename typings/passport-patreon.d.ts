import { StrategyOption } from "passport-github";
import type {
  Strategy as OAuthStrategy,
  VerifyFunction,
} from "passport-oauth2";

declare module "passport-patreon" {
  export type PatreonOptions = Omit<
    StrategyOption,
    "authorizationURL" | "tokenURL"
  > & { skipUserProfile?: boolean };
  export class Strategy extends OAuthStrategy {
    constructor(options: PatreonOptions, verify: VerifyFunction);
  }
}
