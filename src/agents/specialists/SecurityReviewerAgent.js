// SecurityReviewerAgent.js - Comprehensive security analysis with production cost controls
// Based on Tim-Combo security roadmap and validation patterns

const fs = require('fs').promises;
const path = require('path');

class SecurityReviewerAgent {
    constructor(config = {}) {
        this.config = {
            projectRoot: config.projectRoot || process.cwd(),
            securityThresholds: config.securityThresholds || this.getDefaultThresholds(),
            complianceLevel: config.complianceLevel || 'production',
            costTolerance: config.costTolerance || 'balanced',
            ...config
        };
        
        this.securityPatterns = this.initializeSecurityPatterns();
        this.vulnerabilityDatabase = this.initializeVulnerabilityDatabase();
        this.productionControls = this.initializeProductionControls();
    }

    getDefaultThresholds() {
        return {
            // From security-roadmap.md - Progressive security enhancement thresholds
            basic: {
                maxUsers: 10,
                maxCompanies: 5,
                requiredControls: ['basic_auth', 'input_validation', 'error_handling']
            },
            enhanced: {
                maxUsers: 100,
                maxCompanies: 20,
                requiredControls: ['mfa', 'rbac', 'audit_logging', 'secure_storage']
            },
            advanced: {
                maxUsers: 1000,
                maxCompanies: 100,
                requiredControls: ['zero_trust', 'continuous_monitoring', 'incident_response']
            },
            enterprise: {
                maxUsers: Infinity,
                maxCompanies: Infinity,
                requiredControls: ['formal_verification', 'compliance_automation', 'threat_modeling']
            }
        };
    }

    initializeSecurityPatterns() {
        return {
            // From tech_stack_security.md
            authentication: {
                patterns: [
                    'AWS Cognito integration',
                    'JWT token validation',
                    'Multi-factor authentication',
                    'Custom authentication flows'
                ],
                antiPatterns: [
                    'Hardcoded credentials',
                    'Weak password policies',
                    'Token exposure in logs',
                    'Session fixation vulnerabilities'
                ]
            },
            
            authorization: {
                patterns: [
                    'Role-Based Access Control (RBAC)',
                    'Context-based authorization',
                    'Least privilege enforcement',
                    'Permission structure validation'
                ],
                antiPatterns: [
                    'Overly permissive roles',
                    'Missing context validation',
                    'Privilege escalation paths',
                    'Inconsistent access controls'
                ]
            },

            dataProtection: {
                patterns: [
                    'AES-256 encryption at rest',
                    'TLS 1.2+ for data in transit',
                    'PII tokenization',
                    'Audit trails for sensitive data'
                ],
                antiPatterns: [
                    'Unencrypted sensitive data',
                    'PII in logs or error messages',
                    'Weak encryption algorithms',
                    'Missing data retention policies'
                ]
            },

            inputValidation: {
                patterns: [
                    'Typed schemas (Zod/Joi/AJV)',
                    'Input sanitization',
                    'Output encoding',
                    'Content-Type enforcement'
                ],
                antiPatterns: [
                    'Unvalidated user inputs',
                    'SQL injection vulnerabilities',
                    'XSS attack vectors',
                    'Command injection risks'
                ]
            },

            errorHandling: {
                patterns: [
                    'Structured error responses',
                    'No sensitive information in errors',
                    'Client-friendly error messages',
                    'Appropriate error logging'
                ],
                antiPatterns: [
                    'Stack traces in production errors',
                    'Database connection strings in errors',
                    'Internal system details exposed',
                    'Debugging information leaks'
                ]
            },

            infrastructure: {
                patterns: [
                    'VPC security groups',
                    'Private subnets for databases',
                    'WAF for public endpoints',
                    'Network ACLs'
                ],
                antiPatterns: [
                    'Overly permissive security groups',
                    'Public database access',
                    'Missing network segmentation',
                    'Unmonitored network traffic'
                ]
            }
        };
    }

