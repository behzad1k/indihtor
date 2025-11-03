export const appConfig = {
  port: parseInt(process.env.PORT || '', 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  secretKey: process.env.SECRET_KEY || 'default-secret-key',
  priorityCoinsFile: './data/priority_coins.json',
  patternsFile: './data/patterns.json',
};