import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
} from "sequelize";
import db from "../db";

type Data = {
  name: string;
  avatar: string;
  wcl: WclData;
};
type WclData = {
  refreshToken: string;
  expiresAt: number;
};

class WclUser extends Model<
  InferAttributes<WclUser>,
  InferCreationAttributes<WclUser>
> {
  declare id: number;
  declare data: Data;
  declare createdAt: CreationOptional<Date>;
  declare lastSeenAt: CreationOptional<Date>;
}

WclUser.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
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

export default WclUser;