    initializeVulnerabilityDatabase() {
        return {
            // From validate-security.sh patterns
            criticalVulnerabilities: [
                {
                    type: 'hardcoded_secrets',
                    patterns: [
                        'password\\s*[=:]\\s*["\']\\w+["\']',
                        'secret\\s*[=:]\\s*["\']\\w+["\']', 
                        'api[_-]?key\\s*[=:]\\s*["\']\\w+["\']',
                        'access[_-]?token\\s*[=:]\\s*["\']\\w+["\']',
                        'private[_-]?key\\s*[=:]\\s*["\']\\w+["\']'
                    ],
                    severity: 'critical',
                    impact: 'credential_exposure'
                },
                {
                    type: 'console_logging',
                    patterns: ['console\\.log.*password', 'console\\.log.*secret', 'console\\.log'],
                    severity: 'high',
                    impact: 'information_disclosure'
                },
                {
                    type: 'cors_wildcard',
                    patterns: ['AllowOrigin:.*\\*', "'\\*'"],
                    severity: 'medium',
                    impact: 'cross_origin_attacks'
                },
                {
                    type: 'weak_tls',
                    patterns: ['TLSv1\\.0', 'TLSv1\\.1', 'SSL'],
                    severity: 'high',
                    impact: 'man_in_the_middle'
                }
            ],
            
            securityRequirements: [
                'Secure logging implementation',
                'Environment validation framework',
                'CORS configuration security',
                'SSL/TLS validation framework',
                'Response utility security updates',
                'Database client security',
                'Console.log migration completion',
                'Environment variables security',
                'Security documentation',
                'Rollback procedures'
            ]
        };
    }

    initializeProductionControls() {
        return {
            // From security-roadmap.md production thresholds
            costControlThresholds: {
                lowCost: {
                    monthlyBudget: 1000,
                    controls: ['basic_monitoring', 'automated_backups']
                },
                mediumCost: {
                    monthlyBudget: 5000,
                    controls: ['enhanced_monitoring', 'incident_response', 'compliance_reporting']
                },
                highCost: {
                    monthlyBudget: 15000,
                    controls: ['24x7_monitoring', 'threat_intelligence', 'formal_audits']
                }
            },

            productionGates: {
                preDeployment: [
                    'Security validation passing',
                    'Vulnerability scan clean',
                    'Penetration test completed',
                    'Compliance checks passed'
                ],
                postDeployment: [
                    'Monitoring active',
                    'Incident response ready',
                    'Backup verification',
                    'Performance baselines established'
                ]
            },

            emergencyProcedures: {
                securityIncident: [
                    'Isolate affected systems',
                    'Preserve evidence',
                    'Notify stakeholders',
                    'Execute containment plan'
                ],
                dataBreach: [
                    'Assess scope of exposure',
                    'Notify authorities within 72 hours',
                    'Customer notification plan',
                    'Forensic investigation'
                ]
            }
        };
    }

    async performSecurityReview(options = {}) {
        const review = {
            timestamp: new Date().toISOString(),
            projectPath: options.projectPath || this.config.projectRoot,
            reviewType: options.reviewType || 'comprehensive',
            findings: [],
            recommendations: [],
            costAnalysis: {},
            complianceStatus: {},
            riskAssessment: {},
            systemMetrics: {}
        };

        try {
            // 1. System Metrics Analysis (understand actual infrastructure)
            review.systemMetrics = await this.assessSystemMetrics(review.projectPath);
            
            // 2. Static Analysis
            review.findings.push(...await this.performStaticAnalysis(review.projectPath));
            
            // 3. Pattern Analysis
            review.findings.push(...await this.analyzeSecurityPatterns(review.projectPath));
            
            // 4. Production Readiness
            review.complianceStatus = await this.assessProductionReadiness(review.projectPath);
            
            // 5. Cost Analysis (with realistic system metrics)
            review.costAnalysis = await this.analyzeCostImplications(review.findings, review.systemMetrics);
            
            // 6. Risk Assessment
            review.riskAssessment = await this.assessSecurityRisks(review.findings);
            
            // 7. Generate Recommendations
            review.recommendations = await this.generateRecommendations(review);
            
            return review;
            
        } catch (error) {
            review.findings.push({
                type: 'analysis_error',
                severity: 'high',
                message: `Security analysis failed: ${error.message}`,
                location: 'SecurityReviewerAgent'
            });
            return review;
        }
    }

