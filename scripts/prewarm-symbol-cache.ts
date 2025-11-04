#!/usr/bin/env node

/**
 * Pre-warm Symbol Availability Cache
 *
 * This script validates which exchanges have which symbols
 * and builds a cache to avoid unnecessary API calls during fact-checking.
 *
 * Run before bulk fact-checking for optimal performance!
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ExchangeAggregatorService } from '../src/modules/external-api/services/exchange-aggregator.service';
import { Repository } from 'typeorm';
import { LiveSignal } from '../src/database/entities/live-signal.entity';
import * as fs from 'fs/promises';
import * as path from 'path';

const CACHE_DIR = './data';
const CACHE_FILE = path.join(CACHE_DIR, 'symbol-availability-cache.json');

async function ensureCacheDir() {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
  } catch (error) {
    // Directory already exists
  }
}

async function getUniqueSymbols(liveSignalRepo: Repository<LiveSignal>): Promise<string[]> {
  const results = await liveSignalRepo
  .createQueryBuilder('signal')
  .select('DISTINCT signal.symbol', 'symbol')
  .getRawMany();

  return results.map(r => r.symbol).sort();
}

async function prewarm() {
  console.log('\n🔥 Symbol Availability Cache Pre-Warming Tool\n');
  console.log('='.repeat(60));

  const startTime = Date.now();

  // Create application context
  console.log('\n1️⃣  Initializing application...');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const exchangeAggregator = app.get(ExchangeAggregatorService);
  const liveSignalRepo: Repository<LiveSignal> = app.get('LiveSignalRepository');

  // Ensure cache directory exists
  await ensureCacheDir();

  // Load existing cache if available
  console.log('\n2️⃣  Loading existing cache...');
  try {
    const existingCache = await fs.readFile(CACHE_FILE, 'utf-8');
    exchangeAggregator.importAvailabilityCache(JSON.parse(existingCache));
    console.log('   ✅ Loaded existing cache');
  } catch (error) {
    console.log('   ℹ️  No existing cache found, starting fresh');
  }

  // Get unique symbols
  console.log('\n3️⃣  Fetching unique symbols from live_signals...');
  const symbols = await getUniqueSymbols(liveSignalRepo);
  console.log(`   Found ${symbols.length} unique symbols`);

  if (symbols.length === 0) {
    console.log('\n⚠️  No symbols found in live_signals table!');
    console.log('   Please ensure you have data before pre-warming.\n');
    await app.close();
    return;
  }

  // Show sample
  console.log(`   Sample: ${symbols.slice(0, 10).join(', ')}${symbols.length > 10 ? ', ...' : ''}`);

  // Validate symbols
  console.log('\n4️⃣  Validating symbol availability across exchanges...');
  console.log('   This may take 20-30 minutes depending on symbol count.');
  console.log('   Progress will be shown every 10 symbols.\n');

  const validationStart = Date.now();
  await exchangeAggregator.batchValidateSymbols(symbols);
  const validationDuration = (Date.now() - validationStart) / 1000;

  console.log(`\n   ✅ Validation complete in ${validationDuration.toFixed(1)}s`);

  // Save cache
  console.log('\n5️⃣  Saving cache to disk...');
  const cache = exchangeAggregator.exportAvailabilityCache();
  await fs.writeFile(CACHE_FILE, JSON.stringify(cache, null, 2));
  console.log(`   ✅ Saved to ${CACHE_FILE}`);

  // Show statistics
  console.log('\n6️⃣  Cache Statistics:\n');
  const stats = exchangeAggregator.getOptimizedStats();

  console.log('   Overall:');
  console.log(`     Total Requests:     ${stats.overall.totalRequests}`);
  console.log(`     Successful:         ${stats.overall.successfulRequests} (${stats.overall.successRate})`);
  console.log(`     Failed:             ${stats.overall.failedRequests}`);
  console.log(`     Symbol Not Found:   ${stats.overall.symbolNotFoundErrors}`);

  console.log('\n   Cache:');
  console.log(`     Cached Symbols:     ${stats.cache.cachedSymbols}`);
  console.log(`     Cache Hits:         ${stats.cache.hits}`);
  console.log(`     Cache Misses:       ${stats.cache.misses}`);
  console.log(`     Hit Rate:           ${stats.cache.hitRate}`);

  console.log('\n   Exchange Performance:');
  const exchanges = Object.entries(stats.exchanges as any);
  exchanges.sort((a: any, b: any) => b[1].successes - a[1].successes);

  for (const [exchange, exStats] of exchanges) {
    const es = exStats as any;
    console.log(`     ${exchange.padEnd(12)} - ${es.attempts} attempts, ${es.successes} successes (${es.successRate})`);
  }

  // Calculate expected savings
  console.log('\n7️⃣  Expected Performance Impact:\n');
  const totalSignals = await liveSignalRepo.count();
  const avgExchangeAttempts = 3; // Average without cache
  const withoutOptimization = totalSignals * avgExchangeAttempts;
  const withOptimization = totalSignals * 1.5; // Estimated with cache
  const saved = withoutOptimization - withOptimization;
  const timeSavedHours = (saved * 0.5) / 3600; // 0.5s per request

  console.log(`   Total Signals to Process:  ${totalSignals.toLocaleString()}`);
  console.log(`   Without Optimization:      ${withoutOptimization.toLocaleString()} API calls`);
  console.log(`   With Optimization:         ${withOptimization.toLocaleString()} API calls`);
  console.log(`   API Calls Saved:           ${saved.toLocaleString()} (${((saved/withoutOptimization)*100).toFixed(1)}%)`);
  console.log(`   Estimated Time Saved:      ${timeSavedHours.toFixed(1)} hours`);

  // Analyze cache coverage
  console.log('\n8️⃣  Cache Coverage Analysis:\n');
  const cacheData = JSON.parse(await fs.readFile(CACHE_FILE, 'utf-8'));

  let totalAvailable = 0;
  let totalUnavailable = 0;
  let symbolsWithNoExchanges = 0;
  let symbolsWithAllExchanges = 0;

  for (const [symbol, data] of Object.entries(cacheData as any)) {
    const available = data.available.length;
    const unavailable = data.unavailable.length;

    totalAvailable += available;
    totalUnavailable += unavailable;

    if (available === 0) symbolsWithNoExchanges++;
    if (available === 7) symbolsWithAllExchanges++; // All 7 major exchanges
  }

  console.log(`   Average Exchanges per Symbol:  ${(totalAvailable / symbols.length).toFixed(2)}`);
  console.log(`   Symbols on All Exchanges:      ${symbolsWithAllExchanges}`);
  console.log(`   Symbols on No Exchanges:       ${symbolsWithNoExchanges}`);

  if (symbolsWithNoExchanges > 0) {
    console.log('\n   ⚠️  Symbols with no exchanges will be skipped during fact-checking:');
    let count = 0;
    for (const [symbol, data] of Object.entries(cacheData as any)) {
      if ((data as any).available.length === 0 && count < 10) {
        console.log(`      - ${symbol}`);
        count++;
      }
    }
    if (symbolsWithNoExchanges > 10) {
      console.log(`      ... and ${symbolsWithNoExchanges - 10} more`);
    }
  }

  const totalDuration = (Date.now() - startTime) / 1000;

  console.log('\n' + '='.repeat(60));
  console.log(`\n✅ Pre-warming complete in ${totalDuration.toFixed(1)}s!`);
  console.log(`\nCache saved to: ${CACHE_FILE}`);
  console.log('\nYou can now run bulk fact-checking with optimized performance! 🚀\n');

  await app.close();
}

// Run the pre-warming
prewarm()
.then(() => process.exit(0))
.catch(error => {
  console.error('\n❌ Error during pre-warming:\n');
  console.error(error);
  process.exit(1);
});