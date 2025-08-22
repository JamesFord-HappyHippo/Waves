/**
 * Security Triage Agent - Intelligent filtering of security findings against established strategy
 * 
 * Compares security findings from SecurityReviewerAgent against our documented security strategy
 * to identify genuine security concerns vs. acceptable risks within our control framework
 */

const fs = require('fs').promises;
const path = require('path');
const { createSuccessResponse, createErrorResponse } = require('../helpers/responseUtil');

class SecurityTriageAgent {
    constructor() {
        this.securityStrategyPath = '.clinerules/tech_stack_security.md';
        this.progressiveSecurityPath = '.clinerules/progressive_security_philosophy.md';
        this.securityStrategy = null;
        this.progressiveStrategy = null;
        this.acceptableRiskPatterns = [];
        this.criticalSecurityRequirements = [];
        this.contextualExceptions = [];
        this.currentSecurityLevel = 'enhanced'; // Default to enhanced level
        
        this.initializeSecurityStrategy();
    }

    async initializeSecurityStrategy() {
        try {
            console.log('🔍 Loading security strategy documents...');
            
            // Load basic tech stack security strategy
            const strategyContent = await fs.readFile(this.securityStrategyPath, 'utf8');
            this.securityStrategy = this.parseSecurityStrategy(strategyContent);
            
            // Load progressive security philosophy
            const progressiveContent = await fs.readFile(this.progressiveSecurityPath, 'utf8');
            this.progressiveStrategy = this.parseProgressiveStrategy(progressiveContent);
            
            // Define acceptable risk patterns based on our strategy
            this.acceptableRiskPatterns = [
                {
                    pattern: 'hardcoded_secrets',
                    context: 'test_credentials',
                    reason: 'Test credentials in config.json are documented as environment variable references',
                    severity_override: 'low'
                },
                {
                    pattern: 'unencrypted_passwords', 
                    context: 'database_config',
                    reason: 'Database connections use AWS Control Tower managed security with RDS encryption',
                    severity_override: 'medium'
                },
                {
                    pattern: 'cors_configuration',
                    context: 'api_gateway',
                    reason: 'CORS is managed at API Gateway level with documented security headers',
                    severity_override: 'low'
                },
                {
                    pattern: 'sql_injection_risk',
                    context: 'parameterized_queries',
                    reason: 'Using parameterized queries and executeQuery helper as per standards',
                    severity_override: 'low'
                }
            ];

            // Define critical requirements that must always be flagged
            this.criticalSecurityRequirements = [
                'authentication_bypass',
                'authorization_bypass', 
                'direct_database_access',
                'plaintext_secrets_production',
                'public_s3_bucket',
                'unencrypted_transmission',
                'privilege_escalation',
                'injection_vulnerability_production'
            ];

            // Update acceptable risk patterns based on progressive security level
            this.updateRiskPatternsForSecurityLevel();
            
            console.log('✅ Security strategy and progressive philosophy loaded');
            console.log(`🎯 Current security level: ${this.currentSecurityLevel}`);
        } catch (error) {
            console.error('❌ Failed to load security strategy:', error.message);
        }
    }

    parseSecurityStrategy(content) {
        const strategy = {
            authenticationFlow: content.includes('JWT token validation'),
            rbacModel: content.includes('Role-Based Access Control'),
            awsControlTower: content.includes('AWS Control Tower'),
            encryptedConnections: content.includes('Encrypted connections'),
            parameterizedQueries: content.includes('Parameterized queries'),
            inputValidation: content.includes('Validate all user inputs'),
            securityHeaders: content.includes('HTTP security headers'),
            auditLogging: content.includes('Audit Logging')
        };

        console.log('📋 Security strategy analysis:', {
            authenticationFlow: strategy.authenticationFlow ? '✅' : '❌',
            rbacModel: strategy.rbacModel ? '✅' : '❌',
            awsControlTower: strategy.awsControlTower ? '✅' : '❌',
            parameterizedQueries: strategy.parameterizedQueries ? '✅' : '❌'
        });

        return strategy;
    }

