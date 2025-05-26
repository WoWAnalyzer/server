import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
} from "sequelize";
import db from "../db";

type GitHubData = {
  login: string;
  lastContribution: number | null;
  updatedAt: number;
  accessToken: string;
  refreshToken: string;
};
type PatreonData = {
  pledgeAmount: number | null;
  updatedAt: number;
  accessToken: string;
  refreshToken: string;
};
type WclData = {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
};

interface Data {
  name: string;
  avatar?: string;
  github?: GitHubData;
  patreon?: PatreonData;
  wcl?: WclData;
}

class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
  declare id: CreationOptional<number>;
  declare gitHubId: number | null;
  declare patreonId: number | null;
  declare wclId: number | null;
  declare data: Data;
  declare createdAt: CreationOptional<Date>;
  declare lastSeenAt: CreationOptional<Date>;
}

User.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    gitHubId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    patreonId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    wclId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    data: {
      type: DataTypes.TEXT("long"),
      allowNull: false,
      get(this: Model) {
        return JSON.parse(this.getDataValue("data"));
      },
      set(this: Model, value: Data) {
        this.setDataValue("data", JSON.stringify(value));
      },
    },
    createdAt: {
      type: DataTypes.DATE, // this is actually DATETIME
      defaultValue: DataTypes.NOW,
      allowNull: false,
    },
    lastSeenAt: {
      type: DataTypes.DATE, // this is actually DATETIME
      defaultValue: DataTypes.NOW,
      allowNull: false,
    },
  },
  { sequelize: db }
);

export default User;
