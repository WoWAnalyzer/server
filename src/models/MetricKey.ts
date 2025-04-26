import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
} from "sequelize";
import db from "../db";

export default class MetricKey extends Model<
  InferAttributes<MetricKey>,
  InferCreationAttributes<MetricKey>
> {
  declare id: CreationOptional<number>;
  declare reportCode: string;
  declare fightId: number;
  declare playerId: number;
  declare configName: string;
  declare analysisTimestamp: number;
}

MetricKey.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    reportCode: {
      type: DataTypes.STRING,
    },
    fightId: {
      type: DataTypes.INTEGER,
    },
    playerId: {
      type: DataTypes.INTEGER,
    },
    configName: {
      type: DataTypes.STRING,
    },
    analysisTimestamp: {
      type: DataTypes.DATE,
    },
  },
  {
    sequelize: db,
    modelName: "spec_analysis_metric_key",
    indexes: [{ unique: true, fields: ["reportCode", "fightId", "playerId"] }],
  },
);
