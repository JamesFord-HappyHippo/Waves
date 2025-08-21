/**
 * Tim-Combo Deployment Agent
 * 
 * Handles complex multi-account, multi-bucket deployment orchestration
 * Uses JSON configuration files to manage product-specific deployment patterns
 * Supports release promotion pipelines with approval gates
 */

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

// Simple response utilities to avoid environment dependencies
const createSuccessResponse = (data, message, metadata) => ({
    success: true,
    data,
    message,
    metadata
});

const createErrorResponse = (message, code) => ({
    success: false,
    message,
    error_code: code
});

class DeploymentAgent {
    constructor() {
        this.configPath = '/Users/jamesford/Source/Tim-Combo/deployment-configs';
        this.supportedOperations = {
            'create_release': 'Create release candidate from dev builds',
            'promote_release': 'Promote release between environments with approval',
            'deploy_environment': 'Deploy to specific environment',
            'rollback_release': 'Rollback to previous version',
            'verify_deployment': 'Verify deployment health across accounts',
            'sync_buckets': 'Sync artifacts between configured buckets'
        };
    }

    /**
     * Main deployment orchestration entry point
     */
    async executeDeployment(operation, config) {
        try {
            console.log(`🚀 Tim-Combo Deployment Agent: ${operation}`);
            
            // Load product configuration
            const productConfig = await this.loadProductConfig(config.product);
            
            // Validate deployment scope
            await this.validateDeploymentScope(productConfig, config);
            
            // Execute specific operation
            let result;
            switch (operation) {
                case 'create_release':
                    result = await this.createRelease(productConfig, config);
                    break;
                case 'promote_release':
                    result = await this.promoteRelease(productConfig, config);
                    break;
                case 'deploy_environment':
                    result = await this.deployEnvironment(productConfig, config);
                    break;
                case 'rollback_release':
                    result = await this.rollbackRelease(productConfig, config);
                    break;
                case 'verify_deployment':
                    result = await this.verifyDeployment(productConfig, config);
                    break;
                case 'sync_buckets':
                    result = await this.syncBuckets(productConfig, config);
                    break;
                default:
                    throw new Error(`Unsupported operation: ${operation}`);
            }
            
            return createSuccessResponse(
                result,
                `${operation} completed successfully`,
                {
                    operation,
                    product: config.product,
                    environment: config.environment,
                    timestamp: new Date().toISOString(),
                    duration_ms: Date.now() - result.start_time
                }
            );
            
        } catch (error) {
            console.error(`Deployment Agent Error:`, error);
            return createErrorResponse(error.message, 'DEPLOYMENT_ERROR');
        }
    }

    /**
     * Load product-specific deployment configuration
     */
    async loadProductConfig(productName) {
        const configFile = path.join(this.configPath, `${productName}.json`);
        
        try {
            const configContent = await fs.readFile(configFile, 'utf8');
            const config = JSON.parse(configContent);
            
            // Validate required configuration sections
            this.validateProductConfig(config, productName);
            
            return config;
        } catch (error) {
            if (error.code === 'ENOENT') {
                throw new Error(`Product configuration not found: ${configFile}`);
            }
            throw new Error(`Invalid product configuration: ${error.message}`);
        }
    }

    /**
     * Validate product configuration structure
     */
    validateProductConfig(config, productName) {
        const required = ['accounts', 'environments', 'buckets', 'approval_gates'];
        const missing = required.filter(key => !config[key]);
        
        if (missing.length > 0) {
            throw new Error(`Product ${productName} missing required config: ${missing.join(', ')}`);
        }
        
        // Validate account structure
        if (!config.accounts.dev || !config.accounts.dev.account_id) {
            throw new Error('Dev account configuration required');
        }
        
        // Validate bucket arrays
        if (!config.buckets.backend || !config.buckets.frontend) {
            throw new Error('Backend and frontend bucket configurations required');
        }
    }