    parseProgressiveStrategy(content) {
        const strategy = {
            foundationLevel: content.includes('Foundation Level'),
            enhancedLevel: content.includes('Enhanced Level'),
            advancedLevel: content.includes('Advanced Level'),
            enterpriseLevel: content.includes('Enterprise Level'),
            securityLevelTriggers: {
                enhanced: content.includes('10+ client companies'),
                advanced: content.includes('100+ client companies'),
                enterprise: content.includes('1,000+ client companies')
            },
            timComboPatterns: content.includes('Tim-Combo Implementation Patterns'),
            progressiveThresholds: content.includes('Progressive Security Philosophy')
        };

        console.log('📋 Progressive security analysis:', {
            foundationLevel: strategy.foundationLevel ? '✅' : '❌',
            enhancedLevel: strategy.enhancedLevel ? '✅' : '❌',
            advancedLevel: strategy.advancedLevel ? '✅' : '❌',
            enterpriseLevel: strategy.enterpriseLevel ? '✅' : '❌',
            timComboPatterns: strategy.timComboPatterns ? '✅' : '❌'
        });

        return strategy;
    }

    updateRiskPatternsForSecurityLevel() {
        console.log(`🔧 Updating risk patterns for ${this.currentSecurityLevel} security level`);

        // Base patterns for all levels
        const basePatterns = [...this.acceptableRiskPatterns];

        switch (this.currentSecurityLevel) {
            case 'foundation':
                // Foundation level - more lenient on dev/test patterns
                this.acceptableRiskPatterns.push({
                    pattern: 'logging_sensitive_data',
                    context: 'development',
                    reason: 'Foundation level allows basic logging for development',
                    severity_override: 'low'
                });
                break;

            case 'enhanced':
                // Enhanced level - current Tim-Combo status
                this.acceptableRiskPatterns.push({
                    pattern: 'basic_authentication',
                    context: 'internal_tools',
                    reason: 'Enhanced level with MFA requirement for admin roles',
                    severity_override: 'medium'
                });
                break;

            case 'advanced':
                // Advanced level - current sandbox status, more strict
                this.criticalSecurityRequirements.push('unencrypted_transmission_production');
                this.acceptableRiskPatterns = this.acceptableRiskPatterns.filter(
                    pattern => pattern.context !== 'test_credentials' || pattern.severity_override !== 'low'
                );
                break;

            case 'enterprise':
                // Enterprise level - maximum security
                this.criticalSecurityRequirements.push(
                    'any_hardcoded_secrets',
                    'unvalidated_inputs',
                    'missing_audit_logs'
                );
                // Remove most acceptable risk patterns for enterprise
                this.acceptableRiskPatterns = basePatterns.filter(
                    pattern => pattern.reason.includes('AWS Control Tower')
                );
                break;
        }

        console.log(`📊 Updated patterns: ${this.acceptableRiskPatterns.length} acceptable risks, ${this.criticalSecurityRequirements.length} critical requirements`);
    }

    determineSecurityLevel(projectContext = {}) {
        // Determine security level based on progressive security philosophy
        const environment = projectContext.environment || 'dev';
        
        // For Tim-Combo, use documented current status
        if (environment === 'production') {
            return 'enterprise'; // Production requires enterprise level
        } else if (environment === 'sandbox') {
            return 'advanced'; // Current sandbox status per progressive_security_philosophy.md
        } else {
            return 'enhanced'; // Current dev environment status
        }
    }

