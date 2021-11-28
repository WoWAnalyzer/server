module.exports = (sequelize, DataTypes) => {
  return sequelize.define('Guild', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
    },
    region: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    realm: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    nameSlug: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    faction: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    created: {
      // When the guild was actually created, different than database timestamp createdAt
      type: DataTypes.DATE,
      allowNull: false,
    },
    achievementPoints: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    memberCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    crest: {
      type: DataTypes.JSON,
      allowNull: false,
    },
    createdAt: {
      type: DataTypes.DATE, // this is actually DATETIME
      defaultValue: DataTypes.NOW,
      allowNull: false,
    },
    updatedAt: {
      type: DataTypes.DATE, // this is actually DATETIME
      defaultValue: DataTypes.NOW,
      allowNull: false,
    },
  });
};