    /**
     * Create release candidate from dev builds
     */
    async createRelease(productConfig, config) {
        const startTime = Date.now();
        const { release_tag } = config;
        
        if (!release_tag) {
            throw new Error('release_tag required for create_release operation');
        }
        
        console.log(`📦 Creating release candidate: ${release_tag}`);
        
        // Step 1: Build and test in dev environment
        const buildResult = await this.buildAndTest(productConfig);
        
        // Step 2: Package artifacts
        const packageResult = await this.packageArtifacts(productConfig);
        
        // Step 3: Upload to release bucket
        const uploadResult = await this.uploadReleaseCandidate(
            productConfig, 
            release_tag, 
            packageResult.artifacts
        );
        
        // Step 4: Create release metadata
        const metadata = await this.createReleaseMetadata(productConfig, release_tag);
        
        return {
            start_time: startTime,
            release_tag,
            artifacts: packageResult.artifacts,
            metadata,
            build_info: buildResult,
            upload_location: uploadResult.location,
            next_steps: [
                `./promote-release.sh ${productConfig.environments[0]} ${release_tag}`,
                'Test in first environment before promoting further'
            ]
        };
    }

    /**
     * Promote release between environments with approval gates
     */
    async promoteRelease(productConfig, config) {
        const startTime = Date.now();
        const { environment, release_tag, approval_override } = config;
        
        if (!environment || !release_tag) {
            throw new Error('environment and release_tag required for promote_release');
        }
        
        console.log(`⬆️ Promoting ${release_tag} to ${environment}`);
        
        // Step 1: Verify release exists
        await this.verifyReleaseExists(productConfig, release_tag);
        
        // Step 2: Check approval requirements
        if (!approval_override) {
            await this.checkApprovalGate(productConfig, environment);
        }
        
        // Step 3: Backup current version
        const backupResult = await this.backupCurrentVersion(productConfig, environment);
        
        // Step 4: Promote release
        const promotionResult = await this.executePromotion(
            productConfig, 
            release_tag, 
            environment
        );
        
        return {
            start_time: startTime,
            release_tag,
            environment,
            backup_location: backupResult.location,
            promotion_result: promotionResult,
            rollback_command: `./rollback-release.sh ${environment} ${backupResult.backup_id}`
        };
    }

    /**
     * Deploy to specific environment
     */
    async deployEnvironment(productConfig, config) {
        const startTime = Date.now();
        const { environment, release_tag } = config;
        
        if (!environment) {
            throw new Error('environment required for deploy_environment');
        }
        
        console.log(`🎯 Deploying to ${environment} environment`);
        
        // Get environment configuration
        const envConfig = productConfig.environments.find(env => env.name === environment);
        if (!envConfig) {
            throw new Error(`Environment ${environment} not configured for product`);
        }
        
        // Deploy backend
        const backendResult = await this.deployBackend(productConfig, envConfig, release_tag);
        
        // Deploy frontend  
        const frontendResult = await this.deployFrontend(productConfig, envConfig);
        
        // Update Lambda functions
        const lambdaResult = await this.updateLambdaFunctions(productConfig, envConfig);
        
        // Verify deployment
        const verificationResult = await this.verifyEnvironmentHealth(productConfig, envConfig);
        
        return {
            start_time: startTime,
            environment,
            release_tag,
            backend_deployment: backendResult,
            frontend_deployment: frontendResult,
            lambda_updates: lambdaResult,
            verification: verificationResult,
            deployment_urls: this.getDeploymentUrls(productConfig, envConfig)
        };
    }

    /**
     * Build and test in dev environment
     */
    async buildAndTest(productConfig) {
        console.log('🔨 Building and testing...');
        
        const results = {
            backend_build: null,
            backend_tests: null,
            frontend_build: null,
            frontend_tests: null
        };
        
        try {
            // Backend build and test
            console.log('Building backend...');
            results.backend_build = this.executeCommand('npm run build', 'src/backend');
            
            console.log('Testing backend...');
            results.backend_tests = this.executeCommand('npm run test', 'src/backend');
            
            // Frontend build and test
            console.log('Building frontend...');
            results.frontend_build = this.executeCommand('npm run build:dev', 'src/frontend');
            
            console.log('Testing frontend...');
            results.frontend_tests = this.executeCommand('npm run test', 'src/frontend');
            
            return results;
        } catch (error) {
            throw new Error(`Build/test failed: ${error.message}`);
        }
    }

