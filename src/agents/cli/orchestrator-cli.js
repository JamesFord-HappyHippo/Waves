#!/usr/bin/env node
// orchestrator-cli.js - Command-line interface for AgentOrchestrator
// Usage: node orchestrator-cli.js [workflow] [options]

const { program } = require('commander');
const AgentOrchestrator = require('../core/AgentOrchestrator');
const path = require('path');
const fs = require('fs').promises;

// Create orchestrator instance
const orchestrator = new AgentOrchestrator({
    projectRoot: path.resolve(__dirname, '../../..'),
    agentDirectory: 'src/agents/specialists',
    maxConcurrentAgents: 5
});

// Set up event logging
orchestrator.on('orchestrator:initialized', (data) => {
    console.log(`✅ Orchestrator initialized - ${data.agentsLoaded} agents, ${data.workflowsLoaded} workflows`);
});

orchestrator.on('workflow:started', (data) => {
    console.log(`🚀 Starting workflow: ${data.workflowName} (${data.workflowId})`);
    console.log(`   Steps: ${data.steps}`);
});

orchestrator.on('step:started', (data) => {
    console.log(`   ⏳ ${data.stepName} (${data.agent})`);
});

orchestrator.on('step:completed', (data) => {
    console.log(`   ✅ ${data.stepName} completed in ${data.duration}ms`);
});

orchestrator.on('step:failed', (data) => {
    console.log(`   ❌ ${data.stepName} failed: ${data.error}`);
});

orchestrator.on('workflow:completed', (data) => {
    console.log(`🎉 Workflow completed: ${data.workflowName}`);
    console.log(`   Duration: ${data.duration}ms, Results: ${data.results}`);
});

orchestrator.on('workflow:failed', (data) => {
    console.log(`💥 Workflow failed: ${data.workflowName}`);
    console.log(`   Error: ${data.error}`);
});

// Main program setup
program
    .name('tim-agents')
    .description('Tim-Combo Multi-Agent Orchestration CLI')
    .version('1.0.0');

// Deploy feature workflow
program
    .command('deploy-feature')
    .description('Deploy a feature with full validation pipeline')
    .option('-e, --environment <env>', 'target environment (dev|sandbox|production)', 'dev')
    .option('-b, --branch <branch>', 'feature branch name')
    .option('-c, --company-id <id>', 'test company ID for validation')
    .option('-t, --target <target>', 'deployment target (lambda|frontend|full)', 'full')
    .option('--skip-tests', 'skip test execution')
    .option('--skip-cost-analysis', 'skip cost analysis (not recommended)')
    .option('--dry-run', 'show what would be deployed without executing')
    .action(async (options) => {
        try {
            console.log('🔧 Deploy Feature Workflow');
            console.log(`Environment: ${options.environment}`);
            console.log(`Branch: ${options.branch || 'current'}`);
            console.log(`Target: ${options.target}`);
            
            if (options.dryRun) {
                console.log('🔍 Dry run mode - showing planned execution');
                await showWorkflowPlan('deploy-feature', options);
                return;
            }
            
            const result = await orchestrator.executeWorkflow('deploy-feature', {
                context: {
                    environment: options.environment,
                    branch: options.branch,
                    companyId: options.companyId,
                    deploymentTarget: options.target,
                    skipTests: options.skipTests,
                    skipCostAnalysis: options.skipCostAnalysis
                }
            });
            
            if (result.success) {
                console.log(`✅ Deployment completed successfully (${result.duration}ms)`);
                console.log(`Workflow ID: ${result.workflowId}`);
            } else {
                console.error(`❌ Deployment failed: ${result.error}`);
                process.exit(1);
            }
            
        } catch (error) {
            console.error('CLI Error:', error.message);
            process.exit(1);
        }
    });

// Security review workflow  
program
    .command('security-review')
    .description('Perform comprehensive security assessment')
    .option('-s, --scope <scope>', 'review scope (full|changes|specific)', 'changes')
    .option('-f, --files <files>', 'specific files to review (comma-separated)')
    .option('--include-cost-analysis', 'include infrastructure cost analysis')
    .option('--severity <level>', 'minimum severity level (low|medium|high|critical)', 'medium')
    .option('--output <format>', 'output format (console|json|markdown)', 'console')
    .action(async (options) => {
        try {
            console.log('🛡️ Security Review Workflow');
            console.log(`Scope: ${options.scope}`);
            console.log(`Minimum Severity: ${options.severity}`);
            
            const result = await orchestrator.executeWorkflow('security-review', {
                context: {
                    reviewScope: options.scope,
                    targetFiles: options.files ? options.files.split(',') : null,
                    includeCostAnalysis: options.includeCostAnalysis,
                    minimumSeverity: options.severity,
                    outputFormat: options.output
                }
            });
            
            if (result.success) {
                console.log(`✅ Security review completed (${result.duration}ms)`);
                
                if (options.output === 'json') {
                    console.log(JSON.stringify(result.results, null, 2));
                } else {
                    await displaySecurityResults(result.results);
                }
            } else {
                console.error(`❌ Security review failed: ${result.error}`);
                process.exit(1);
            }
            
        } catch (error) {
            console.error('CLI Error:', error.message);
            process.exit(1);
        }
    });