    async assessSystemMetrics(projectPath) {
        const metrics = {
            architecture: 'serverless_arm64', // Default assumption for modern AWS
            monthlyInfrastructureCost: 50, // Realistic baseline
            lambdaCount: 0,
            databaseType: 'unknown',
            userCount: 'development',
            environmentType: 'development'
        };

        try {
            // Detect Lambda architecture from SAM templates
            const samTemplates = [
                path.join(projectPath, 'IAC/sam/dev_stuff/deployAPI/lambda_with_auth.yaml'),
                path.join(projectPath, 'IAC/sam/dev_stuff/SB_Flux/lambda_with_auth_updated.yaml')
            ];

            for (const templatePath of samTemplates) {
                try {
                    const content = await fs.readFile(templatePath, 'utf8');
                    
                    // Check for ARM64 architecture
                    if (content.includes('arm64')) {
                        metrics.architecture = 'serverless_arm64';
                    }
                    
                    // Check for database type
                    if (content.includes('t4g.micro')) {
                        metrics.databaseType = 'rds_postgresql_t4g_micro_arm64';
                        metrics.monthlyInfrastructureCost = 43; // ARM64 cost advantage
                    } else if (content.includes('t3.micro')) {
                        metrics.databaseType = 'rds_postgresql_t3_micro';
                        metrics.monthlyInfrastructureCost = 50;
                    }
                    
                    // Determine environment type
                    if (templatePath.includes('SB_Flux')) {
                        metrics.environmentType = 'sandbox';
                        metrics.userCount = 'pilot_testing';
                    } else if (templatePath.includes('deployAPI')) {
                        metrics.environmentType = 'development';
                        metrics.userCount = 'development';
                    }
                    
                } catch (error) {
                    // Template file might not exist
                }
            }

            // Count Lambda handlers
            const handlersDir = path.join(projectPath, 'src/backend/src/handlers');
            try {
                const handlerCount = await this.countLambdaHandlers(handlersDir);
                metrics.lambdaCount = handlerCount;
                
                // Adjust cost estimates based on actual Lambda count
                if (handlerCount > 100) {
                    metrics.monthlyInfrastructureCost += Math.min(handlerCount * 0.1, 20);
                }
            } catch (error) {
                // Handlers directory might not exist
            }

            // Detect multi-project setup
            const potentialProjects = ['HoneyDo', 'Seawater', 'Waves', 'Tim-Combo'];
            let detectedProjects = 0;
            
            for (const project of potentialProjects) {
                try {
                    const projectPath = path.join(projectPath, '..', project);
                    await fs.access(projectPath);
                    detectedProjects++;
                } catch (error) {
                    // Project doesn't exist
                }
            }
            
            if (detectedProjects > 1) {
                metrics.multiProject = true;
                metrics.monthlyInfrastructureCost += Math.min(detectedProjects * 10, 30);
            }

        } catch (error) {
            // Use defaults if analysis fails
        }

        return metrics;
    }

    async countLambdaHandlers(handlersDir) {
        let count = 0;
        
        try {
            const entries = await fs.readdir(handlersDir, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(handlersDir, entry.name);
                
                if (entry.isDirectory()) {
                    count += await this.countLambdaHandlers(fullPath);
                } else if (entry.name.endsWith('.js')) {
                    count++;
                }
            }
        } catch (error) {
            // Directory might not exist
        }
        
        return count;
    }

    async performStaticAnalysis(projectPath) {
        const findings = [];
        
        try {
            // Check for hardcoded secrets
            const secretFindings = await this.scanForSecrets(projectPath);
            findings.push(...secretFindings);
            
            // Check for console.log statements in production
            const loggingFindings = await this.scanLoggingIssues(projectPath);
            findings.push(...loggingFindings);
            
            // Check CORS configuration
            const corsFindings = await this.scanCORSConfiguration(projectPath);
            findings.push(...corsFindings);
            
            // Check TLS/SSL configuration
            const tlsFindings = await this.scanTLSConfiguration(projectPath);
            findings.push(...tlsFindings);
            
        } catch (error) {
            findings.push({
                type: 'static_analysis_error',
                severity: 'medium',
                message: `Static analysis incomplete: ${error.message}`
            });
        }
        
        return findings;
    }