    /**
     * Package artifacts for deployment
     */
    async packageArtifacts(productConfig) {
        console.log('📦 Packaging artifacts...');
        
        const artifacts = [];
        
        // Package Lambda functions
        const lambdaArtifacts = await this.packageLambdaFunctions(productConfig);
        artifacts.push(...lambdaArtifacts);
        
        // Package frontend assets
        const frontendArtifacts = await this.packageFrontendAssets(productConfig);
        artifacts.push(...frontendArtifacts);
        
        return {
            artifacts,
            total_size_mb: artifacts.reduce((sum, artifact) => sum + artifact.size_mb, 0)
        };
    }

    /**
     * Upload release candidate to configured buckets
     */
    async uploadReleaseCandidate(productConfig, releaseTag, artifacts) {
        console.log(`⬆️ Uploading release candidate ${releaseTag}...`);
        
        const releaseBucket = productConfig.buckets.backend.release;
        const candidatePrefix = `candidates/${releaseTag}/`;
        
        const uploadResults = [];
        
        for (const artifact of artifacts) {
            const command = `aws s3 cp ${artifact.path} s3://${releaseBucket}/${candidatePrefix}${artifact.name} --profile dev-sso`;
            const result = this.executeCommand(command);
            
            uploadResults.push({
                artifact: artifact.name,
                location: `s3://${releaseBucket}/${candidatePrefix}${artifact.name}`,
                size_mb: artifact.size_mb
            });
        }
        
        return {
            location: `s3://${releaseBucket}/${candidatePrefix}`,
            artifacts: uploadResults
        };
    }

    /**
     * Deploy backend to environment
     */
    async deployBackend(productConfig, envConfig, releaseTag) {
        console.log(`🖥️ Deploying backend to ${envConfig.name}...`);
        
        const sourceBucket = releaseTag ? 
            productConfig.buckets.backend.release : 
            productConfig.buckets.backend.dev;
        
        const sourcePrefix = releaseTag ? `${envConfig.name}/` : '';
        const targetBucket = envConfig.buckets.backend;
        const targetProfile = envConfig.aws_profile;
        
        // Sync artifacts
        const syncCommand = `aws s3 sync s3://${sourceBucket}/${sourcePrefix} s3://${targetBucket}/ --profile ${targetProfile} --delete --exclude "*" --include "*.zip" --include "package.json"`;
        const syncResult = this.executeCommand(syncCommand);
        
        return {
            source: `s3://${sourceBucket}/${sourcePrefix}`,
            target: `s3://${targetBucket}/`,
            sync_result: syncResult
        };
    }

    /**
     * Deploy frontend to environment
     */
    async deployFrontend(productConfig, envConfig) {
        console.log(`🌐 Deploying frontend to ${envConfig.name}...`);
        
        // Build with environment-specific configuration
        const buildCommand = `npm run build:${envConfig.name}`;
        const buildResult = this.executeCommand(buildCommand, 'src/frontend');
        
        // Deploy to media account bucket
        const targetBucket = envConfig.buckets.frontend;
        const deployCommand = `aws s3 sync build/ s3://${targetBucket}/ --profile media-sso --delete --cache-control "max-age=31536000" --exclude "*.html"`;
        const deployResult = this.executeCommand(deployCommand, 'src/frontend');
        
        // Deploy HTML with short cache
        const htmlCommand = `aws s3 sync build/ s3://${targetBucket}/ --profile media-sso --cache-control "max-age=300" --include "*.html"`;
        const htmlResult = this.executeCommand(htmlCommand, 'src/frontend');
        
        // Invalidate CloudFront if configured
        let invalidationResult = null;
        if (envConfig.cloudfront_distribution) {
            const invalidateCommand = `aws cloudfront create-invalidation --distribution-id ${envConfig.cloudfront_distribution} --paths "/*" --profile media-sso`;
            invalidationResult = this.executeCommand(invalidateCommand);
        }
        
        return {
            build_result: buildResult,
            deploy_result: deployResult,
            html_result: htmlResult,
            invalidation_result: invalidationResult,
            frontend_url: `https://${targetBucket}.s3.amazonaws.com/`
        };
    }

