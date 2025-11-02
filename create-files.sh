#!/bin/bash

echo "🚀 Creating all empty TypeScript files for Crypto Trading App..."

# Main files
touch src/main.ts
touch src/app.module.ts
touch src/app.controller.ts
touch src/app.service.ts

# Config files
touch src/config/app.config.ts
touch src/config/database.config.ts
touch src/config/typeorm.config.ts

# Common files
touch src/common/guards/auth.guard.ts
touch src/common/decorators/login-required.decorator.ts
touch src/common/filters/http-exception.filter.ts
touch src/common/interceptors/logging.interceptor.ts
touch src/common/utils/rate-limiter.util.ts
touch src/common/utils/price-cache.util.ts
touch src/common/utils/helpers.util.ts

# Types
touch src/types/signal.types.ts
touch src/types/trading.types.ts
touch src/types/analysis.types.ts
touch src/types/api-response.types.ts

# Entities
touch src/database/entities/pattern-signal.entity.ts
touch src/database/entities/live-signal.entity.ts
touch src/database/entities/analysis-run.entity.ts
touch src/database/entities/signal-fact-check.entity.ts
touch src/database/entities/signal.entity.ts
touch src/database/entities/signal-confidence-adjustment.entity.ts
touch src/database/entities/tf-combo.entity.ts
touch src/database/entities/cross-tf-combo.entity.ts
touch src/database/entities/live-tf-combo.entity.ts
touch src/database/entities/trading-state.entity.ts
touch src/database/entities/buying-queue.entity.ts
touch src/database/entities/active-position.entity.ts
touch src/database/entities/position-history.entity.ts
touch src/database/entities/position-monitoring.entity.ts

# Seeds
touch src/database/seeds/signal-definitions.seed.ts

# Auth module
touch src/modules/auth/auth.module.ts
touch src/modules/auth/auth.controller.ts
touch src/modules/auth/auth.service.ts
touch src/modules/auth/dto/login.dto.ts

# Pattern Signals module
touch src/modules/pattern-signals/pattern-signals.module.ts
touch src/modules/pattern-signals/pattern-signals.controller.ts
touch src/modules/pattern-signals/pattern-signals.service.ts
touch src/modules/pattern-signals/dto/get-signals.dto.ts
touch src/modules/pattern-signals/dto/export-signals.dto.ts

# Priority Coins module
touch src/modules/priority-coins/priority-coins.module.ts
touch src/modules/priority-coins/priority-coins.controller.ts
touch src/modules/priority-coins/priority-coins.service.ts
touch src/modules/priority-coins/dto/update-priority-coins.dto.ts

# Monitor module
touch src/modules/monitor/monitor.module.ts
touch src/modules/monitor/monitor.controller.ts
touch src/modules/monitor/monitor.service.ts
touch src/modules/monitor/crypto-pattern-monitor.service.ts
touch src/modules/monitor/scalp-signal-validator.service.ts
touch src/modules/monitor/dto/monitor-status.dto.ts

# Live Analysis module
touch src/modules/live-analysis/live-analysis.module.ts
touch src/modules/live-analysis/live-analysis.controller.ts
touch src/modules/live-analysis/live-analysis.service.ts
touch src/modules/live-analysis/scalp-signal-analyzer.service.ts
touch src/modules/live-analysis/live-analysis-db.service.ts
touch src/modules/live-analysis/live-analysis.gateway.ts
touch src/modules/live-analysis/dto/analyze-symbol.dto.ts
touch src/modules/live-analysis/dto/get-signals.dto.ts
touch src/modules/live-analysis/dto/cleanup-signals.dto.ts

# Fact Checker module
touch src/modules/fact-checker/fact-checker.module.ts
touch src/modules/fact-checker/fact-checker.controller.ts
touch src/modules/fact-checker/fact-checker.service.ts
touch src/modules/fact-checker/signal-fact-checker.service.ts
touch src/modules/fact-checker/dto/bulk-fact-check.dto.ts
touch src/modules/fact-checker/dto/adjust-confidence.dto.ts

# Signal Validation module
touch src/modules/signal-validation/signal-validation.module.ts
touch src/modules/signal-validation/signal-validation.controller.ts
touch src/modules/signal-validation/signal-validation.service.ts
touch src/modules/signal-validation/signal-validation-optimizer.service.ts
touch src/modules/signal-validation/dto/bulk-validate.dto.ts

# Signal Combinations module
touch src/modules/signal-combinations/signal-combinations.module.ts
touch src/modules/signal-combinations/signal-combinations.controller.ts
touch src/modules/signal-combinations/signal-combinations.service.ts
touch src/modules/signal-combinations/signal-combination-analyzer.service.ts
touch src/modules/signal-combinations/dto/analyze-combinations.dto.ts
touch src/modules/signal-combinations/dto/analyze-cross-tf.dto.ts
touch src/modules/signal-combinations/dto/get-active-combos.dto.ts

# Paper Trading module
touch src/modules/paper-trading/paper-trading.module.ts
touch src/modules/paper-trading/paper-trading.controller.ts
touch src/modules/paper-trading/paper-trading.service.ts
touch src/modules/paper-trading/paper-trading-engine.service.ts
touch src/modules/paper-trading/paper-trading-manager.service.ts
touch src/modules/paper-trading/dto/start-trading.dto.ts
touch src/modules/paper-trading/dto/reset-trading.dto.ts
touch src/modules/paper-trading/dto/get-positions.dto.ts

# External API module
touch src/modules/external-api/external-api.module.ts
touch src/modules/external-api/external-api.service.ts
touch src/modules/external-api/kucoin-api.service.ts
touch src/modules/external-api/binance-api.service.ts
touch src/modules/external-api/nobitex-api.service.ts

# Jobs
touch src/jobs/jobs.module.ts
touch src/jobs/monitoring.job.ts
touch src/jobs/signal-checking.job.ts
touch src/jobs/cleanup.job.ts

# Test files
touch test/app.e2e-spec.ts
touch test/jest-e2e.json

echo "✅ All TypeScript files created successfully!"
echo ""
echo "📊 Summary:"
echo "   Main files: 4"
echo "   Config files: 3"
echo "   Common files: 7"
echo "   Types: 4"
echo "   Entities: 14"
echo "   Seeds: 1"
echo "   Auth module: 4"
echo "   Pattern Signals module: 5"
echo "   Priority Coins module: 4"
echo "   Monitor module: 6"
echo "   Live Analysis module: 9"
echo "   Fact Checker module: 6"
echo "   Signal Validation module: 5"
echo "   Signal Combinations module: 7"
echo "   Paper Trading module: 8"
echo "   External API module: 5"
echo "   Jobs: 4"
echo "   Tests: 2"
echo ""
echo "🎯 Total files created: 98"