// Code quality check workflow
program
    .command('quality-check')
    .description('Run comprehensive code quality analysis')
    .option('-p, --path <path>', 'specific path to analyze', '.')
    .option('--include-patterns', 'extract new code patterns')
    .option('--include-synthesis', 'run knowledge synthesis')
    .option('--standards-check', 'validate against .clinerules standards')
    .action(async (options) => {
        try {
            console.log('📊 Code Quality Check Workflow');
            console.log(`Path: ${options.path}`);
            
            const result = await orchestrator.executeWorkflow('code-quality-check', {
                context: {
                    analysisPath: options.path,
                    includePatterns: options.includePatterns,
                    includeSynthesis: options.includeSynthesis,
                    standardsCheck: options.standardsCheck
                }
            });
            
            if (result.success) {
                console.log(`✅ Quality check completed (${result.duration}ms)`);
                await displayQualityResults(result.results);
            } else {
                console.error(`❌ Quality check failed: ${result.error}`);
                process.exit(1);
            }
            
        } catch (error) {
            console.error('CLI Error:', error.message);
            process.exit(1);
        }
    });

// Full stack deployment workflow
program
    .command('full-stack-deploy')
    .description('Complete full-stack deployment with all validations')
    .option('-e, --environment <env>', 'target environment (dev|sandbox|production)', 'dev')
    .option('--update-tests', 'update Playwright tests during deployment')
    .option('--validate-costs', 'validate cost thresholds before deployment')
    .option('--capture-knowledge', 'capture deployment knowledge and patterns')
    .action(async (options) => {
        try {
            console.log('🚢 Full-Stack Deployment Workflow');
            console.log(`Environment: ${options.environment}`);
            
            const result = await orchestrator.executeWorkflow('full-stack-deploy', {
                environment: options.environment,
                context: {
                    updateTests: options.updateTests,
                    validateCosts: options.validateCosts,
                    captureKnowledge: options.captureKnowledge
                }
            });
            
            if (result.success) {
                console.log(`✅ Full-stack deployment completed (${result.duration}ms)`);
                console.log(`Workflow ID: ${result.workflowId}`);
            } else {
                console.error(`❌ Full-stack deployment failed: ${result.error}`);
                process.exit(1);
            }
            
        } catch (error) {
            console.error('CLI Error:', error.message);
            process.exit(1);
        }
    });

// Workflow management commands
program
    .command('list-workflows')
    .description('List available workflows')
    .action(async () => {
        try {
            const workflows = orchestrator.listWorkflows();
            console.log('📋 Available Workflows:');
            workflows.forEach(workflow => {
                console.log(`  ${workflow.name} - ${workflow.description} (${workflow.steps} steps)`);
            });
        } catch (error) {
            console.error('CLI Error:', error.message);
            process.exit(1);
        }
    });

program
    .command('list-agents')
    .description('List available agents and their capabilities')
    .action(async () => {
        try {
            const agents = orchestrator.listAgents();
            console.log('🤖 Available Agents:');
            agents.forEach(agent => {
                console.log(`  ${agent.name} (${agent.status})`);
                console.log(`    Capabilities: ${agent.capabilities.join(', ')}`);
            });
        } catch (error) {
            console.error('CLI Error:', error.message);
            process.exit(1);
        }
    });

program
    .command('status')
    .description('Show active workflows and system status')
    .option('-w, --workflow-id <id>', 'specific workflow ID to check')
    .option('-h, --history <limit>', 'show workflow history (default: 10)', '10')
    .action(async (options) => {
        try {
            if (options.workflowId) {
                const workflow = orchestrator.getWorkflowStatus(options.workflowId);
                if (workflow) {
                    console.log('🔍 Workflow Status:');
                    console.log(`  ID: ${workflow.id}`);
                    console.log(`  Status: ${workflow.status}`);
                    console.log(`  Started: ${workflow.startTime}`);
                    if (workflow.endTime) {
                        console.log(`  Completed: ${workflow.endTime}`);
                        console.log(`  Duration: ${workflow.duration}ms`);
                    }
                    console.log(`  Steps: ${workflow.steps.size} completed`);
                } else {
                    console.log('❓ Workflow not found');
                }
            } else {
                const active = orchestrator.getActiveWorkflows();
                const history = orchestrator.getWorkflowHistory(parseInt(options.history));
                
                console.log('⚡ Active Workflows:');
                if (active.length === 0) {
                    console.log('  None');
                } else {
                    active.forEach(workflow => {
                        console.log(`  ${workflow.workflow} (${workflow.id}) - ${workflow.status}`);
                    });
                }
                
                console.log('\n📈 Recent History:');
                history.forEach(workflow => {
                    const status = workflow.status === 'completed' ? '✅' : '❌';
                    const duration = workflow.duration ? ` (${workflow.duration}ms)` : '';
                    console.log(`  ${status} ${workflow.workflow}${duration} - ${workflow.startTime.toLocaleString()}`);
                });
            }
        } catch (error) {
            console.error('CLI Error:', error.message);
            process.exit(1);
        }
    });

