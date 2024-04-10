import * as blizzard from "../blizzard/api";

type Item = {
  id: number;
  name: string;
  icon: string | undefined;
};

export async function get(
  id: number,
  regionCode: string,
): Promise<Item | undefined> {
  if (!blizzard.isSupportedRegion(regionCode)) {
    return undefined;
  }
  const [item, media] = await Promise.all([
    blizzard.fetchItem(id, regionCode),
    blizzard.fetchItemMedia(id, regionCode),
  ]);

  if (!item || !media) {
    return undefined;
  }

  const locale = blizzard.getLocale(regionCode);

  return {
    id,
    name:
      item.name[locale] ?? item.name[blizzard.getLocale(blizzard.Region.US)]!,
    icon: media.assets.find((asset) => asset.key === "icon")?.value,
  };
}