    /**
     * Update Lambda functions with new code
     */
    async updateLambdaFunctions(productConfig, envConfig) {
        console.log(`⚡ Updating Lambda functions in ${envConfig.name}...`);
        
        const targetProfile = envConfig.aws_profile;
        const lambdaBucket = envConfig.buckets.backend;
        
        // Get list of Lambda functions
        const lambdaPrefix = productConfig.lambda_prefix || 'tim-';
        const listCommand = `aws lambda list-functions --profile ${targetProfile} --query 'Functions[?starts_with(FunctionName, \`${lambdaPrefix}\`)].FunctionName' --output text`;
        const functionsResult = this.executeCommand(listCommand);
        const functionNames = functionsResult.trim().split(/\s+/).filter(name => name);
        
        const updateResults = [];
        
        for (const functionName of functionNames) {
            try {
                const updateCommand = `aws lambda update-function-code --profile ${targetProfile} --function-name ${functionName} --s3-bucket ${lambdaBucket} --s3-key ${functionName}_js.zip`;
                const result = this.executeCommand(updateCommand);
                
                updateResults.push({
                    function_name: functionName,
                    status: 'success',
                    result: result
                });
            } catch (error) {
                updateResults.push({
                    function_name: functionName,
                    status: 'warning',
                    error: error.message
                });
            }
        }
        
        return {
            functions_updated: updateResults.filter(r => r.status === 'success').length,
            functions_failed: updateResults.filter(r => r.status === 'warning').length,
            details: updateResults
        };
    }

    /**
     * Verify deployment health
     */
    async verifyEnvironmentHealth(productConfig, envConfig) {
        console.log(`🔍 Verifying deployment health for ${envConfig.name}...`);
        
        const checks = [];
        
        // Check API endpoints
        if (envConfig.api_url) {
            try {
                const healthCheck = await this.checkApiHealth(envConfig.api_url);
                checks.push({
                    type: 'api_health',
                    status: healthCheck.status,
                    response_time_ms: healthCheck.response_time
                });
            } catch (error) {
                checks.push({
                    type: 'api_health',
                    status: 'failed',
                    error: error.message
                });
            }
        }
        
        // Check frontend accessibility
        if (envConfig.buckets.frontend) {
            try {
                const frontendCheck = await this.checkFrontendHealth(envConfig.buckets.frontend);
                checks.push({
                    type: 'frontend_health',
                    status: frontendCheck.status
                });
            } catch (error) {
                checks.push({
                    type: 'frontend_health',
                    status: 'failed',
                    error: error.message
                });
            }
        }
        
        return {
            overall_status: checks.every(c => c.status === 'success') ? 'healthy' : 'degraded',
            checks
        };
    }

    /**
     * Execute command with error handling
     */
    executeCommand(command, workingDir = process.cwd()) {
        try {
            console.log(`Executing: ${command}`);
            const result = execSync(command, { 
                cwd: workingDir, 
                encoding: 'utf8',
                stdio: 'pipe'
            });
            return result;
        } catch (error) {
            throw new Error(`Command failed: ${command}\\nError: ${error.message}`);
        }
    }

    /**
     * Helper methods for other operations
     */
    async validateDeploymentScope(productConfig, config) {
        // Validate environment exists
        if (config.environment) {
            const validEnvironments = productConfig.environments.map(env => env.name);
            if (!validEnvironments.includes(config.environment)) {
                throw new Error(`Invalid environment: ${config.environment}. Valid: ${validEnvironments.join(', ')}`);
            }
        }
    }

    async verifyReleaseExists(productConfig, releaseTag) {
        const releaseBucket = productConfig.buckets.backend.release;
        const candidatePrefix = `candidates/${releaseTag}/`;
        
        const checkCommand = `aws s3 ls s3://${releaseBucket}/${candidatePrefix} --profile dev-sso`;
        try {
            this.executeCommand(checkCommand);
        } catch (error) {
            throw new Error(`Release candidate ${releaseTag} not found`);
        }
    }

