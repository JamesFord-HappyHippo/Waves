// Database Seeding Runner
// Populates database with initial development/test data

import fs from 'fs';
import path from 'path';
import { db } from '../src/config/database';
import logger from '../src/utils/logger';

interface SeedFile {
  filename: string;
  order: number;
  content: string;
}

class SeedRunner {
  private seedsPath: string;

  constructor() {
    this.seedsPath = path.join(__dirname, 'seeds');
  }

  /**
   * Run all seed files
   */
  async runSeeds(): Promise<void> {
    try {
      logger.info('Starting database seeding...');

      // Ensure seeds table exists for tracking
      await this.createSeedsTable();

      // Check if already seeded
      const isSeeded = await this.isDatabaseSeeded();
      if (isSeeded && process.env.FORCE_SEED !== 'true') {
        logger.info('Database already seeded. Use FORCE_SEED=true to re-seed.');
        return;
      }

      // Get all seed files
      const seedFiles = await this.getSeedFiles();

      if (seedFiles.length === 0) {
        logger.info('No seed files found');
        return;
      }

      logger.info(`Found ${seedFiles.length} seed files`);

      // Clear existing seed records if force seeding
      if (process.env.FORCE_SEED === 'true') {
        await this.clearSeedRecords();
        logger.info('Cleared existing seed records');
      }

      // Run each seed file
      for (const seedFile of seedFiles) {
        await this.runSingleSeed(seedFile);
      }

      logger.info('Database seeding completed successfully');

    } catch (error) {
      logger.error('Seeding failed:', error);
      throw error;
    }
  }

  /**
   * Create seeds tracking table
   */
  private async createSeedsTable(): Promise<void> {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS seeds (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    await db.query(createTableSQL);
    logger.debug('Seeds table ensured');
  }

  /**
   * Check if database has been seeded
   */
  private async isDatabaseSeeded(): Promise<boolean> {
    try {
      const result = await db.query('SELECT COUNT(*) as count FROM seeds');
      return parseInt(result[0].count) > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Clear seed records (for re-seeding)
   */
  private async clearSeedRecords(): Promise<void> {
    await db.query('DELETE FROM seeds');
  }

  /**
   * Get all seed files sorted by order
   */
  private async getSeedFiles(): Promise<SeedFile[]> {
    if (!fs.existsSync(this.seedsPath)) {
      logger.warn('Seeds directory not found');
      return [];
    }

    const files = fs.readdirSync(this.seedsPath)
      .filter(file => file.endsWith('.sql'))
      .sort();

    const seedFiles: SeedFile[] = [];

    for (const filename of files) {
      const filePath = path.join(this.seedsPath, filename);
      const content = fs.readFileSync(filePath, 'utf-8');
      
      // Extract order number from filename (e.g., 001_initial_data.sql -> 1)
      const orderMatch = filename.match(/^(\d+)_/);
      const order = orderMatch ? parseInt(orderMatch[1], 10) : 999;

      seedFiles.push({
        filename,
        order,
        content
      });
    }

    return seedFiles.sort((a, b) => a.order - b.order);
  }

  /**
   * Run a single seed file
   */
  private async runSingleSeed(seedFile: SeedFile): Promise<void> {
    logger.info(`Running seed: ${seedFile.filename}`);

    try {
      // Check if seed already executed
      const existingRecord = await db.queryOne(
        'SELECT id FROM seeds WHERE filename = $1',
        [seedFile.filename]
      );

      if (existingRecord) {
        logger.info(`Seed already executed, skipping: ${seedFile.filename}`);
        return;
      }

      // Use transaction for seed
      await db.transaction(async (client) => {
        // Execute seed SQL
        await client.query(seedFile.content);

        // Record seed as executed
        await client.query(
          'INSERT INTO seeds (filename) VALUES ($1)',
          [seedFile.filename]
        );
      });

      logger.info(`Seed completed: ${seedFile.filename}`);

    } catch (error) {
      logger.error(`Seed failed: ${seedFile.filename}`, error);
      throw error;
    }
  }

  /**
   * Get seeding status
   */
  async getSeedStatus(): Promise<{ executed: string[]; available: string[] }> {
    const allSeeds = await this.getSeedFiles();
    
    let executedSeeds: string[] = [];
    try {
      const result = await db.query<{ filename: string }>(
        'SELECT filename FROM seeds ORDER BY executed_at'
      );
      executedSeeds = result.map(row => row.filename);
    } catch (error) {
      // Seeds table doesn't exist
    }

    return {
      executed: executedSeeds,
      available: allSeeds.map(s => s.filename)
    };
  }

  /**
   * Clear all data and re-seed
   */
  async resetDatabase(): Promise<void> {
    logger.warn('Resetting database - this will delete all data!');

    try {
      // Get all table names except system tables
      const tablesResult = await db.query(`
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename NOT IN ('migrations', 'seeds')
        ORDER BY tablename
      `);

      const tables = tablesResult.map(row => row.tablename);

      if (tables.length > 0) {
        // Disable foreign key checks and truncate all tables
        await db.transaction(async (client) => {
          // Truncate all tables
          for (const table of tables) {
            await client.query(`TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE`);
          }
        });

        logger.info(`Truncated ${tables.length} tables`);
      }

      // Clear seed records
      await this.clearSeedRecords();

      // Re-run seeds
      await this.runSeeds();

      logger.info('Database reset and re-seeded successfully');

    } catch (error) {
      logger.error('Database reset failed:', error);
      throw error;
    }
  }
}

// CLI interface
async function main() {
  const command = process.argv[2];
  const seedRunner = new SeedRunner();

  try {
    switch (command) {
      case 'run':
      case undefined:
        await seedRunner.runSeeds();
        break;

      case 'status':
        const status = await seedRunner.getSeedStatus();
        console.log('Seed Status:');
        console.log(`Available seeds: ${status.available.length}`);
        console.log(`Executed seeds: ${status.executed.length}`);
        
        if (status.available.length > 0) {
          console.log('\nAvailable seeds:');
          status.available.forEach(s => {
            const executed = status.executed.includes(s);
            console.log(`  ${executed ? '✓' : '○'} ${s}`);
          });
        }
        break;

      case 'reset':
        // Require confirmation for reset
        const confirmReset = process.env.CONFIRM_RESET === 'true';
        if (!confirmReset) {
          console.log('Database reset requires confirmation.');
          console.log('Set CONFIRM_RESET=true to proceed.');
          console.log('WARNING: This will delete all data!');
          process.exit(1);
        }
        await seedRunner.resetDatabase();
        break;

      default:
        console.log('Usage: npm run db:seed [run|status|reset]');
        console.log('');
        console.log('Commands:');
        console.log('  run    - Execute all pending seed files (default)');
        console.log('  status - Show seeding status');
        console.log('  reset  - Reset database and re-seed (requires CONFIRM_RESET=true)');
        console.log('');
        console.log('Environment Variables:');
        console.log('  FORCE_SEED=true    - Force re-execution of all seeds');
        console.log('  CONFIRM_RESET=true - Required for reset command');
        process.exit(1);
    }

    await db.close();
    process.exit(0);

  } catch (error) {
    logger.error('Seed command failed:', error);
    await db.close();
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { SeedRunner };