    async scanForSecrets(projectPath) {
        const findings = [];
        const patterns = this.vulnerabilityDatabase.criticalVulnerabilities
            .find(v => v.type === 'hardcoded_secrets').patterns;
        
        try {
            const files = await this.getJavaScriptFiles(projectPath);
            
            for (const file of files) {
                const content = await fs.readFile(file, 'utf8');
                const lines = content.split('\n');
                
                // Determine if this is test/development code
                const isTestFile = file.includes('/test') || 
                                 file.includes('/archived') || 
                                 file.includes('test_data') || 
                                 file.includes('/dev/') ||
                                 file.includes('_test.js');
                
                lines.forEach((line, index) => {
                    patterns.forEach(pattern => {
                        const regex = new RegExp(pattern, 'i');
                        if (regex.test(line)) {
                            findings.push({
                                type: 'hardcoded_secrets',
                                severity: isTestFile ? 'medium' : 'critical', // Lower severity for test files
                                message: isTestFile ? 
                                        'Hardcoded secret in test/development file' : 
                                        'Potential hardcoded secret detected',
                                location: `${file}:${index + 1}`,
                                code: line.trim(),
                                recommendation: isTestFile ?
                                              'Use test-specific environment variables' :
                                              'Use environment variables or AWS Secrets Manager',
                                context: isTestFile ? 'test_file' : 'production_code'
                            });
                        }
                    });
                });
            }
        } catch (error) {
            findings.push({
                type: 'secret_scan_error',
                severity: 'medium',
                message: `Secret scanning failed: ${error.message}`
            });
        }
        
        return findings;
    }

    async scanLoggingIssues(projectPath) {
        const findings = [];
        
        try {
            const criticalFiles = [
                'src/backend/src/helpers/responseUtil.js',
                'src/backend/src/helpers/dbClient.js',
                'src/backend/src/helpers/errorHandler.js',
                'src/backend/src/helpers/lambdaWrapper.js'
            ];
            
            for (const relativePath of criticalFiles) {
                const filePath = path.join(projectPath, relativePath);
                try {
                    const content = await fs.readFile(filePath, 'utf8');
                    const consoleLogMatches = content.match(/console\.log/g);
                    
                    if (consoleLogMatches && consoleLogMatches.length > 0) {
                        findings.push({
                            type: 'insecure_logging',
                            severity: 'high',
                            message: `Found ${consoleLogMatches.length} console.log statements in critical file`,
                            location: filePath,
                            recommendation: 'Replace with secure logging using secureLogger helper'
                        });
                    }
                } catch (error) {
                    // File doesn't exist, which might be expected
                }
            }
        } catch (error) {
            findings.push({
                type: 'logging_scan_error',
                severity: 'low',
                message: `Logging scan failed: ${error.message}`
            });
        }
        
        return findings;
    }

    async analyzeSecurityPatterns(projectPath) {
        const findings = [];
        
        try {
            // This is a placeholder for pattern analysis
            // In a full implementation, this would analyze code patterns
            // against the security patterns defined in initializeSecurityPatterns()
            
            // For now, just return empty findings to prevent errors
            // Security pattern analysis completed
            
        } catch (error) {
            findings.push({
                type: 'pattern_analysis_error',
                severity: 'low',
                message: `Pattern analysis failed: ${error.message}`
            });
        }
        
        return findings;
    }

