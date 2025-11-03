
import { MigrationInterface, QueryRunner } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';

export class MigratePatternsToCrossTfCombos1234567890 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const patternsPath = path.join(process.cwd(), 'patterns.json');

    if (!fs.existsSync(patternsPath)) {
      console.log('patterns.json not found, skipping migration');
      return;
    }

    const patterns = JSON.parse(fs.readFileSync(patternsPath, 'utf-8'));

    for (const pattern of patterns) {
      const parsed = this.parsePattern(pattern.indicator);

      await queryRunner.query(`
        INSERT INTO cross_tf_combos (
          combo_signature, timeframes, signal_names, accuracy,
          signals_count, correct_predictions, combo_size, num_timeframes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        parsed.signature,
        parsed.timeframes.join(','),
        parsed.signals.join(','),
        pattern.accuracy,
        pattern.total,
        pattern.success,
        parsed.signals.length,
        parsed.timeframes.length
      ]);
    }

    // Delete old pattern_signals
    await queryRunner.query(`DELETE FROM pattern_signals`);

    console.log(`Migrated ${patterns.length} patterns to cross_tf_combos`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM cross_tf_combos WHERE created_at >= NOW() - INTERVAL 1 HOUR`);
  }

  private parsePattern(patternStr: string) {
    // "[12h] WILLR_oversold + [1h] WILLR_oversold + [6h] RSI_oversold"
    const parts = patternStr.split(' + ');
    const timeframes: string[] = [];
    const signals: string[] = [];
    const signatureParts: string[] = [];

    for (const part of parts) {
      const match = part.match(/\[([^\]]+)\]\s*(.+)/);
      if (match) {
        const tf = match[1];
        const signal = match[2].trim();
        timeframes.push(tf);
        signals.push(signal);
        signatureParts.push(`${signal}@${tf}`);
      }
    }

    return {
      signature: signatureParts.sort().join('+'),
      timeframes: [...new Set(timeframes)].sort(),
      signals
    };
  }
}