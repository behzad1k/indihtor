import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { typeOrmConfig } from './config/typeorm.config';

// Import all modules
import { AuthModule } from './modules/auth/auth.module';
import { PatternSignalsModule } from './modules/pattern-signals/pattern-signals.module';
import { PriorityCoinsModule } from './modules/priority-coins/priority-coins.module';
import { MonitorModule } from './modules/monitor/monitor.module';
import { LiveAnalysisModule } from './modules/live-analysis/live-analysis.module';
import { FactCheckerModule } from './modules/fact-checker/fact-checker.module';
import { SignalValidationModule } from './modules/signal-validation/signal-validation.module';
import { SignalCombinationsModule } from './modules/signal-combinations/signal-combinations.module';
import { PaperTradingModule } from './modules/paper-trading/paper-trading.module';
import { ExternalApiModule } from './modules/external-api/external-api.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRoot(typeOrmConfig),
    ScheduleModule.forRoot(),
    AuthModule,
    PatternSignalsModule,
    PriorityCoinsModule,
    MonitorModule,
    LiveAnalysisModule,
    FactCheckerModule,
    SignalValidationModule,
    SignalCombinationsModule,
    PaperTradingModule,
    ExternalApiModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}