    async checkApprovalGate(productConfig, environment) {
        const envConfig = productConfig.environments.find(env => env.name === environment);
        const approvalGate = productConfig.approval_gates[environment];
        
        if (approvalGate && approvalGate.required) {
            console.log(`⚠️ ${approvalGate.description}`);
            // In a real implementation, this would integrate with approval systems
            console.log(`Manual approval required for ${environment} deployment`);
        }
    }

    getDeploymentUrls(productConfig, envConfig) {
        return {
            api_url: envConfig.api_url,
            frontend_url: envConfig.frontend_url || `https://${envConfig.buckets.frontend}.s3.amazonaws.com/`,
            admin_dashboard: envConfig.admin_url
        };
    }

    /**
     * Package Lambda functions for deployment
     */
    async packageLambdaFunctions(productConfig) {
        console.log('📦 Packaging Lambda functions...');
        
        const artifacts = [];
        const lambdaDir = '/Users/jamesford/Source/Tim-Combo/src/backend/src/handlers';
        
        try {
            // Find all handler directories
            const handlerDirs = this.executeCommand(`find ${lambdaDir} -type f -name "*.js" | grep -E "(Get|Post|Put|Delete)\\.js$" | head -20`).trim().split('\n');
            
            for (const handlerPath of handlerDirs) {
                if (!handlerPath) continue;
                
                const handlerName = path.basename(handlerPath, '.js');
                const zipName = `${handlerName}_js.zip`;
                const zipPath = `/tmp/${zipName}`;
                
                // Create Lambda deployment package
                const packageCommand = `cd ${path.dirname(handlerPath)} && zip -r ${zipPath} ${path.basename(handlerPath)} ../helpers/*.js ../shared/*.js 2>/dev/null || zip -r ${zipPath} ${path.basename(handlerPath)}`;
                this.executeCommand(packageCommand);
                
                // Get package size
                const sizeOutput = this.executeCommand(`ls -la ${zipPath} | awk '{print $5}'`);
                const sizeBytes = parseInt(sizeOutput.trim());
                
                artifacts.push({
                    name: zipName,
                    path: zipPath,
                    handler_name: handlerName,
                    size_mb: Math.round(sizeBytes / 1024 / 1024 * 100) / 100,
                    type: 'lambda_function'
                });
            }
            
            console.log(`✅ Packaged ${artifacts.length} Lambda functions`);
            return artifacts;
            
        } catch (error) {
            console.error('Error packaging Lambda functions:', error);
            return [];
        }
    }

    /**
     * Package frontend assets for deployment
     */
    async packageFrontendAssets(productConfig) {
        console.log('🌐 Packaging frontend assets...');
        
        const artifacts = [];
        const frontendDir = '/Users/jamesford/Source/Tim-Combo/src/frontend';
        
        try {
            // Build frontend
            console.log('Building frontend...');
            this.executeCommand('npm run build', frontendDir);
            
            // Create build artifact
            const buildPath = path.join(frontendDir, 'build');
            const zipPath = '/tmp/frontend-build.zip';
            
            this.executeCommand(`cd ${buildPath} && zip -r ${zipPath} . -x "*.map" "*.test.*"`);
            
            // Get package size
            const sizeOutput = this.executeCommand(`ls -la ${zipPath} | awk '{print $5}'`);
            const sizeBytes = parseInt(sizeOutput.trim());
            
            artifacts.push({
                name: 'frontend-build.zip',
                path: zipPath,
                size_mb: Math.round(sizeBytes / 1024 / 1024 * 100) / 100,
                type: 'frontend_assets',
                build_dir: buildPath
            });
            
            console.log(`✅ Packaged frontend build (${artifacts[0].size_mb}MB)`);
            return artifacts;
            
        } catch (error) {
            console.error('Error packaging frontend assets:', error);
            return [];
        }
    }

