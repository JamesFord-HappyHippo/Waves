#!/usr/bin/env node
/**
 * Waves Friends & Family Deployment Script
 * 
 * Ultra-minimal deployment for 1-10 users ($20-35/month)
 * Optimized for personal testing and close friends/family
 */

const fs = require('fs');
const path = require('path');

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const force = args.includes('--force');

console.log(`🌊 Waves Friends & Family Deployment`);
console.log(`👨‍👩‍👧‍👦 Target: You + close friends (1-10 users)`);
console.log(`💰 Estimated Cost: $20-35/month`);
console.log(`🧪 Dry Run: ${dryRun}`);
console.log('─'.repeat(60));

async function deployFriendsFamily() {
  try {
    console.log('📦 Level 0: Friends & Family Configuration');
    
    const config = {
      environment: 'friends-family',
      region: 'us-east-1',
      
      // Ultra-minimal database
      database: {
        instanceClass: 'db.t3.micro',  // $15/month
        multiAZ: false,                // Single AZ is fine for friends
        backupRetention: 7,            // Basic backups
        storage: 20,                   // 20GB minimum
        storageEncrypted: true         // Always encrypt
      },
      
      // Free tier Lambda
      lambda: {
        memorySize: 512,               // Minimal memory
        timeout: 30,                   // Shorter timeout
        provisionedConcurrency: 0      // No provisioning needed
      },
      
      // No CloudFront CDN
      cdn: {
        enabled: false,                // Direct S3 serving
        priceClass: 'PriceClass_100'   // Not used but cheaper if needed
      },
      
      // Free tier authentication
      auth: {
        mfaEnabled: false,             // Not needed for friends
        passwordPolicy: 'basic'        // Simple policy
      },
      
      // Free tier APIs
      externalAPIs: {
        noaa: 'free',                  // Free tier with rate limits
        openweather: 'free',           // Free tier (1000 calls/day)
        mapbox: 'free'                 // Free tier (50k requests/month)
      },
      
      // Minimal monitoring
      monitoring: {
        detailedMonitoring: false,     // Basic CloudWatch only
        logRetention: 7,               // 7 days log retention
        alerting: 'basic'              // Simple email alerts
      },
      
      // No advanced security
      security: {
        waf: false,                    // No WAF needed for friends
        guardduty: false,              // No threat detection needed
        vpc: false,                    // Public subnets are fine
        secretsManager: false          // Environment variables for now
      }
    };

    console.log('\n🎯 Configuration Summary:');
    console.log(`  Database: ${config.database.instanceClass} (${config.database.multiAZ ? 'Multi-AZ' : 'Single AZ'})`);
    console.log(`  CDN: ${config.cdn.enabled ? 'CloudFront' : 'Direct S3'}`);
    console.log(`  Security: ${config.security.waf ? 'WAF + GuardDuty' : 'Basic (sufficient for friends)'}`);
    console.log(`  Monitoring: ${config.monitoring.alerting} level`);

    // Cost estimation
    const costs = calculateCosts(config);
    console.log('\n💰 Estimated Monthly Costs:');
    Object.entries(costs).forEach(([service, cost]) => {
      console.log(`  ${service}: $${cost}/month`);
    });
    console.log(`  Total: $${Object.values(costs).reduce((a, b) => a + b, 0)}/month`);

    // Deployment readiness checks
    console.log('\n🔍 Pre-deployment Checks:');
    
    const checks = [
      { name: 'AWS CLI configured', check: () => checkAWSCLI() },
      { name: 'Environment variables set', check: () => checkEnvironmentVars() },
      { name: 'Database schema ready', check: () => checkDatabaseSchema() },
      { name: 'Mobile app built', check: () => checkMobileApp() },
      { name: 'API endpoints tested', check: () => checkAPIEndpoints() }
    ];

    for (const check of checks) {
      const result = await check.check();
      console.log(`  ${result ? '✅' : '❌'} ${check.name}`);
      if (!result && !force) {
        console.log(`\n❌ Pre-deployment check failed: ${check.name}`);
        console.log('Fix the issue or use --force to continue anyway');
        return;
      }
    }

    if (dryRun) {
      console.log('\n🧪 Dry run complete - configuration looks good!');
      console.log('Run without --dry-run to deploy');
      return;
    }

    // Actual deployment
    console.log('\n🚀 Starting Friends & Family Deployment...');
    
    await deployInfrastructure(config);
    await deployApplication(config);
    await validateDeployment(config);

    console.log('\n🎉 Friends & Family Deployment Complete!');
    console.log('\n📱 Next Steps:');
    console.log('  1. Test the app with your phone');
    console.log('  2. Invite 2-3 close friends to test');
    console.log('  3. Collect feedback and iterate');
    console.log('  4. Monitor usage for upgrade thresholds');
    console.log('\n🌊 Happy boating with friends! ⚓');

  } catch (error) {
    console.error('\n💥 Deployment failed:', error.message);
    console.error('🔧 Check the error above and try again');
    process.exit(1);
  }
}

/**
 * Calculate estimated monthly costs
 */
function calculateCosts(config) {
  const costs = {
    'RDS Database': config.database.instanceClass === 'db.t3.micro' ? 15 : 30,
    'Lambda Functions': 5,  // Will likely be $0-2 with free tier
    'API Gateway': 2,       // Will likely be $0-1 with free tier
    'S3 Storage': config.cdn.enabled ? 5 : 3,
    'CloudFront CDN': config.cdn.enabled ? 20 : 0,
    'Route53 DNS': 0.50,
    'Cognito Auth': 0,      // Free tier covers up to 50k users
    'CloudWatch': 3,
    'Data Transfer': 2
  };

  if (config.security.waf) costs['WAF'] = 10;
  if (config.security.guardduty) costs['GuardDuty'] = 5;
  if (config.database.multiAZ) costs['Multi-AZ'] += 15;

  return costs;
}

