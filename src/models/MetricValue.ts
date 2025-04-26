import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
} from "sequelize";
import db from "../db";

export default class MetricValue extends Model<
  InferAttributes<MetricValue>,
  InferCreationAttributes<MetricValue>
> {
  declare id: CreationOptional<number>;
  declare keyId: number;
  declare metricId: number;
  declare metricValue: number;
}

MetricValue.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    keyId: {
      type: DataTypes.INTEGER,
      references: {
        model: "spec_analysis_metric_key",
        key: "id",
      },
    },
    metricId: {
      type: DataTypes.INTEGER,
    },
    metricValue: {
      type: DataTypes.FLOAT,
    },
  },
  {
    sequelize: db,
    indexes: [{ unique: true, fields: ["keyId", "metricId"] }],
    modelName: "spec_analysis_metric_data",
  },
);