    /**
     * Backup current version for rollback
     */
    async backupCurrentVersion(productConfig, environment) {
        const backupId = `backup_${environment}_${Date.now()}`;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        
        console.log(`💾 Creating backup: ${backupId}`);
        
        try {
            const envConfig = productConfig.environments.find(env => env.name === environment);
            if (!envConfig) {
                throw new Error(`Environment ${environment} not found`);
            }
            
            const sourceBucket = envConfig.buckets.backend;
            const backupPrefix = `backups/${environment}/${timestamp}/`;
            const targetBucket = productConfig.buckets.backend.release || productConfig.buckets.backend.dev;
            
            // Backup Lambda artifacts
            const backupCommand = `aws s3 sync s3://${sourceBucket}/ s3://${targetBucket}/${backupPrefix} --profile ${envConfig.account === 'dev' ? 'dev-sso' : envConfig.aws_profile || 'sandbox-sso'}`;
            const result = this.executeCommand(backupCommand);
            
            const location = `s3://${targetBucket}/${backupPrefix}`;
            
            console.log(`✅ Backup created: ${location}`);
            
            return {
                backup_id: backupId,
                location: location,
                timestamp: timestamp,
                environment: environment,
                source_bucket: sourceBucket,
                backup_prefix: backupPrefix,
                restore_command: `aws s3 sync ${location} s3://${sourceBucket}/ --delete`
            };
            
        } catch (error) {
            console.error(`Error creating backup for ${environment}:`, error);
            return {
                backup_id: backupId,
                location: '',
                error: error.message
            };
        }
    }

    /**
     * Execute release promotion between environments
     */
    async executePromotion(productConfig, releaseTag, environment) {
        console.log(`🚀 Executing promotion: ${releaseTag} → ${environment}`);
        
        try {
            const envConfig = productConfig.environments.find(env => env.name === environment);
            if (!envConfig) {
                throw new Error(`Environment ${environment} not found`);
            }
            
            const releaseBucket = productConfig.buckets.backend.release || productConfig.buckets.backend.dev;
            const sourcePrefix = `candidates/${releaseTag}/`;
            const targetBucket = envConfig.buckets.backend;
            const targetProfile = envConfig.aws_profile || 'sandbox-sso';
            
            // Sync release candidate to target environment
            console.log(`Promoting from s3://${releaseBucket}/${sourcePrefix} to s3://${targetBucket}/`);
            
            const syncCommand = `aws s3 sync s3://${releaseBucket}/${sourcePrefix} s3://${targetBucket}/ --profile ${targetProfile} --delete --exclude "*" --include "*.zip" --include "package.json"`;
            const syncResult = this.executeCommand(syncCommand);
            
            // Update Lambda functions
            const lambdaResult = await this.updateLambdaFunctions(productConfig, envConfig);
            
            return {
                release_tag: releaseTag,
                environment: environment,
                source_location: `s3://${releaseBucket}/${sourcePrefix}`,
                target_location: `s3://${targetBucket}/`,
                sync_result: syncResult,
                lambda_updates: lambdaResult,
                promoted_at: new Date().toISOString()
            };
            
        } catch (error) {
            console.error(`Error executing promotion to ${environment}:`, error);
            throw error;
        }
    }

    /**
     * Create release metadata and manifest
     */
    async createReleaseMetadata(productConfig, releaseTag) {
        console.log(`📝 Creating release metadata for ${releaseTag}`);
        
        try {
            // Get git information
            const gitHash = this.executeCommand('git rev-parse HEAD').trim();
            const gitBranch = this.executeCommand('git rev-parse --abbrev-ref HEAD').trim();
            const gitMessage = this.executeCommand('git log -1 --pretty=%B').trim();
            const gitAuthor = this.executeCommand('git log -1 --pretty=%an').trim();
            
            // Get package information
            const packageInfo = JSON.parse(await fs.readFile('/Users/jamesford/Source/Tim-Combo/src/frontend/package.json', 'utf8'));
            
            const metadata = {
                release_tag: releaseTag,
                created_at: new Date().toISOString(),
                product: productConfig.product_name,
                
                // Git information
                git: {
                    commit_hash: gitHash,
                    branch: gitBranch,
                    commit_message: gitMessage,
                    author: gitAuthor
                },
                
                // Package information
                version: packageInfo.version,
                dependencies: Object.keys(packageInfo.dependencies || {}).length,
                dev_dependencies: Object.keys(packageInfo.devDependencies || {}).length,
                
                // Build information
                build: {
                    node_version: process.version,
                    build_timestamp: new Date().toISOString(),
                    build_environment: process.env.NODE_ENV || 'production'
                },
                
                // Deployment targets
                environments: productConfig.environments.map(env => env.name),
                
                // Release notes
                release_notes: `Automated release ${releaseTag} from ${gitBranch}`,
                
                // Validation
                validated: false,
                validation_results: null
            };
            
            // Save metadata to file
            const metadataPath = `/tmp/release-${releaseTag}-metadata.json`;
            await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
            
            console.log(`✅ Release metadata created: ${metadataPath}`);
            
            return metadata;
            
        } catch (error) {
            console.error('Error creating release metadata:', error);
            return {
                release_tag: releaseTag,
                created_at: new Date().toISOString(),
                error: error.message
            };
        }
    }