    extractSecurityFindings(stepContext) {
        // Look for security findings from SecurityReviewerAgent in previous results
        const previousResults = stepContext.previousResults || [];
        
        console.log('🔍 Debugging previous results:', {
            type: Array.isArray(previousResults) ? 'array' : typeof previousResults,
            length: Array.isArray(previousResults) ? previousResults.length : 'N/A',
            keys: Array.isArray(previousResults) ? 'array-no-keys' : Object.keys(previousResults)
        });
        
        // Handle array format (workflow execution results)
        if (Array.isArray(previousResults)) {
            for (const stepResult of previousResults) {
                if (stepResult.stepName === 'security-assessment' && stepResult.result) {
                    return this.extractFindingsFromResult(stepResult.result);
                }
            }
        }
        
        // Handle object format (keyed by step name)
        if (typeof previousResults === 'object' && previousResults !== null) {
            for (const [stepName, stepResult] of Object.entries(previousResults)) {
                if (stepName === 'security-assessment' && stepResult.result) {
                    return this.extractFindingsFromResult(stepResult.result);
                }
            }
        }
        
        console.log('⚠️ No security findings found in previous results, returning empty array');
        return [];
    }

    extractFindingsFromResult(result) {
        console.log('🔍 Extracting findings from result:', typeof result);
        
        // Handle different result formats
        if (Array.isArray(result)) {
            return result;
        }
        
        if (result && typeof result === 'object') {
            if (result.findings && Array.isArray(result.findings)) {
                return result.findings;
            }
            
            if (result.securityFindings && Array.isArray(result.securityFindings)) {
                return result.securityFindings;
            }
            
            // If result has individual finding arrays, combine them
            if (result.secretFindings || result.loggingFindings || result.patternFindings) {
                const allFindings = [
                    ...(result.secretFindings || []),
                    ...(result.loggingFindings || []),
                    ...(result.patternFindings || []),
                    ...(result.corsFindings || []),
                    ...(result.tlsFindings || [])
                ];
                console.log(`🔍 Combined findings from multiple arrays: ${allFindings.length} total`);
                return allFindings;
            }
            
            // Check if result contains data.Records (agent response format)
            if (result.data && result.data.Records && Array.isArray(result.data.Records)) {
                console.log(`🔍 Found Records array: ${result.data.Records.length} items`);
                return result.data.Records;
            }
        }
        
        console.log('⚠️ Could not extract findings from result format');
        return [];
    }

    async performSecurityTriage(stepContext = {}, options = {}) {
        console.log('🔬 Starting security triage analysis...');
        
        // Determine appropriate security level for this context
        const projectContext = { environment: stepContext.environment };
        const securityLevel = this.determineSecurityLevel(projectContext);
        
        if (securityLevel !== this.currentSecurityLevel) {
            console.log(`🔄 Updating security level from ${this.currentSecurityLevel} to ${securityLevel}`);
            this.currentSecurityLevel = securityLevel;
            this.updateRiskPatternsForSecurityLevel();
        }
        
        // Extract security findings from previous workflow step
        const securityFindings = this.extractSecurityFindings(stepContext);
        console.log(`📊 Input: ${securityFindings.length} security findings to analyze`);

        const triageResults = {
            genuineConcerns: [],
            acceptableRisks: [],
            falsePositives: [],
            requiresInvestigation: [],
            summary: {
                originalCount: securityFindings.length,
                genuineConcerns: 0,
                acceptableRisks: 0,
                falsePositives: 0,
                requiresInvestigation: 0
            }
        };

        for (const finding of securityFindings) {
            const triageDecision = await this.triageFinding(finding, projectContext);
            
            switch (triageDecision.category) {
                case 'genuine_concern':
                    triageResults.genuineConcerns.push({
                        ...finding,
                        triageReason: triageDecision.reason,
                        priorityLevel: triageDecision.priority
                    });
                    break;
                case 'acceptable_risk':
                    triageResults.acceptableRisks.push({
                        ...finding,
                        triageReason: triageDecision.reason,
                        mitigationStrategy: triageDecision.mitigation
                    });
                    break;
                case 'false_positive':
                    triageResults.falsePositives.push({
                        ...finding,
                        triageReason: triageDecision.reason
                    });
                    break;
                case 'requires_investigation':
                    triageResults.requiresInvestigation.push({
                        ...finding,
                        triageReason: triageDecision.reason,
                        investigationSteps: triageDecision.steps
                    });
                    break;
            }
        }

        // Update summary counts
        triageResults.summary.genuineConcerns = triageResults.genuineConcerns.length;
        triageResults.summary.acceptableRisks = triageResults.acceptableRisks.length;
        triageResults.summary.falsePositives = triageResults.falsePositives.length;
        triageResults.summary.requiresInvestigation = triageResults.requiresInvestigation.length;

        console.log('📈 Triage Summary:');
        console.log(`   🚨 Genuine Concerns: ${triageResults.summary.genuineConcerns}`);
        console.log(`   ✅ Acceptable Risks: ${triageResults.summary.acceptableRisks}`);
        console.log(`   🔍 Requires Investigation: ${triageResults.summary.requiresInvestigation}`);
        console.log(`   ❌ False Positives: ${triageResults.summary.falsePositives}`);

        // Generate comprehensive triage report
        const environmentContext = stepContext.environment || 'unknown';
        const triageReport = this.generateTriageReport(triageResults, 'Tim-Combo');
        
        return createSuccessResponse(triageReport, 'Security triage completed', {
            Agent_ID: 'SecurityTriageAgent',
            Operation: 'security-triage',
            Workflow_ID: stepContext.workflowId,
            Summary: triageResults.summary
        });
    }

