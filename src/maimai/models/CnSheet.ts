import { DataTypes } from 'sequelize';
import sequelize from './sequelize';

const CnSheet = sequelize.define('CnSheet', {
  songId: {
    type: DataTypes.STRING,
    primaryKey: true,
  },
  type: {
    type: DataTypes.STRING,
    primaryKey: true,
  },
  difficulty: {
    type: DataTypes.STRING,
    primaryKey: true,
  },
});

export default CnSheet;