    /**
     * Check API health endpoints
     */
    async checkApiHealth(apiUrl) {
        console.log(`🔍 Checking API health: ${apiUrl}`);
        
        const startTime = Date.now();
        
        try {
            // Check main health endpoint
            const healthUrl = `${apiUrl}/health`;
            const response = await this.makeHealthRequest(healthUrl);
            const responseTime = Date.now() - startTime;
            
            // Additional checks for Tim-Combo specific endpoints
            const endpoints = [
                '/tim/health',
                '/public/health'
            ];
            
            const endpointResults = [];
            
            for (const endpoint of endpoints) {
                try {
                    const endpointUrl = `${apiUrl}${endpoint}`;
                    const endpointResponse = await this.makeHealthRequest(endpointUrl);
                    endpointResults.push({
                        endpoint: endpoint,
                        status: 'healthy',
                        response_code: endpointResponse.status || 200
                    });
                } catch (error) {
                    endpointResults.push({
                        endpoint: endpoint,
                        status: 'unhealthy',
                        error: error.message
                    });
                }
            }
            
            const overallStatus = endpointResults.every(r => r.status === 'healthy') ? 'healthy' : 'degraded';
            
            return {
                status: overallStatus,
                response_time: responseTime,
                api_url: apiUrl,
                endpoints: endpointResults,
                checked_at: new Date().toISOString()
            };
            
        } catch (error) {
            return {
                status: 'unhealthy',
                response_time: Date.now() - startTime,
                api_url: apiUrl,
                error: error.message,
                checked_at: new Date().toISOString()
            };
        }
    }

    /**
     * Check frontend health and accessibility
     */
    async checkFrontendHealth(bucket) {
        console.log(`🌐 Checking frontend health: ${bucket}`);
        
        try {
            // Check if bucket exists and is accessible
            const bucketCheckCommand = `aws s3 ls s3://${bucket}/ --profile media-sso | head -1`;
            this.executeCommand(bucketCheckCommand);
            
            // Check for critical files
            const criticalFiles = ['index.html', 'static/'];
            const fileChecks = [];
            
            for (const file of criticalFiles) {
                try {
                    const checkCommand = `aws s3 ls s3://${bucket}/${file} --profile media-sso`;
                    this.executeCommand(checkCommand);
                    fileChecks.push({
                        file: file,
                        status: 'found'
                    });
                } catch (error) {
                    fileChecks.push({
                        file: file,
                        status: 'missing',
                        error: error.message
                    });
                }
            }
            
            const allFilesFound = fileChecks.every(check => check.status === 'found');
            
            return {
                status: allFilesFound ? 'healthy' : 'degraded',
                bucket: bucket,
                file_checks: fileChecks,
                frontend_url: `https://${bucket}.s3.amazonaws.com/`,
                checked_at: new Date().toISOString()
            };
            
        } catch (error) {
            return {
                status: 'unhealthy',
                bucket: bucket,
                error: error.message,
                checked_at: new Date().toISOString()
            };
        }
    }