// Utility functions
async function showWorkflowPlan(workflowName, options) {
    const workflow = orchestrator.workflows.get(workflowName);
    if (!workflow) {
        console.error(`❌ Workflow '${workflowName}' not found`);
        return;
    }
    
    console.log(`📋 Workflow Plan: ${workflow.name}`);
    console.log(`Description: ${workflow.description}`);
    console.log('\nSteps:');
    
    workflow.steps.forEach((step, index) => {
        const dependencies = step.depends ? ` (after: ${step.depends.join(', ')})` : '';
        const required = step.required ? ' [REQUIRED]' : ' [OPTIONAL]';
        const parallel = step.parallel ? ' [PARALLEL]' : '';
        
        console.log(`  ${index + 1}. ${step.name}${required}${parallel}`);
        console.log(`     Agent: ${step.agent}.${step.method}()`);
        console.log(`     Description: ${step.description || 'No description'}`);
        if (step.depends && step.depends.length > 0) {
            console.log(`     Dependencies: ${step.depends.join(', ')}`);
        }
        console.log();
    });
}

async function displaySecurityResults(results) {
    console.log('\n🛡️ Security Analysis Results:');
    
    results.forEach(result => {
        if (result.stepName === 'security-assessment' && result.result) {
            const analysis = result.result;
            
            if (analysis.findings && analysis.findings.length > 0) {
                console.log('\n🔍 Security Findings:');
                const critical = analysis.findings.filter(f => f.severity === 'critical').length;
                const high = analysis.findings.filter(f => f.severity === 'high').length;
                const medium = analysis.findings.filter(f => f.severity === 'medium').length;
                const low = analysis.findings.filter(f => f.severity === 'low').length;
                
                console.log(`  Critical: ${critical}, High: ${high}, Medium: ${medium}, Low: ${low}`);
                
                if (critical > 0) {
                    console.log('\n❗ Critical Findings:');
                    analysis.findings
                        .filter(f => f.severity === 'critical')
                        .slice(0, 5)
                        .forEach(finding => {
                            console.log(`    • ${finding.type}: ${finding.description}`);
                            console.log(`      File: ${finding.file}:${finding.line || '?'}`);
                        });
                }
            }
            
            if (analysis.costAnalysis) {
                console.log('\n💰 Cost Analysis:');
                console.log(`  Fixed Costs: $${analysis.costAnalysis.fixedCosts}/month`);
                console.log(`  Variable Costs: $${analysis.costAnalysis.variableCosts}/month (estimated)`);
                console.log(`  Environment: ${analysis.costAnalysis.environment || 'unknown'}`);
            }
        }
    });
}

async function displayQualityResults(results) {
    console.log('\n📊 Quality Analysis Results:');
    
    results.forEach(result => {
        if (result.success && result.result) {
            console.log(`\n✅ ${result.stepName}:`);
            
            if (result.result.patterns) {
                console.log(`  Patterns found: ${result.result.patterns.length}`);
            }
            
            if (result.result.issues) {
                console.log(`  Issues found: ${result.result.issues.length}`);
                if (result.result.issues.length > 0) {
                    console.log('  Top issues:');
                    result.result.issues.slice(0, 3).forEach(issue => {
                        console.log(`    • ${issue.type}: ${issue.description}`);
                    });
                }
            }
            
            if (result.result.score) {
                console.log(`  Quality Score: ${result.result.score}/100`);
            }
        }
    });
}

// Handle CLI execution
if (require.main === module) {
    // Wait for orchestrator initialization before processing commands
    orchestrator.on('orchestrator:initialized', () => {
        program.parse();
    });
    
    orchestrator.on('orchestrator:error', (data) => {
        console.error('❌ Orchestrator initialization failed:', data.error);
        process.exit(1);
    });
    
    // Set timeout for initialization
    setTimeout(() => {
        console.error('❌ Orchestrator initialization timeout');
        process.exit(1);
    }, 30000);
}

module.exports = {
    orchestrator,
    program,
    showWorkflowPlan,
    displaySecurityResults,
    displayQualityResults
};