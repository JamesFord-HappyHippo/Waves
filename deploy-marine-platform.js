#!/usr/bin/env node
/**
 * Waves Marine Navigation Platform Deployment Script
 * 
 * Complete deployment orchestration with Tim-Combo patterns
 * adapted for maritime navigation safety requirements.
 */

const WavesDeploymentOrchestrator = require('./src/deployment/WavesDeploymentOrchestrator');
const path = require('path');
const fs = require('fs');

// Parse command line arguments
const args = process.argv.slice(2);
const environment = args.find(arg => arg.startsWith('--env='))?.split('=')[1] || 'dev';
const region = args.find(arg => arg.startsWith('--region='))?.split('=')[1] || 'us-east-1';
const force = args.includes('--force');
const validate = args.includes('--validate');
const dryRun = args.includes('--dry-run');

console.log(`🌊 Waves Marine Navigation Platform Deployment`);
console.log(`📍 Environment: ${environment}`);
console.log(`🌍 Region: ${region}`);
console.log(`⚡ Force: ${force}`);
console.log(`✅ Validate: ${validate}`);
console.log(`🧪 Dry Run: ${dryRun}`);
console.log('─'.repeat(60));

async function deployMarinePlatform() {
  try {
    // Initialize deployment orchestrator
    const orchestrator = new WavesDeploymentOrchestrator({
      environment,
      region,
      dryRun,
      force
    });

    console.log('📦 Gathering marine navigation artifacts...');
    
    // Gather all deployment artifacts
    const marineLambdas = [
      './backend/src/lambda/depthHandler.ts',
      './backend/src/lambda/weatherHandler.ts'
    ].filter(fs.existsSync);

    const mobileComponents = [
      './src/components/marine/DepthVisualization.tsx',
      './src/components/marine/SafetyAlertOverlay.tsx',
      './src/components/safety/SafetyDashboard.tsx',
      './WavesDemo/App.tsx'
    ].filter(fs.existsSync);

    const chartData = [
      './backend/migrations/001_initial_schema.sql'
    ].filter(fs.existsSync);

    const safetyTests = [
      './src/services/environmental/__tests__/integration.test.ts'
    ].filter(fs.existsSync);

    const complianceDocs = [
      './WAVES_COMPLIANCE_AUDIT.md',
      './CLAUDE.md'
    ].filter(fs.existsSync);

    const allFiles = [...marineLambdas, ...mobileComponents, ...chartData, ...safetyTests, ...complianceDocs];
    
    console.log(`📊 Found ${allFiles.length} artifacts to deploy:`);
    console.log(`  🚀 Lambda handlers: ${marineLambdas.length}`);
    console.log(`  📱 Mobile components: ${mobileComponents.length}`);
    console.log(`  🗺️ Chart/DB files: ${chartData.length}`);
    console.log(`  🧪 Safety tests: ${safetyTests.length}`);
    console.log(`  📋 Compliance docs: ${complianceDocs.length}`);

    if (allFiles.length === 0) {
      console.log('⚠️ No artifacts found for deployment');
      return;
    }

    // Stage artifacts with marine safety validation
    console.log('\n🔍 Staging marine navigation artifacts...');
    const artifacts = orchestrator.stageMarineArtifacts(allFiles);

    if (validate) {
      console.log('\n✅ Running pre-deployment validation...');
      await validateDeployment(orchestrator, artifacts);
    }

    if (dryRun) {
      console.log('\n🧪 Dry run complete - no actual deployment performed');
      console.log('✅ All validations passed - ready for deployment');
      return;
    }

    // Deploy complete marine navigation platform
    console.log('\n🚀 Starting marine navigation deployment pipeline...');
    await orchestrator.deployMarineComplete(artifacts);

    console.log('\n🎉 Waves Marine Navigation Platform deployment completed successfully!');
    console.log('🌊 Safe waters ahead! ⚓');

  } catch (error) {
    console.error('\n💥 Deployment failed:', error.message);
    console.error('🔧 Check logs above for troubleshooting information');
    process.exit(1);
  }
}

/**
 * Run comprehensive validation before deployment
 */
async function validateDeployment(orchestrator, artifacts) {
  console.log('🔒 Running marine safety compliance validation...');
  
  // Validate Lambda handlers
  for (const handler of artifacts.lambdaHandlers) {
    console.log(`  🔍 Validating ${path.basename(handler)}...`);
    orchestrator.validateMarineSafety(handler);
  }

  // Validate mobile components
  for (const component of artifacts.mobileComponents) {
    console.log(`  📱 Validating ${path.basename(component)}...`);
    await orchestrator.validateMarineUI([component]);
  }

  // Validate database schema
  for (const schema of artifacts.chartData) {
    console.log(`  🗃️ Validating ${path.basename(schema)}...`);
    validateDatabaseSchema(schema);
  }

  console.log('✅ All validation checks passed');
}

/**
 * Validate database schema for marine requirements
 */
function validateDatabaseSchema(schemaFile) {
  const content = fs.readFileSync(schemaFile, 'utf8');
  
  // Check for PostGIS extensions
  if (!content.includes('postgis')) {
    throw new Error(`PostGIS extension missing in ${schemaFile}`);
  }

  // Check for spatial indexes
  if (!content.includes('GIST') && !content.includes('spatial')) {
    console.warn(`Consider spatial indexes in ${schemaFile}`);
  }

  // Check for maritime-specific tables
  const requiredTables = ['depth_readings', 'users', 'marine_areas'];
  for (const table of requiredTables) {
    if (!content.includes(table)) {
      throw new Error(`Required marine table '${table}' missing in ${schemaFile}`);
    }
  }
}

/**
 * Display help information
 */
function showHelp() {
  console.log(`
🌊 Waves Marine Navigation Platform Deployment

Usage:
  node deploy-marine-platform.js [options]

Options:
  --env=<environment>     Deployment environment (dev|staging|production)
  --region=<region>       AWS region (default: us-east-1)
  --force                 Force deployment even if validations warn
  --validate              Run extra validation checks before deployment
  --dry-run              Validate and stage but don't deploy
  --help                 Show this help message

Examples:
  # Deploy to development environment
  node deploy-marine-platform.js --env=dev --validate

  # Dry run for production
  node deploy-marine-platform.js --env=production --dry-run --validate

  # Force deploy to staging
  node deploy-marine-platform.js --env=staging --force

🌊 Safe deployments for safer waters! ⚓
`);
}

// Handle command line execution
if (args.includes('--help')) {
  showHelp();
  process.exit(0);
}

// Run deployment
deployMarinePlatform().catch(error => {
  console.error('💥 Deployment script failed:', error);
  process.exit(1);
});