    async assessProductionReadiness(projectPath) {
        const status = {
            requiredComponents: {},
            securityFrameworks: {},
            complianceLevel: 'unknown',
            productionGates: {},
            costThreshold: 'unknown'
        };
        
        try {
            // Check for required security components
            const components = [
                'src/backend/src/helpers/secureLogger.js',
                'src/backend/src/helpers/environmentValidator.js',
                'src/backend/src/helpers/corsConfig.js',
                'src/backend/src/helpers/sslValidator.js',
                'SECURITY_HARDENING_DOCUMENTATION.md',
                'scripts/security-rollback.sh'
            ];
            
            for (const component of components) {
                const filePath = path.join(projectPath, component);
                try {
                    await fs.access(filePath);
                    status.requiredComponents[component] = 'present';
                } catch {
                    status.requiredComponents[component] = 'missing';
                }
            }
            
            // Determine compliance level based on implemented controls
            const implementedControls = Object.values(status.requiredComponents)
                .filter(status => status === 'present').length;
            
            if (implementedControls >= 5) {
                status.complianceLevel = 'enhanced';
            } else if (implementedControls >= 3) {
                status.complianceLevel = 'basic';
            } else {
                status.complianceLevel = 'insufficient';
            }
            
            // Check production gates
            status.productionGates = {
                securityValidation: implementedControls >= 4 ? 'ready' : 'not_ready',
                monitoringSetup: 'requires_verification',
                incidentResponse: implementedControls >= 5 ? 'ready' : 'not_ready',
                backupProcedures: 'requires_verification'
            };
            
            // Compliance level determined based on implemented controls
            
        } catch (error) {
            status.error = `Production readiness assessment failed: ${error.message}`;
        }
        
        return status;
    }

    async analyzeCostImplications(findings, systemMetrics = {}) {
        const analysis = {
            securityCosts: {},
            remediationCosts: {},
            riskCosts: {},
            infrastructureCosts: {},
            recommendations: []
        };
        
        try {
            // Calculate costs based on findings severity
            const criticalFindings = findings.filter(f => f.severity === 'critical').length;
            const highFindings = findings.filter(f => f.severity === 'high').length;
            const mediumFindings = findings.filter(f => f.severity === 'medium').length;
            
            // Realistic serverless cost analysis
            const currentInfrastructureCost = systemMetrics.monthlyInfrastructureCost || 50;
            const architecture = systemMetrics.architecture || 'serverless_arm64';
            
            // Foundation level (built-in security costs)
            const foundationSecurityCost = 0; // Security is built into serverless architecture
            
            // Enhanced level (minimal additional costs)
            const enhancedSecurityCost = architecture === 'serverless_arm64' ? 10 : 15;
            
            // Advanced level (proportional to actual usage)
            const advancedSecurityCost = Math.max(currentInfrastructureCost * 0.3, 25);
            
            // Enterprise level (only at real scale)
            const enterpriseSecurityCost = Math.max(currentInfrastructureCost * 0.8, 100);
            
            analysis.infrastructureCosts = {
                current: currentInfrastructureCost,
                foundation: currentInfrastructureCost + foundationSecurityCost,
                enhanced: currentInfrastructureCost + enhancedSecurityCost,
                advanced: currentInfrastructureCost + advancedSecurityCost,
                enterprise: currentInfrastructureCost + enterpriseSecurityCost
            };
            
            // Realistic remediation costs (not enterprise assumptions)
            analysis.remediationCosts = {
                immediate: criticalFindings * 500 + highFindings * 100, // Much more realistic
                shortTerm: mediumFindings * 50,
                ongoing: Math.max(currentInfrastructureCost * 0.1, 5) // 10% of infrastructure cost
            };
            
            // Risk-based cost analysis proportional to system value
            const systemValue = systemMetrics.monthlyRevenue || (currentInfrastructureCost * 10);
            analysis.riskCosts = {
                dataBreachRisk: criticalFindings > 0 ? systemValue * 2 : systemValue * 0.1,
                complianceRisk: highFindings > 0 ? systemValue * 0.5 : systemValue * 0.05,
                reputationRisk: (criticalFindings + highFindings) * systemValue * 0.1
            };
            
            // Generate realistic recommendations based on actual costs
            const totalRisk = analysis.riskCosts.dataBreachRisk + 
                            analysis.riskCosts.complianceRisk + 
                            analysis.riskCosts.reputationRisk;
            
            const currentSecurityCost = analysis.infrastructureCosts.foundation;
            const riskToSecurityRatio = totalRisk / currentSecurityCost;
            
            if (riskToSecurityRatio > 10 && criticalFindings > 0) {
                analysis.recommendations.push('Address critical findings immediately');
                analysis.recommendations.push('Consider enhanced security level if cost-justified');
            } else if (riskToSecurityRatio > 5 && totalRisk > 1000) {
                analysis.recommendations.push('Enhanced security controls may be justified');
                analysis.recommendations.push('Monitor growth metrics for security triggers');
            } else {
                analysis.recommendations.push('Current security posture appears cost-appropriate');
                analysis.recommendations.push('Continue with foundation-level security');
            }
            
            // Add serverless-specific recommendations
            if (architecture === 'serverless_arm64') {
                analysis.recommendations.push('ARM64 architecture provides cost-effective security baseline');
                analysis.recommendations.push('Leverage built-in AWS security features before adding premium services');
            }
            
        } catch (error) {
            analysis.error = `Cost analysis failed: ${error.message}`;
        }
        
        return analysis;
    }