    async triageFinding(finding, projectContext) {
        const pattern = finding.pattern || finding.type;
        const file = finding.file || '';
        const severity = finding.severity || 'medium';

        // Check if this is a critical requirement that must always be flagged
        if (this.criticalSecurityRequirements.some(req => pattern.includes(req))) {
            return {
                category: 'genuine_concern',
                reason: 'Critical security requirement violation',
                priority: 'immediate'
            };
        }

        // Check against acceptable risk patterns
        const acceptableRisk = this.acceptableRiskPatterns.find(risk => 
            pattern.includes(risk.pattern) && this.matchesContext(file, risk.context)
        );

        if (acceptableRisk) {
            return {
                category: 'acceptable_risk',
                reason: acceptableRisk.reason,
                mitigation: this.getMitigationStrategy(pattern)
            };
        }

        // Context-specific analysis
        if (this.isTestEnvironmentFinding(file, pattern)) {
            return {
                category: 'acceptable_risk',
                reason: 'Test environment finding within acceptable risk tolerance',
                mitigation: 'Ensure production environment uses secure alternatives'
            };
        }

        if (this.isConfigurationFinding(file, pattern)) {
            return {
                category: 'requires_investigation',
                reason: 'Configuration-related finding requires validation against deployment strategy',
                steps: ['Verify production configuration', 'Check environment variable usage', 'Validate against AWS Control Tower policies']
            };
        }

        if (this.isDevelopmentOnlyFinding(file, pattern)) {
            return {
                category: 'false_positive',
                reason: 'Development-only code not deployed to production'
            };
        }

        // Default to requiring investigation for unknown patterns
        return {
            category: 'requires_investigation',
            reason: `Unknown security pattern '${pattern}' requires manual review`,
            steps: ['Review against security strategy', 'Validate with security team', 'Document decision']
        };
    }

    matchesContext(file, context) {
        const contextMappings = {
            'test_credentials': file.includes('config.json') || file.includes('test'),
            'database_config': file.includes('db') || file.includes('database') || file.includes('simple-db-setup'),
            'api_gateway': file.includes('api') || file.includes('handler'),
            'parameterized_queries': file.includes('db') || file.includes('executeQuery')
        };

        return contextMappings[context] || false;
    }

    isTestEnvironmentFinding(file, pattern) {
        const testIndicators = ['test', 'spec', 'mock', 'fixture', '.test.', '.spec.', '/tests/', 'test-data'];
        return testIndicators.some(indicator => file.toLowerCase().includes(indicator));
    }

    isConfigurationFinding(file, pattern) {
        const configIndicators = ['config', 'env', 'settings', '.env', 'config.json'];
        return configIndicators.some(indicator => file.toLowerCase().includes(indicator));
    }

    isDevelopmentOnlyFinding(file, pattern) {
        const devIndicators = ['dev', 'development', 'local', 'localhost', 'demo'];
        return devIndicators.some(indicator => file.toLowerCase().includes(indicator));
    }

