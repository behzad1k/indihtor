import { typeOrmConfig } from '@config/typeorm.config';
import { FactCheckingModule } from '@modules/fact-checker/fact-checking.module';
import { SignalCombinationModule } from '@modules/signal-combinations/signal-combination.module';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { TradingModule } from './modules/trading/trading.module';
import { MarketDataModule } from './modules/market-data/market-data.module';
import { SignalAnalyzerModule } from './modules/signal-analyzer/signal-analyzer.module';
import { ExternalApiModule } from './modules/external-api/external-api.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRoot(typeOrmConfig),
    ScheduleModule.forRoot(),
    AuthModule,
    UsersModule,
    TradingModule,
    MarketDataModule,
    SignalAnalyzerModule,
    ExternalApiModule,
    FactCheckingModule,
    SignalCombinationModule
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}