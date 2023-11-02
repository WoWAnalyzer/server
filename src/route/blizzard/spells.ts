import { gql } from "graphql-request";
import * as wclApi from "../../wcl/api";

export type Spell = {
  id: number;
  name: string;
  icon: string;
};

const spellQuery = gql`
  query getSpell($id: Int) {
    gameData {
      ability(id: $id) {
        id
        name
        icon
      }
    }
  }
`;

export async function get(id: number): Promise<Spell | undefined> {
  const data = await wclApi.query<
    { gameData: { ability?: Spell } },
    { id: number }
  >(spellQuery, { id });
  return data.gameData.ability;
}
