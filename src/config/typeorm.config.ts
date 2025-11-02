import { DataSource, DataSourceOptions } from 'typeorm';
import { databaseConfig } from './database.config';

export const typeOrmConfig: DataSourceOptions = {
  type: databaseConfig.type,
  host: databaseConfig.host,
  port: databaseConfig.port,
  username: databaseConfig.username,
  password: databaseConfig.password,
  database: databaseConfig.database,
  entities: [__dirname + '/../database/entities/*.entity{.ts,.js}'],
  migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],
  synchronize: databaseConfig.synchronize,
  logging: databaseConfig.logging,
  charset: 'utf8mb4',
  timezone: 'Z',
};
export default new DataSource(typeOrmConfig);