#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');

class FriendsFamilySecurityChecker {
    constructor() {
        this.projectRoot = '/Users/jamesford/Source/Waves';
        this.criticalFindings = [];
        this.highFindings = [];
        this.mediumFindings = [];
    }

    async runAssessment() {
        console.log('🔒 Friends & Family Security Assessment for Waves\n');
        
        // Check for actual hardcoded secrets (not env vars)
        await this.checkForActualHardcodedSecrets();
        
        // Check for required security files
        await this.checkSecurityInfrastructure();
        
        // Check for production environment configuration
        await this.checkEnvironmentConfiguration();
        
        // Check for basic security patterns
        await this.checkBasicSecurityPatterns();
        
        return this.generateReport();
    }

    async checkForActualHardcodedSecrets() {
        console.log('🔍 Checking for hardcoded secrets...');
        
        // Patterns that indicate ACTUAL hardcoded secrets (not env vars)
        const secretPatterns = [
            /['"]sk_[a-zA-Z0-9]{24,}['"]/, // Stripe secret keys
            /['"]pk_[a-zA-Z0-9]{24,}['"]/, // Stripe public keys  
            /['"]AKIA[0-9A-Z]{16}['"]/, // AWS access keys
            /password\s*[:=]\s*['"][^'"]+['"]/, // Literal passwords
            /secret\s*[:=]\s*['"][a-zA-Z0-9]{16,}['"]/, // Literal secrets
            /token\s*[:=]\s*['"][a-zA-Z0-9]{16,}['"]/, // Literal tokens
        ];
        
        try {
            const files = await this.getSourceFiles();
            
            for (const file of files) {
                const content = await fs.readFile(file, 'utf8');
                const lines = content.split('\n');
                
                lines.forEach((line, index) => {
                    // Skip lines that are clearly using environment variables
                    if (line.includes('process.env') || 
                        line.includes('process.env.') ||
                        line.includes('env.') ||
                        line.includes('dotenv') ||
                        line.includes('config.') ||
                        line.includes('// ') ||
                        line.includes('* ')) {
                        return;
                    }
                    
                    secretPatterns.forEach(pattern => {
                        if (pattern.test(line)) {
                            this.criticalFindings.push({
                                type: 'hardcoded_secret',
                                message: 'Actual hardcoded secret detected',
                                location: `${file}:${index + 1}`,
                                code: line.trim(),
                                severity: 'critical'
                            });
                        }
                    });
                });
            }
        } catch (error) {
            console.log(`   ⚠️ Error scanning files: ${error.message}`);
        }
        
        console.log(`   Found ${this.criticalFindings.length} hardcoded secrets\n`);
    }

    async checkSecurityInfrastructure() {
        console.log('🛡️ Checking security infrastructure...');
        
        const requiredSecurityFiles = [
            { path: '.env.example', required: true, description: 'Environment variable template' },
            { path: '.gitignore', required: true, description: 'Git ignore file' },
            { path: 'backend/src/middleware/auth.ts', required: true, description: 'Authentication middleware' },
            { path: 'backend/src/config/index.ts', required: true, description: 'Configuration management' }
        ];
        
        for (const file of requiredSecurityFiles) {
            const filePath = path.join(this.projectRoot, file.path);
            try {
                await fs.access(filePath);
                console.log(`   ✅ ${file.description} exists`);
            } catch (error) {
                this.highFindings.push({
                    type: 'missing_security_file',
                    message: `Missing ${file.description}`,
                    location: file.path,
                    severity: 'high',
                    fix: `Create ${file.path}`
                });
                console.log(`   ❌ ${file.description} missing`);
            }
        }
        
        console.log('');
    }

    async checkEnvironmentConfiguration() {
        console.log('🌍 Checking environment configuration...');
        
        try {
            // Check if .env files are properly gitignored
            const gitignorePath = path.join(this.projectRoot, '.gitignore');
            const gitignoreContent = await fs.readFile(gitignorePath, 'utf8');
            
            if (!gitignoreContent.includes('.env')) {
                this.highFindings.push({
                    type: 'env_not_ignored',
                    message: '.env files not properly ignored in git',
                    location: '.gitignore',
                    severity: 'high',
                    fix: 'Add .env* to .gitignore'
                });
                console.log('   ❌ .env files not in .gitignore');
            } else {
                console.log('   ✅ .env files properly ignored');
            }
            
            // Check for .env.example
            try {
                await fs.access(path.join(this.projectRoot, '.env.example'));
                console.log('   ✅ .env.example exists');
            } catch {
                this.mediumFindings.push({
                    type: 'missing_env_example',
                    message: '.env.example template missing',
                    location: '.env.example',
                    severity: 'medium',
                    fix: 'Create .env.example with required variables'
                });
                console.log('   ⚠️ .env.example missing');
            }
            
        } catch (error) {
            console.log(`   ⚠️ Error checking environment config: ${error.message}`);
        }
        
        console.log('');
    }

    async checkBasicSecurityPatterns() {
        console.log('🔐 Checking basic security patterns...');
        
        // Check for console.log in production files (excluding development/test files)
        try {
            const productionFiles = await this.getProductionFiles();
            let consoleLogCount = 0;
            
            for (const file of productionFiles) {
                const content = await fs.readFile(file, 'utf8');
                const matches = content.match(/console\.log\(/g);
                if (matches) {
                    consoleLogCount += matches.length;
                }
            }
            
            if (consoleLogCount > 0) {
                this.mediumFindings.push({
                    type: 'console_logging',
                    message: `Found ${consoleLogCount} console.log statements in production code`,
                    location: 'various files',
                    severity: 'medium',
                    fix: 'Replace with proper logging system'
                });
                console.log(`   ⚠️ ${consoleLogCount} console.log statements found`);
            } else {
                console.log('   ✅ No problematic console.log statements');
            }
            
        } catch (error) {
            console.log(`   ⚠️ Error checking logging: ${error.message}`);
        }
        
        console.log('');
    }

    async getSourceFiles() {
        const extensions = ['.ts', '.js', '.tsx', '.jsx'];
        const excludeDirs = ['node_modules', '.git', 'dist', 'build'];
        
        return await this.getFilesRecursive(this.projectRoot, extensions, excludeDirs);
    }

    async getProductionFiles() {
        const extensions = ['.ts', '.js'];
        const excludeDirs = ['node_modules', '.git', 'dist', 'build', 'tests', 'test', '__tests__'];
        
        return await this.getFilesRecursive(path.join(this.projectRoot, 'backend/src'), extensions, excludeDirs);
    }

    async getFilesRecursive(dir, extensions, excludeDirs) {
        const files = [];
        
        try {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                
                if (entry.isDirectory() && !excludeDirs.includes(entry.name)) {
                    files.push(...await this.getFilesRecursive(fullPath, extensions, excludeDirs));
                } else if (entry.isFile()) {
                    const ext = path.extname(entry.name);
                    if (extensions.includes(ext)) {
                        files.push(fullPath);
                    }
                }
            }
        } catch (error) {
            // Directory might not exist
        }
        
        return files;
    }

    generateReport() {
        const totalFindings = this.criticalFindings.length + this.highFindings.length + this.mediumFindings.length;
        
        console.log('📊 Security Assessment Results');
        console.log('===============================\n');
        
        console.log('🚨 Findings Summary:');
        console.log(`   Critical: ${this.criticalFindings.length}`);
        console.log(`   High: ${this.highFindings.length}`);
        console.log(`   Medium: ${this.mediumFindings.length}`);
        console.log(`   Total: ${totalFindings}\n`);
        
        // Show findings
        if (this.criticalFindings.length > 0) {
            console.log('🔴 CRITICAL FINDINGS:');
            this.criticalFindings.forEach(finding => {
                console.log(`   • ${finding.message}`);
                console.log(`     Location: ${finding.location}`);
                if (finding.code) console.log(`     Code: ${finding.code}`);
                console.log('');
            });
        }
        
        if (this.highFindings.length > 0) {
            console.log('🟠 HIGH PRIORITY FINDINGS:');
            this.highFindings.forEach(finding => {
                console.log(`   • ${finding.message}`);
                console.log(`     Location: ${finding.location}`);
                console.log(`     Fix: ${finding.fix || 'Review security documentation'}`);
                console.log('');
            });
        }
        
        if (this.mediumFindings.length > 0) {
            console.log('🟡 MEDIUM PRIORITY FINDINGS:');
            this.mediumFindings.forEach(finding => {
                console.log(`   • ${finding.message}`);
                console.log(`     Location: ${finding.location}`);
                console.log(`     Fix: ${finding.fix || 'Review and address'}`);
                console.log('');
            });
        }
        
        // Friends & Family Deployment Assessment
        console.log('🏠 Friends & Family Deployment Readiness:');
        
        const criticalBlocks = this.criticalFindings.length;
        const highBlocks = this.highFindings.length;
        
        if (criticalBlocks === 0 && highBlocks === 0) {
            console.log('   ✅ READY for friends & family deployment');
            console.log('   ✅ No critical security vulnerabilities');
            console.log('   ✅ Basic security infrastructure in place');
            console.log('   💰 Estimated monthly cost: $25-50');
        } else if (criticalBlocks === 0 && highBlocks <= 2) {
            console.log('   ⚠️  CONDITIONAL - Address high priority findings first');
            console.log('   ✅ No critical security vulnerabilities');
            console.log('   📋 Fix high priority items before deployment');
            console.log('   💰 Estimated monthly cost: $25-50');
        } else if (criticalBlocks === 0) {
            console.log('   ⚠️  NEEDS WORK - Multiple security gaps to address');
            console.log('   ✅ No critical vulnerabilities');
            console.log('   🔧 Address security infrastructure gaps');
            console.log('   💰 May need enhanced security ($60-100/month)');
        } else {
            console.log('   ❌ NOT READY - Critical vulnerabilities must be fixed');
            console.log('   🚨 Address critical findings immediately');
            console.log('   🔧 Complete security infrastructure setup');
        }
        
        console.log('\n🌊 Waves Security Assessment Complete');
        
        return {
            ready: criticalBlocks === 0 && highBlocks <= 2,
            critical: criticalBlocks,
            high: highBlocks,
            medium: this.mediumFindings.length,
            findings: {
                critical: this.criticalFindings,
                high: this.highFindings,
                medium: this.mediumFindings
            }
        };
    }
}

async function main() {
    const checker = new FriendsFamilySecurityChecker();
    const results = await checker.runAssessment();
    
    // Exit with appropriate code
    process.exit(results.ready ? 0 : 1);
}

if (require.main === module) {
    main();
}

module.exports = FriendsFamilySecurityChecker;