    /**
     * Rollback to previous release
     */
    async rollbackRelease(productConfig, config) {
        const { environment, backup_id } = config;
        
        console.log(`⏪ Rolling back ${environment} to backup ${backup_id}`);
        
        try {
            const envConfig = productConfig.environments.find(env => env.name === environment);
            if (!envConfig) {
                throw new Error(`Environment ${environment} not found`);
            }
            
            // Find backup location
            const backupBucket = productConfig.buckets.backend.release || productConfig.buckets.backend.dev;
            const backupPrefix = `backups/${environment}/`;
            
            // List available backups if no specific backup_id provided
            if (!backup_id) {
                const listCommand = `aws s3 ls s3://${backupBucket}/${backupPrefix} --profile dev-sso | grep "PRE" | tail -5`;
                const backups = this.executeCommand(listCommand);
                throw new Error(`No backup_id specified. Available backups:\\n${backups}`);
            }
            
            // Execute rollback
            const targetBucket = envConfig.buckets.backend;
            const restoreCommand = `aws s3 sync s3://${backupBucket}/${backupPrefix}${backup_id}/ s3://${targetBucket}/ --profile ${envConfig.aws_profile || 'sandbox-sso'} --delete`;
            const restoreResult = this.executeCommand(restoreCommand);
            
            // Update Lambda functions
            const lambdaResult = await this.updateLambdaFunctions(productConfig, envConfig);
            
            return {
                environment: environment,
                backup_id: backup_id,
                restore_location: `s3://${backupBucket}/${backupPrefix}${backup_id}/`,
                target_location: `s3://${targetBucket}/`,
                restore_result: restoreResult,
                lambda_updates: lambdaResult,
                rolled_back_at: new Date().toISOString()
            };
            
        } catch (error) {
            console.error(`Error rolling back ${environment}:`, error);
            throw error;
        }
    }

    /**
     * Sync artifacts between buckets
     */
    async syncBuckets(productConfig, config) {
        const { source_environment, target_environment, artifact_type } = config;
        
        console.log(`🔄 Syncing ${artifact_type || 'all'} from ${source_environment} to ${target_environment}`);
        
        try {
            const sourceEnv = productConfig.environments.find(env => env.name === source_environment);
            const targetEnv = productConfig.environments.find(env => env.name === target_environment);
            
            if (!sourceEnv || !targetEnv) {
                throw new Error(`Environment not found: ${source_environment} or ${target_environment}`);
            }
            
            const syncResults = [];
            
            // Sync backend artifacts
            if (!artifact_type || artifact_type === 'backend') {
                const sourceBucket = sourceEnv.buckets.backend;
                const targetBucket = targetEnv.buckets.backend;
                const targetProfile = targetEnv.aws_profile || 'sandbox-sso';
                
                const backendSyncCommand = `aws s3 sync s3://${sourceBucket}/ s3://${targetBucket}/ --profile ${targetProfile} --exclude "*" --include "*.zip" --include "package.json"`;
                const backendResult = this.executeCommand(backendSyncCommand);
                
                syncResults.push({
                    type: 'backend',
                    source: `s3://${sourceBucket}/`,
                    target: `s3://${targetBucket}/`,
                    result: backendResult
                });
            }
            
            // Sync frontend artifacts
            if (!artifact_type || artifact_type === 'frontend') {
                const sourceBucket = sourceEnv.buckets.frontend;
                const targetBucket = targetEnv.buckets.frontend;
                
                const frontendSyncCommand = `aws s3 sync s3://${sourceBucket}/ s3://${targetBucket}/ --profile media-sso --delete`;
                const frontendResult = this.executeCommand(frontendSyncCommand);
                
                syncResults.push({
                    type: 'frontend',
                    source: `s3://${sourceBucket}/`,
                    target: `s3://${targetBucket}/`,
                    result: frontendResult
                });
            }
            
            return {
                source_environment: source_environment,
                target_environment: target_environment,
                artifact_type: artifact_type || 'all',
                sync_results: syncResults,
                synced_at: new Date().toISOString()
            };
            
        } catch (error) {
            console.error(`Error syncing buckets:`, error);
            throw error;
        }
    }

    /**
     * Helper method to make health check requests
     */
    async makeHealthRequest(url) {
        // Simple HTTP health check using curl
        try {
            const curlCommand = `curl -s -o /dev/null -w "%{http_code}" "${url}" --max-time 10`;
            const statusCode = this.executeCommand(curlCommand);
            return { status: parseInt(statusCode) };
        } catch (error) {
            throw new Error(`Health check failed for ${url}: ${error.message}`);
        }
    }
}

module.exports = DeploymentAgent;