    getMitigationStrategy(pattern) {
        const mitigationStrategies = {
            'hardcoded_secrets': 'Use environment variables and AWS Secrets Manager',
            'unencrypted_passwords': 'Leverage AWS Control Tower managed encryption',
            'sql_injection_risk': 'Continue using parameterized queries and executeQuery helper',
            'cors_configuration': 'API Gateway manages CORS with documented security headers',
            'tls_configuration': 'AWS services provide TLS termination at infrastructure level'
        };

        return mitigationStrategies[pattern] || 'Review against established security strategy';
    }

    generateTriageReport(triageResults, projectName = 'Tim-Combo') {
        const report = {
            projectName,
            triageDate: new Date().toISOString(),
            summary: triageResults.summary,
            riskAssessment: this.calculateRiskLevel(triageResults),
            actionItems: this.generateActionItems(triageResults),
            pilotReadiness: this.assessPilotReadiness(triageResults),
            recommendations: this.generateRecommendations(triageResults)
        };

        console.log('📄 Triage Report Generated:');
        console.log(`   🎯 Risk Level: ${report.riskAssessment.level}`);
        console.log(`   ✈️ Pilot Ready: ${report.pilotReadiness.ready ? 'YES' : 'NO'}`);
        console.log(`   📝 Action Items: ${report.actionItems.length}`);

        return report;
    }

    calculateRiskLevel(triageResults) {
        const genuine = triageResults.summary.genuineConcerns;
        const investigation = triageResults.summary.requiresInvestigation;
        
        if (genuine >= 10) return { level: 'HIGH', reason: 'Multiple genuine security concerns' };
        if (genuine >= 5) return { level: 'MEDIUM', reason: 'Several security issues require attention' };
        if (investigation >= 20) return { level: 'MEDIUM', reason: 'Many findings require investigation' };
        if (genuine > 0) return { level: 'LOW', reason: 'Few genuine concerns identified' };
        
        return { level: 'ACCEPTABLE', reason: 'No significant security concerns after triage' };
    }

    assessPilotReadiness(triageResults) {
        const genuine = triageResults.summary.genuineConcerns;
        const critical = triageResults.genuineConcerns.filter(c => c.priorityLevel === 'immediate').length;
        
        if (critical > 0) {
            return { 
                ready: false, 
                reason: 'Critical security issues must be resolved before pilot',
                blockers: critical
            };
        }
        
        if (genuine > 5) {
            return { 
                ready: false, 
                reason: 'Too many genuine security concerns for pilot deployment',
                issueCount: genuine
            };
        }
        
        return { 
            ready: true, 
            reason: 'Security risk within acceptable parameters for pilot',
            conditions: 'Continue monitoring with agent system'
        };
    }

    generateActionItems(triageResults) {
        const actions = [];
        
        triageResults.genuineConcerns.forEach(concern => {
            actions.push({
                priority: concern.priorityLevel || 'high',
                type: 'security_fix',
                description: `Address ${concern.pattern} in ${concern.file}`,
                reason: concern.triageReason
            });
        });

        if (triageResults.summary.requiresInvestigation > 0) {
            actions.push({
                priority: 'medium',
                type: 'investigation',
                description: `Investigate ${triageResults.summary.requiresInvestigation} security findings`,
                reason: 'Manual review required for unknown patterns'
            });
        }

        return actions;
    }

    generateRecommendations(triageResults) {
        const recommendations = [
            'Continue using agent-based security monitoring for real-time assessment',
            'Implement automated security gates in deployment pipeline',
            'Regular review of acceptable risk patterns as project evolves'
        ];

        if (triageResults.summary.genuineConcerns > 0) {
            recommendations.unshift('Address genuine security concerns before production deployment');
        }

        if (triageResults.summary.requiresInvestigation > 10) {
            recommendations.push('Consider expanding security strategy documentation for edge cases');
        }

        return recommendations;
    }
}

module.exports = SecurityTriageAgent;