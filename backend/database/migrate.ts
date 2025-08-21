// Database Migration Runner
// Executes SQL migration files in order

import fs from 'fs';
import path from 'path';
import { db } from '../src/config/database';
import logger from '../src/utils/logger';

interface Migration {
  filename: string;
  version: number;
  content: string;
}

class MigrationRunner {
  private migrationsPath: string;

  constructor() {
    this.migrationsPath = path.join(__dirname, 'migrations');
  }

  /**
   * Run all pending migrations
   */
  async runMigrations(): Promise<void> {
    try {
      logger.info('Starting database migrations...');

      // Ensure migrations table exists
      await this.createMigrationsTable();

      // Get all migration files
      const migrations = await this.getMigrationFiles();

      // Get completed migrations from database
      const completedMigrations = await this.getCompletedMigrations();

      // Filter to pending migrations only
      const pendingMigrations = migrations.filter(migration => 
        !completedMigrations.includes(migration.filename)
      );

      if (pendingMigrations.length === 0) {
        logger.info('No pending migrations found');
        return;
      }

      logger.info(`Found ${pendingMigrations.length} pending migrations`);

      // Run each pending migration
      for (const migration of pendingMigrations) {
        await this.runSingleMigration(migration);
      }

      logger.info('All migrations completed successfully');

    } catch (error) {
      logger.error('Migration failed:', error);
      throw error;
    }
  }

  /**
   * Create migrations tracking table
   */
  private async createMigrationsTable(): Promise<void> {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    await db.query(createTableSQL);
    logger.debug('Migrations table ensured');
  }

  /**
   * Get all migration files sorted by version
   */
  private async getMigrationFiles(): Promise<Migration[]> {
    const files = fs.readdirSync(this.migrationsPath)
      .filter(file => file.endsWith('.sql'))
      .sort();

    const migrations: Migration[] = [];

    for (const filename of files) {
      const filePath = path.join(this.migrationsPath, filename);
      const content = fs.readFileSync(filePath, 'utf-8');
      
      // Extract version number from filename (e.g., 001_initial_schema.sql -> 1)
      const versionMatch = filename.match(/^(\d+)_/);
      const version = versionMatch ? parseInt(versionMatch[1], 10) : 0;

      migrations.push({
        filename,
        version,
        content
      });
    }

    return migrations.sort((a, b) => a.version - b.version);
  }

  /**
   * Get list of completed migrations from database
   */
  private async getCompletedMigrations(): Promise<string[]> {
    try {
      const result = await db.query<{ filename: string }>(
        'SELECT filename FROM migrations ORDER BY executed_at'
      );
      return result.map(row => row.filename);
    } catch (error) {
      // If migrations table doesn't exist, return empty array
      logger.debug('Migrations table not found, starting fresh');
      return [];
    }
  }

  /**
   * Run a single migration file
   */
  private async runSingleMigration(migration: Migration): Promise<void> {
    logger.info(`Running migration: ${migration.filename}`);

    try {
      // Use transaction for migration
      await db.transaction(async (client) => {
        // Execute migration SQL
        await client.query(migration.content);

        // Record migration as completed
        await client.query(
          'INSERT INTO migrations (filename) VALUES ($1)',
          [migration.filename]
        );
      });

      logger.info(`Migration completed: ${migration.filename}`);

    } catch (error) {
      logger.error(`Migration failed: ${migration.filename}`, error);
      throw error;
    }
  }

  /**
   * Rollback a specific migration (if rollback file exists)
   */
  async rollbackMigration(filename: string): Promise<void> {
    logger.info(`Rolling back migration: ${filename}`);

    try {
      // Check if rollback file exists
      const rollbackFilename = filename.replace('.sql', '_rollback.sql');
      const rollbackPath = path.join(this.migrationsPath, rollbackFilename);

      if (!fs.existsSync(rollbackPath)) {
        throw new Error(`Rollback file not found: ${rollbackFilename}`);
      }

      const rollbackSQL = fs.readFileSync(rollbackPath, 'utf-8');

      // Use transaction for rollback
      await db.transaction(async (client) => {
        // Execute rollback SQL
        await client.query(rollbackSQL);

        // Remove migration record
        await client.query(
          'DELETE FROM migrations WHERE filename = $1',
          [filename]
        );
      });

      logger.info(`Migration rolled back: ${filename}`);

    } catch (error) {
      logger.error(`Rollback failed: ${filename}`, error);
      throw error;
    }
  }

  /**
   * Get migration status
   */
  async getMigrationStatus(): Promise<{ total: number; completed: number; pending: string[] }> {
    const allMigrations = await this.getMigrationFiles();
    const completedMigrations = await this.getCompletedMigrations();
    
    const pendingMigrations = allMigrations
      .filter(m => !completedMigrations.includes(m.filename))
      .map(m => m.filename);

    return {
      total: allMigrations.length,
      completed: completedMigrations.length,
      pending: pendingMigrations
    };
  }
}

// CLI interface
async function main() {
  const command = process.argv[2];
  const migrationRunner = new MigrationRunner();

  try {
    switch (command) {
      case 'up':
      case undefined:
        await migrationRunner.runMigrations();
        break;

      case 'status':
        const status = await migrationRunner.getMigrationStatus();
        console.log('Migration Status:');
        console.log(`Total migrations: ${status.total}`);
        console.log(`Completed: ${status.completed}`);
        console.log(`Pending: ${status.pending.length}`);
        if (status.pending.length > 0) {
          console.log('Pending migrations:');
          status.pending.forEach(m => console.log(`  - ${m}`));
        }
        break;

      case 'rollback':
        const filename = process.argv[3];
        if (!filename) {
          throw new Error('Migration filename required for rollback');
        }
        await migrationRunner.rollbackMigration(filename);
        break;

      default:
        console.log('Usage: npm run db:migrate [up|status|rollback <filename>]');
        process.exit(1);
    }

    await db.close();
    process.exit(0);

  } catch (error) {
    logger.error('Migration command failed:', error);
    await db.close();
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { MigrationRunner };