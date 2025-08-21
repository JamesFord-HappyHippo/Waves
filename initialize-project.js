#!/usr/bin/env node

/**
 * Project Initialization Script
 * Sets up the agent system and prepares the project for development
 */

const fs = require('fs');
const path = require('path');

console.log('🚀 Initializing Empty Project Template...\n');

// Check if agent system exists
const adrianPath = path.join(__dirname, '.adrian');
if (!fs.existsSync(adrianPath)) {
    console.log('❌ Agent system not found. Please ensure .adrian directory exists.');
    process.exit(1);
}

// Check if .clinerules exists
const clinerulePath = path.join(__dirname, '.clinerules');
if (!fs.existsSync(clinerulePath)) {
    console.log('❌ Development rules not found. Please ensure .clinerules directory exists.');
    process.exit(1);
}

console.log('✅ Agent system found at .adrian/');
console.log('✅ Development rules found at .clinerules/');

// List available agents
const agentsPath = path.join(adrianPath, 'agents');
if (fs.existsSync(agentsPath)) {
    const agents = fs.readdirSync(agentsPath, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);
    
    console.log('\n🤖 Available Agents:');
    agents.forEach(agent => {
        console.log(`   • ${agent}`);
    });
}

// List available development standards
const rulesPath = path.join(__dirname, '.clinerules');
if (fs.existsSync(rulesPath)) {
    const rules = fs.readdirSync(rulesPath)
        .filter(file => file.endsWith('.md'))
        .map(file => file.replace('.md', ''));
    
    console.log('\n📋 Available Development Standards:');
    rules.forEach(rule => {
        console.log(`   • ${rule}`);
    });
}

console.log('\n📖 IMPORTANT: Read the Complete Setup Guide');
console.log('   👉 PROJECT_INITIALIZATION_GUIDE.md 👈');
console.log('   This guide contains detailed instructions for:');
console.log('   • Project customization and configuration');
console.log('   • Technology stack selection and setup');
console.log('   • Agent system optimization for your domain');
console.log('   • Development workflow best practices');

console.log('\n🎯 Quick Next Steps:');
console.log('   1. Read PROJECT_INITIALIZATION_GUIDE.md thoroughly');
console.log('   2. Update CLAUDE.md with your project specifics');
console.log('   3. Customize .clinerules/ for your technology stack');
console.log('   4. Update package.json with your project details');
console.log('   5. Copy .env.example to .env and configure');
console.log('   6. Run: npm install');
console.log('   7. Start development with your AI assistants!');

console.log('\n✨ Project template initialized successfully!');
console.log('   Ready for AI-assisted development with Claude Code and Cline.');
console.log('\n📚 Documentation Available:');
console.log('   • PROJECT_INITIALIZATION_GUIDE.md - Complete setup guide');
console.log('   • TEMPLATE_SUMMARY.md - Template capabilities overview');
console.log('   • CLAUDE.md - AI assistant configuration template');
console.log('   • README.md - Project overview and quick start');

// Test agent memory manager
try {
    const memoryManager = require('./.adrian/agent-memory-manager.js');
    console.log('\n🧠 Agent memory system operational');
} catch (error) {
    console.log('\n⚠️  Agent memory system needs attention:', error.message);
}

console.log('\n🚀 Happy coding with AI assistance!');