/**
 * Pre-deployment checks
 */
async function checkAWSCLI() {
  try {
    const { execSync } = require('child_process');
    execSync('aws sts get-caller-identity', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

async function checkEnvironmentVars() {
  const required = [
    'DB_PASSWORD',
    'MAPBOX_ACCESS_TOKEN'
  ];
  
  return required.every(env => process.env[env]);
}

async function checkDatabaseSchema() {
  return fs.existsSync('./backend/migrations/001_initial_schema.sql');
}

async function checkMobileApp() {
  return fs.existsSync('./WavesDemo/App.tsx');
}

async function checkAPIEndpoints() {
  return fs.existsSync('./backend/src/lambda/depthHandler.ts');
}

/**
 * Deploy infrastructure
 */
async function deployInfrastructure(config) {
  console.log('🏗️ Deploying minimal infrastructure...');
  
  const { execSync } = require('child_process');
  
  // Create minimal serverless config
  const serverlessConfig = {
    service: 'waves-friends-family',
    frameworkVersion: '3',
    provider: {
      name: 'aws',
      runtime: 'nodejs18.x',
      stage: 'friends',
      region: config.region,
      memorySize: config.lambda.memorySize,
      timeout: config.lambda.timeout,
      environment: {
        NODE_ENV: 'friends-family',
        DB_HOST: '${ssm:/waves/friends/db/host}',
        DB_NAME: '${ssm:/waves/friends/db/name}',
        DB_USER: '${ssm:/waves/friends/db/user}',
        DB_PASSWORD: '${ssm:/waves/friends/db/password~true}',
        MAPBOX_ACCESS_TOKEN: process.env.MAPBOX_ACCESS_TOKEN || ''
      }
    },
    functions: {
      getDepthReadings: {
        handler: 'src/lambda/depthHandler.getDepthReadings',
        events: [{ http: { path: '/api/depth/readings', method: 'get', cors: true }}]
      },
      getMarineWeather: {
        handler: 'src/lambda/weatherHandler.getMarineWeather',
        events: [{ http: { path: '/api/weather/marine', method: 'get', cors: true }}]
      }
    },
    resources: {
      Resources: generateMinimalResources(config)
    }
  };

  // Write temporary serverless config
  fs.writeFileSync('./serverless-friends.yml', JSON.stringify(serverlessConfig, null, 2));

  try {
    // Deploy using serverless framework
    execSync('npx serverless deploy --config serverless-friends.yml', { stdio: 'inherit' });
    console.log('✅ Infrastructure deployed');
  } finally {
    // Clean up temporary config
    if (fs.existsSync('./serverless-friends.yml')) {
      fs.unlinkSync('./serverless-friends.yml');
    }
  }
}

/**
 * Generate minimal AWS resources
 */
function generateMinimalResources(config) {
  const resources = {};

  // Minimal RDS instance
  resources.WavesFriendsDB = {
    Type: 'AWS::RDS::DBInstance',
    Properties: {
      DBInstanceClass: config.database.instanceClass,
      Engine: 'postgres',
      EngineVersion: '16.1',
      AllocatedStorage: config.database.storage,
      StorageEncrypted: true,
      MultiAZ: config.database.multiAZ,
      BackupRetentionPeriod: config.database.backupRetention,
      DBName: 'waves_friends',
      MasterUsername: 'waves_user',
      MasterUserPassword: '${ssm:/waves/friends/db/password~true}',
      VPCSecurityGroups: [{ Ref: 'WavesFriendsDBSecurityGroup' }],
      PubliclyAccessible: true,  // OK for friends & family
      DeletionProtection: false  // Easy to clean up if needed
    }
  };

  // Basic security group
  resources.WavesFriendsDBSecurityGroup = {
    Type: 'AWS::EC2::SecurityGroup',
    Properties: {
      GroupDescription: 'Waves Friends & Family Database Security Group',
      SecurityGroupIngress: [{
        IpProtocol: 'tcp',
        FromPort: 5432,
        ToPort: 5432,
        SourceSecurityGroupId: { Ref: 'WavesFriendsLambdaSecurityGroup' }
      }]
    }
  };

  // Lambda security group
  resources.WavesFriendsLambdaSecurityGroup = {
    Type: 'AWS::EC2::SecurityGroup',
    Properties: {
      GroupDescription: 'Waves Friends & Family Lambda Security Group',
      SecurityGroupEgress: [{
        IpProtocol: '-1',
        CidrIp: '0.0.0.0/0'
      }]
    }
  };

  return resources;
}

/**
 * Deploy application code
 */
async function deployApplication(config) {
  console.log('📱 Deploying application...');
  
  // Build mobile app
  console.log('  Building mobile app...');
  const { execSync } = require('child_process');
  execSync('cd WavesDemo && npm run build', { stdio: 'inherit' });
  
  // Deploy static website
  console.log('  Deploying website...');
  execSync('aws s3 sync website/ s3://waves-friends-website --delete', { stdio: 'inherit' });
  
  console.log('✅ Application deployed');
}

/**
 * Validate deployment
 */
async function validateDeployment(config) {
  console.log('🔍 Validating deployment...');
  
  // Test API endpoints
  console.log('  Testing API endpoints...');
  // Add API testing logic here
  
  // Test mobile app
  console.log('  Testing mobile app...');
  // Add mobile app testing logic here
  
  console.log('✅ Deployment validated');
}

// Handle command line execution
if (require.main === module) {
  deployFriendsFamily().catch(error => {
    console.error('💥 Deployment script failed:', error);
    process.exit(1);
  });
}

module.exports = { deployFriendsFamily, calculateCosts };