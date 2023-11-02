import { FastifyPluginAsync } from "fastify";
import * as cache from "../../cache";
import * as api from "./api";
import * as spells from "./spells";

type CharacterParams = {
  id: string;
  region: string;
  realm: string;
  name: string;
};

const cacheKey = (
  { id, region, realm, name }: CharacterParams,
  section: "retail" | "classic",
) => `character-${section}-${id}-${region}-${realm}-${name}`;

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
): Promise<Character | undefined> {
  // await getting base character data before we blast out parallel subset reqs
  const base = await api.fetchCharacterData(region, realm, name);

  if (!base) {
    return undefined;
  }

  const [media, specs] = await Promise.all([
    api.fetchCharacterMedia(region, realm, name),
    api.fetchCharacterSpecializations(region, realm, name),
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

export const character: FastifyPluginAsync = async (app) => {
  app.get<{ Params: CharacterParams }>(
    "/i/character/:id([0-9]+)/:region([A-Z]{2})/:realm([^/]{2,})/:name([^/]{2,})",
    async (req, reply) => {
      const { region, realm, name } = req.params;
      const cached = await cache.get<Character>(cacheKey(req.params, "retail"));
      if (cached) {
        const result = reply.send(cached);
        // dispatch this but don't wait on it.
        // we freshen up the character but don't use the result right now
        fetchCharacter(region, realm, name).then(
          (value) => value && cache.set(cacheKey(req.params, "retail"), value),
        );
        return result;
      }

      const char = await fetchCharacter(region, realm, name);
      if (char) {
        cache.set(cacheKey(req.params, "retail"), char);
        return reply.send(char);
      } else {
        return reply.code(404);
      }
    },
  );

  app.get<{ Params: CharacterParams }>(
    "/i/character/classic/:id([0-9]+)/:region([A-Z]{2})/:realm([^/]{2,})/:name([^/]{2,})",
    async (req, reply) => {},
  );

  app.get<{ Params: { id: string } }>(
    "/i/spell/:id([0-9]+)",
    async (req, reply) => {
      const { id } = req.params;
      const cacheKey = `spell-${id}`;

      const cached = await cache.get<spells.Spell>(cacheKey);
      if (cached) {
        return reply.send(cached);
      }

      const spell = await spells.get(Number.parseInt(id));
      if (spell) {
        cache.set(cacheKey, spell);
        return reply.send(spell);
      } else {
        return reply.code(404);
      }
    },
  );
};