    async generateRecommendations(review) {
        const recommendations = [];
        
        try {
            const systemMetrics = review.systemMetrics || {};
            const currentCost = systemMetrics.monthlyInfrastructureCost || 50;
            const architecture = systemMetrics.architecture || 'serverless_arm64';
            
            // Based on compliance level
            if (review.complianceStatus.complianceLevel === 'insufficient') {
                recommendations.push({
                    priority: 'critical',
                    category: 'basic_security',
                    title: 'Implement Basic Security Framework',
                    description: 'Deploy secure logging, environment validation, and CORS configuration',
                    estimatedCost: Math.min(currentCost * 0.5, 500), // Proportional to system size
                    timeframe: '1-2 weeks'
                });
            }
            
            // Based on findings (realistic costs)
            const criticalFindings = review.findings.filter(f => f.severity === 'critical');
            if (criticalFindings.length > 0) {
                recommendations.push({
                    priority: 'critical',
                    category: 'vulnerability_remediation',
                    title: 'Address Critical Security Vulnerabilities',
                    description: `Resolve ${criticalFindings.length} critical security issues`,
                    estimatedCost: criticalFindings.length * 200, // Realistic for serverless fixes
                    timeframe: 'immediate'
                });
            }
            
            // Progressive security level recommendations
            const infrastructureCosts = review.costAnalysis.infrastructureCosts || {};
            const currentSecurityCost = infrastructureCosts.current || currentCost;
            const enhancedCost = infrastructureCosts.enhanced || (currentCost + 10);
            
            // Only recommend enhancement if justified by system growth
            if (systemMetrics.userCount === 'pilot_testing' && 
                systemMetrics.environmentType === 'sandbox') {
                recommendations.push({
                    priority: 'medium',
                    category: 'progressive_security',
                    title: 'Monitor for Enhanced Security Triggers',
                    description: 'Watch for 10+ companies or 100+ users to trigger enhanced security level',
                    estimatedCost: enhancedCost - currentSecurityCost,
                    timeframe: 'when_triggered'
                });
            }
            
            // ARM64-specific recommendations
            if (architecture === 'serverless_arm64') {
                recommendations.push({
                    priority: 'low',
                    category: 'optimization',
                    title: 'Leverage ARM64 Security Benefits',
                    description: 'Continue using ARM64 for 20% cost savings on security compute',
                    estimatedCost: 0, // Already implemented
                    timeframe: 'ongoing'
                });
            }
            
            // Realistic validation recommendation
            recommendations.push({
                priority: 'medium',
                category: 'continuous_security',
                title: 'Automated Security Validation',
                description: 'Run security validation script regularly in CI/CD pipeline',
                estimatedCost: 10, // Realistic CI/CD integration cost
                timeframe: '1 day'
            });
            
            // Cost-aware enterprise recommendation
            if (review.costAnalysis.riskCosts?.dataBreachRisk > currentCost * 20) {
                recommendations.push({
                    priority: 'high',
                    category: 'risk_mitigation',
                    title: 'Consider Enhanced Security Level',
                    description: 'Risk exposure justifies enhanced security controls',
                    estimatedCost: enhancedCost - currentSecurityCost,
                    timeframe: '1 month'
                });
            } else {
                recommendations.push({
                    priority: 'low',
                    category: 'security_posture',
                    title: 'Current Security Level Appropriate',
                    description: `Foundation level security suits current ${systemMetrics.userCount} usage`,
                    estimatedCost: 0,
                    timeframe: 'ongoing'
                });
            }
            
        } catch (error) {
            recommendations.push({
                priority: 'high',
                category: 'error_handling',
                title: 'Security Analysis Error',
                description: `Address security analysis issues: ${error.message}`,
                estimatedCost: 100, // Realistic debugging cost
                timeframe: '1 week'
            });
        }
        
        return recommendations;
    }

