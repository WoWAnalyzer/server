import { FastifyPluginAsync } from "fastify";
import * as cache from "../../cache";
import * as api from "./api";

type CharacterParams = {
  id: string;
  region: string;
  realm: string;
  name: string;
};

const cacheKey = (
  { id }: Pick<CharacterParams, "id">,
  section: "retail" | "classic",
  kind: "character" | "guild" = "character",
) => `${kind}-${section}-${id}`;

type Character = {
  id: string;
  region: string;
  realm: string;
  name: string;
  faction: number | null;
  class?: number;
  race?: number;
  gender?: number | null;
  achievementPoints: number;
  thumbnail?: string;
  spec?: string;
  role?: string;
  talents?: {
    code: string;
    nodes: Array<{ id: number; rank: number }>;
  };
};

async function fetchCharacter(
  region: string,
  realm: string,
  name: string,
  isClassic = false,
): Promise<Character | undefined> {
  // await getting base character data before we blast out parallel subset reqs
  const base = await api.fetchCharacterData(region, realm, name, isClassic);

  if (!base) {
    return undefined;
  }

  const [media, specs] = await Promise.all([
    api.fetchCharacterMedia(region, realm, name, isClassic),
    isClassic
      ? Promise.resolve(undefined)
      : api.fetchCharacterSpecializations(region, realm, name, isClassic),
  ]);

  const thumbnailAsset =
    media?.avatar_url ||
    media?.assets?.find((asset) => asset.key === "avatar")?.value;

  const currentSpecName =
    specs?.active_specialization && specs.active_specialization.name;
  const currentSpec = specs?.specializations?.find(
    (it) => it.specialization.name === currentSpecName,
  );

  const activeTree = currentSpec?.loadouts?.find(
    (loadout) => loadout.is_active,
  );

  const result: Character = {
    id: base.id,
    region: region.toLowerCase(),
    realm: base.realm?.name ?? realm,
    name: base.name,
    faction: api.getFactionFromType(base.faction.type),
    class: base.character_class?.id,
    race: base.race?.id,
    gender: base.gender ? api.getCharacterGender(base.gender) : undefined,
    achievementPoints: base.achievement_points,
    thumbnail: thumbnailAsset,
    spec: currentSpecName,
    role: api.getCharacterRole(base.character_class?.name, currentSpecName),
    talents: activeTree
      ? {
          code: activeTree.talent_loadout_code,
          nodes: activeTree.selected_class_talents
            .concat(activeTree.selected_spec_talents)
            .map(({ id, rank }) => ({ id, rank })),
        }
      : undefined,
  };

  return result;
}

type RGBA = [number, number, number, number];

type Guild = {
  id: number;
  region: string;
  realm: string;
  name: string;
  nameSlug: string;
  faction: number | null;
  created: number;
  achievementPoints: number;
  memberCount: number;
  crest?: {
    emblemId: number;
    emblemColor: RGBA;
    borderId: number;
    borderColor: RGBA;
    backgroundColor: RGBA;
  };
};

function convertColor({ rgba }: api.Color): RGBA {
  return [rgba.r, rgba.g, rgba.b, rgba.a];
}

async function fetchGuild(
  region: string,
  realm: string,
  name: string,
  isClassic = false,
): Promise<Guild | undefined> {
  if (!api.isSupportedRegion(region)) {
    return undefined;
  }

  const data = await api.fetchGuild(region, realm, name, isClassic);
  if (!data) {
    return undefined;
  }

  // TODO: classic crest colors are not RGBA, but ids. unclear if we need to care. not providing crest data for now in classic

  return {
    id: data.id,
    region: region.toLowerCase(),
    realm: realm,
    name: data.name,
    nameSlug: name,
    faction: api.getFactionFromType(data.faction.type),
    created: data.created_timestamp,
    achievementPoints: data.achievement_points,
    memberCount: data.member_count,
    crest:
      !isClassic && data.crest
        ? {
            emblemId: data.crest.emblem.id,
            emblemColor: convertColor(data.crest.emblem.color),
            borderId: data.crest.border.id,
            borderColor: convertColor(data.crest.border.color),
            backgroundColor: convertColor(data.crest.background.color),
          }
        : undefined,
  };
}

const EXPIRATION_SECS = 24 * 60 * 60;

// NOTE: these were doing cache-freshening on hits with the old API. do we want to continue doing that?
export const character: FastifyPluginAsync = async (app) => {
  app.get<{ Params: { id: string } }>(
    "/i/character/:id([0-9]+)",
    async (req, reply) => {
      const char = await cache.get(cacheKey(req.params, "retail"));
      if (char) {
        return reply.send(char);
      } else {
        return reply.code(404).send();
      }
    },
  );

  app.get<{ Params: Omit<CharacterParams, "id"> }>(
    "/i/character/:region([A-Z]{2})/:realm([^/]{2,})/:name([^/]{2,})",
    async (req, reply) => {
      const { region, realm, name } = req.params;
      const char = await cache.remember(
        `character-by-name-retail-${region}-${realm}-${name}`,
        async () => {
          return fetchCharacter(region, realm, name);
        },
        EXPIRATION_SECS,
      );

      if (char) {
        return reply.send(char);
      } else {
        return reply.code(404).send();
      }
    },
  );

  app.get<{ Params: CharacterParams }>(
    "/i/character/:id([0-9]+)/:region([A-Z]{2})/:realm([^/]{2,})/:name([^/]{2,})",
    async (req, reply) => {
      const { region, realm, name } = req.params;
      const char = await cache.remember(
        cacheKey(req.params, "retail"),
        async () => {
          return fetchCharacter(region, realm, name);
        },
        EXPIRATION_SECS,
      );

      if (char) {
        return reply.send(char);
      } else {
        return reply.code(404).send();
      }
    },
  );

  app.get<{ Params: CharacterParams }>(
    "/i/character/classic/:id([0-9]+)/:region([A-Z]{2})/:realm([^/]{2,})/:name([^/]{2,})",
    async (req, reply) => {
      const { region, realm, name } = req.params;
      const char = await cache.remember(
        cacheKey(req.params, "classic"),
        async () => {
          return fetchCharacter(region, realm, name, true);
        },
        EXPIRATION_SECS,
      );

      if (char) {
        return reply.send(char);
      } else {
        return reply.code(404).send();
      }
    },
  );
};

export const guild: FastifyPluginAsync = async (app) => {
  app.get<{ Params: CharacterParams }>(
    "/i/guild/:id([0-9]+)/:region([A-Z]{2})/:realm([^/]{2,})/:name([^/]{2,})",
    async (req, reply) => {
      const { region, realm, name } = req.params;
      const guild = await cache.remember(
        cacheKey(req.params, "retail", "guild"),
        async () => fetchGuild(region, realm, name),
        EXPIRATION_SECS,
      );

      if (guild) {
        return reply.send(guild);
      } else {
        return reply.code(404).send();
      }
    },
  );

  app.get<{ Params: CharacterParams }>(
    "/i/guild/classic/:id([0-9]+)/:region([A-Z]{2})/:realm([^/]{2,})/:name([^/]{2,})",
    async (req, reply) => {
      const { region, realm, name } = req.params;
      const guild = await cache.remember(
        cacheKey(req.params, "classic", "guild"),
        async () => fetchGuild(region, realm, name, true),
        EXPIRATION_SECS,
      );

      if (guild) {
        return reply.send(guild);
      } else {
        return reply.code(404).send();
      }
    },
  );
};
