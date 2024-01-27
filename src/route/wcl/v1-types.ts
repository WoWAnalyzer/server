/**
 * Types representing the old v1 object structures to help porting from v1 to v2 transparently.
 * @module
 */

export interface WCLDungeonPull {
  id: number;
  boss: number;
  start_time: number;
  end_time: number;
  name: string;
  kill?: boolean;
  enemies?: number[][];
}

export interface WCLReportPhases {
  boss: number;
  separatesWipes: boolean;
  /**
   * Phase names.
   */
  phases: Record<number, string>;
  intermissions?: number[];
}

export interface WCLFight {
  id: number;
  start_time: number;
  end_time: number;
  boss: number;
  /**
   * Set on fast wipe pulls (e.g. resets) and on trash "RP" fights when `boss`
   * has been overridden to 0.
   */
  originalBoss?: number;
  name: string;
  size?: number;
  difficulty?: number;
  kill?: boolean;
  bossPercentage?: number;
  fightPercentage?: number;
  hardModeLevel?: number;
  dungeonPulls?: WCLDungeonPull[];
  phases?: WCLPhaseTransition[];
}

export interface WCLPhaseTransition {
  /**
   * The id of the phase. 1-indexed, names are stored in `WCLReport.phases`.
   */
  id: number;
  startTime: number;
}

export interface WCLReport {
  fights: WCLFight[];
  lang: string;
  friendlies: Actor[];
  enemies: Actor[];
  friendlyPets: (Actor & { fights: { id: number; instanceCount: number }[] })[];
  enemyPets: Actor[];
  phases?: WCLReportPhases[];
  logVersion: number;
  gameVersion: number;
  title: string;
  owner: string;
  start: number;
  end: number;
  zone: number;
  exportedCharacters?: Array<{
    id: number;
    name: string;
    region: string;
    server: string;
  }>;
}

export interface Actor {
  id: number;
  name: string;
  guid?: number;
  petOwner?: number;
  type: string;
  subType: string;
  icon?: string;
}

export type ActorId = Pick<Actor, "id">;
