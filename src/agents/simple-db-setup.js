#!/usr/bin/env node
// simple-db-setup.js - Multi-database setup for agent coordination
// Supports PostgreSQL, MySQL, and SQLite

async function setupAgentDatabase() {
    try {
        console.log('🔧 Setting up agent database...');
        
        const dbType = process.env.DB_TYPE || 'postgresql';
        console.log(`📊 Database type: ${dbType}`);
        
        let client;
        let createTablesSQL;
        
        switch (dbType.toLowerCase()) {
            case 'postgresql':
                client = await setupPostgreSQL();
                createTablesSQL = getPostgreSQLTables();
                break;
            case 'mysql':
                client = await setupMySQL();
                createTablesSQL = getMySQLTables();
                break;
            case 'sqlite':
                client = await setupSQLite();
                createTablesSQL = getSQLiteTables();
                break;
            default:
                throw new Error(`Unsupported database type: ${dbType}. Use 'postgresql', 'mysql', or 'sqlite'`);
        }
        
        console.log('✅ Database connection successful');
        
        // Create agent coordination tables
        for (const sql of createTablesSQL) {
            await executeQuery(client, sql, dbType);
        }
        console.log('✅ Agent coordination tables created');
        
        await closeConnection(client, dbType);
        console.log('🚀 Agent database ready for coordination!');
        
        return true;
    } catch (error) {
        console.error('❌ Failed to setup agent database:', error.message);
        console.error('💡 Make sure you have installed the correct database driver:');
        console.error('   npm install pg        # For PostgreSQL');
        console.error('   npm install mysql2    # For MySQL');
        console.error('   npm install sqlite3   # For SQLite');
        return false;
    }
}

async function setupPostgreSQL() {
    const { Client } = require('pg');
    
    const dbConfig = {
        host: process.env.DB_HOST || 'localhost',
        database: process.env.DB_NAME || 'agents_db',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD,
        port: process.env.DB_PORT || 5432,
        ssl: process.env.DB_SSL ? { rejectUnauthorized: false } : false
    };
    
    const client = new Client(dbConfig);
    console.log('🔌 Connecting to PostgreSQL...');
    await client.connect();
    
    // Create agents schema
    await client.query(`CREATE SCHEMA IF NOT EXISTS agents;`);
    console.log('✅ Agents schema ready');
    
    return client;
}

async function setupMySQL() {
    const mysql = require('mysql2/promise');
    
    const dbConfig = {
        host: process.env.DB_HOST || 'localhost',
        database: process.env.DB_NAME || 'agents_db',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD,
        port: process.env.DB_PORT || 3306
    };
    
    console.log('🔌 Connecting to MySQL...');
    const client = await mysql.createConnection(dbConfig);
    
    return client;
}

async function setupSQLite() {
    const sqlite3 = require('sqlite3');
    const { open } = require('sqlite');
    
    const dbPath = process.env.DB_PATH || './agents.db';
    
    console.log(`🔌 Connecting to SQLite at ${dbPath}...`);
    const client = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });
    
    return client;
}

function getPostgreSQLTables() {
    return [
        `CREATE TABLE IF NOT EXISTS agents.workflow_executions (
            id SERIAL PRIMARY KEY,
            workflow_name VARCHAR(255) NOT NULL,
            workflow_id VARCHAR(255) UNIQUE NOT NULL,
            status VARCHAR(50) DEFAULT 'running',
            started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            completed_at TIMESTAMP,
            steps_total INTEGER,
            steps_completed INTEGER DEFAULT 0,
            execution_data JSONB,
            result_data JSONB
        );`,
        `CREATE TABLE IF NOT EXISTS agents.agent_tasks (
            id SERIAL PRIMARY KEY,
            agent_name VARCHAR(255) NOT NULL,
            task_id VARCHAR(255) NOT NULL,
            workflow_id VARCHAR(255) REFERENCES agents.workflow_executions(workflow_id),
            status VARCHAR(50) DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            task_data JSONB,
            result_data JSONB
        );`,
        `CREATE TABLE IF NOT EXISTS agents.agent_memory (
            id SERIAL PRIMARY KEY,
            agent_name VARCHAR(255) NOT NULL,
            memory_type VARCHAR(100) NOT NULL,
            memory_data JSONB NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );`
    ];
}

function getMySQLTables() {
    return [
        `CREATE TABLE IF NOT EXISTS workflow_executions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            workflow_name VARCHAR(255) NOT NULL,
            workflow_id VARCHAR(255) UNIQUE NOT NULL,
            status VARCHAR(50) DEFAULT 'running',
            started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            completed_at TIMESTAMP NULL,
            steps_total INTEGER,
            steps_completed INTEGER DEFAULT 0,
            execution_data JSON,
            result_data JSON
        );`,
        `CREATE TABLE IF NOT EXISTS agent_tasks (
            id INT AUTO_INCREMENT PRIMARY KEY,
            agent_name VARCHAR(255) NOT NULL,
            task_id VARCHAR(255) NOT NULL,
            workflow_id VARCHAR(255),
            status VARCHAR(50) DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            task_data JSON,
            result_data JSON,
            FOREIGN KEY (workflow_id) REFERENCES workflow_executions(workflow_id)
        );`,
        `CREATE TABLE IF NOT EXISTS agent_memory (
            id INT AUTO_INCREMENT PRIMARY KEY,
            agent_name VARCHAR(255) NOT NULL,
            memory_type VARCHAR(100) NOT NULL,
            memory_data JSON NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        );`
    ];
}

function getSQLiteTables() {
    return [
        `CREATE TABLE IF NOT EXISTS workflow_executions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            workflow_name VARCHAR(255) NOT NULL,
            workflow_id VARCHAR(255) UNIQUE NOT NULL,
            status VARCHAR(50) DEFAULT 'running',
            started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            completed_at TIMESTAMP,
            steps_total INTEGER,
            steps_completed INTEGER DEFAULT 0,
            execution_data TEXT,
            result_data TEXT
        );`,
        `CREATE TABLE IF NOT EXISTS agent_tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            agent_name VARCHAR(255) NOT NULL,
            task_id VARCHAR(255) NOT NULL,
            workflow_id VARCHAR(255),
            status VARCHAR(50) DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            task_data TEXT,
            result_data TEXT,
            FOREIGN KEY (workflow_id) REFERENCES workflow_executions(workflow_id)
        );`,
        `CREATE TABLE IF NOT EXISTS agent_memory (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            agent_name VARCHAR(255) NOT NULL,
            memory_type VARCHAR(100) NOT NULL,
            memory_data TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );`
    ];
}

async function executeQuery(client, sql, dbType) {
    switch (dbType.toLowerCase()) {
        case 'postgresql':
            await client.query(sql);
            break;
        case 'mysql':
            await client.execute(sql);
            break;
        case 'sqlite':
            await client.exec(sql);
            break;
    }
}

async function closeConnection(client, dbType) {
    switch (dbType.toLowerCase()) {
        case 'postgresql':
            await client.end();
            break;
        case 'mysql':
            await client.end();
            break;
        case 'sqlite':
            await client.close();
            break;
    }
}

module.exports = setupAgentDatabase;

// Run if called directly
if (require.main === module) {
    setupAgentDatabase().then(success => {
        process.exit(success ? 0 : 1);
    });
}