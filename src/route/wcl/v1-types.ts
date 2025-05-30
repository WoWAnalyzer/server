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
  friendlies: ReportPlayer[];
  enemies: ReportEnemy[];
  friendlyPets: ReportPet[];
  enemyPets: ReportPet[];
  phases?: WCLReportPhases[];
  logVersion: number;
  gameVersion: number;
  title: string;
  owner?: string;
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

type ActorFight = { id: number; instances: number; groups: number };

export type WithFights<T, K extends keyof ActorFight = keyof ActorFight> = T & {
  fights: Array<Pick<ActorFight, K>>;
};

export type ReportPet = WithFights<Actor, "id" | "instances">;
export type ReportEnemy = WithFights<Actor>;
export type ReportPlayer = WithFights<Actor, "id">;

export type ActorId = Pick<Actor, "id">;