    async getJavaScriptFiles(directory) {
        const files = [];
        
        try {
            const entries = await fs.readdir(directory, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(directory, entry.name);
                
                if (entry.isDirectory() && !entry.name.startsWith('.') && 
                    entry.name !== 'node_modules') {
                    files.push(...await this.getJavaScriptFiles(fullPath));
                } else if (entry.name.endsWith('.js') || entry.name.endsWith('.ts')) {
                    files.push(fullPath);
                }
            }
        } catch (error) {
            // Directory might not exist or be accessible
        }
        
        return files;
    }

    // Additional helper methods for specific security checks
    async scanCORSConfiguration(projectPath) {
        const findings = [];
        
        try {
            const corsConfigPath = path.join(projectPath, 'src/backend/src/helpers/corsConfig.js');
            const content = await fs.readFile(corsConfigPath, 'utf8');
            
            if (content.includes("'*'") && content.includes('CORS_ORIGINS')) {
                findings.push({
                    type: 'cors_wildcard',
                    severity: 'medium',
                    message: 'Wildcard CORS origins detected in configuration',
                    location: corsConfigPath,
                    recommendation: 'Use specific domain origins for production'
                });
            }
        } catch (error) {
            findings.push({
                type: 'cors_config_missing',
                severity: 'high',
                message: 'CORS configuration file not found',
                recommendation: 'Implement CORS configuration helper'
            });
        }
        
        return findings;
    }

    async scanTLSConfiguration(projectPath) {
        const findings = [];
        
        try {
            const sslValidatorPath = path.join(projectPath, 'src/backend/src/helpers/sslValidator.js');
            const content = await fs.readFile(sslValidatorPath, 'utf8');
            
            if (!content.includes('TLSv1.2')) {
                findings.push({
                    type: 'weak_tls',
                    severity: 'high',
                    message: 'Minimum TLS version not enforced',
                    location: sslValidatorPath,
                    recommendation: 'Enforce TLS 1.2 or higher'
                });
            }
        } catch (error) {
            findings.push({
                type: 'ssl_validator_missing',
                severity: 'high',
                message: 'SSL/TLS validator not found',
                recommendation: 'Implement SSL/TLS validation framework'
            });
        }
        
        return findings;
    }

    async assessSecurityRisks(findings) {
        const riskAssessment = {
            overallRisk: 'low',
            riskFactors: [],
            mitigationStrategies: [],
            businessImpact: {}
        };
        
        try {
            const criticalCount = findings.filter(f => f.severity === 'critical').length;
            const highCount = findings.filter(f => f.severity === 'high').length;
            
            if (criticalCount > 0) {
                riskAssessment.overallRisk = 'critical';
                riskAssessment.riskFactors.push('Critical vulnerabilities present');
            } else if (highCount > 2) {
                riskAssessment.overallRisk = 'high';
                riskAssessment.riskFactors.push('Multiple high-severity issues');
            } else if (highCount > 0) {
                riskAssessment.overallRisk = 'medium';
                riskAssessment.riskFactors.push('High-severity issues present');
            }
            
            // Business impact assessment
            riskAssessment.businessImpact = {
                dataBreachProbability: criticalCount > 0 ? 'high' : 'low',
                complianceRisk: highCount > 0 ? 'medium' : 'low',
                operationalImpact: (criticalCount + highCount) > 5 ? 'high' : 'low',
                reputationalRisk: criticalCount > 0 ? 'high' : 'low'
            };
            
        } catch (error) {
            riskAssessment.error = `Risk assessment failed: ${error.message}`;
        }
        
        return riskAssessment;
    }
}

module.exports = SecurityReviewerAgent;