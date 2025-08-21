/**
 * Database Operations Mock for Equilateral AI Agent System
 * 
 * **Developed by Equilateral AI (Pareidolia LLC)**
 * 
 * Mock database operations for standalone agent testing
 */

/**
 * Mock database query execution
 * In production environments, this would connect to actual databases
 */
const executeQuery = async (query, params = []) => {
    console.warn('⚠️  Mock database operation - no actual database connected');
    console.log('Query:', query);
    console.log('Parameters:', params);
    
    // Return mock success response
    return {
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        fields: []
    };
};

/**
 * Mock transaction wrapper
 */
const withTransaction = async (callback) => {
    console.warn('⚠️  Mock transaction - no actual database connected');
    return await callback(executeQuery);
};

module.exports = {
    executeQuery,
    withTransaction
};