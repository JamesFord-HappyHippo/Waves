// AgentOrchestrator.js - Core multi-agent workflow coordination engine
// Coordinates specialist agents in sequential, parallel, and pipeline workflows

const fs = require('fs').promises;
const path = require('path');
const { EventEmitter } = require('events');

class AgentOrchestrator extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            projectRoot: config.projectRoot || process.cwd(),
            agentDirectory: config.agentDirectory || 'src/agents/specialists',
            workflowDirectory: config.workflowDirectory || 'src/agents/workflows',
            maxConcurrentAgents: config.maxConcurrentAgents || 5,
            defaultTimeout: config.defaultTimeout || 300000, // 5 minutes
            ...config
        };
        
        this.agents = new Map();
        this.workflows = new Map();
        this.activeWorkflows = new Map();
        this.workflowHistory = [];
        
        this.initializeOrchestrator();
    }

    async initializeOrchestrator() {
        try {
            // Load all available agents
            await this.loadAgents();
            
            // Load workflow definitions
            await this.loadWorkflows();
            
            this.emit('orchestrator:initialized', {
                agentsLoaded: this.agents.size,
                workflowsLoaded: this.workflows.size
            });
            
        } catch (error) {
            this.emit('orchestrator:error', {
                phase: 'initialization',
                error: error.message
            });
            throw error;
        }
    }

    async loadAgents() {
        const agentDir = path.join(this.config.projectRoot, this.config.agentDirectory);
        
        try {
            const agentFiles = await fs.readdir(agentDir);
            
            for (const file of agentFiles) {
                if (file.endsWith('.js') && !file.startsWith('.')) {
                    try {
                        const agentPath = path.join(agentDir, file);
                        const AgentClass = require(agentPath);
                        const agentName = file.replace('.js', '');
                        
                        // Instantiate the agent
                        const agentInstance = new AgentClass({
                            projectRoot: this.config.projectRoot
                        });
                        
                        this.agents.set(agentName, {
                            instance: agentInstance,
                            name: agentName,
                            path: agentPath,
                            capabilities: this.extractCapabilities(agentInstance),
                            status: 'loaded'
                        });
                        
                    } catch (error) {
                        console.warn(`Failed to load agent ${file}:`, error.message);
                    }
                }
            }
            
        } catch (error) {
            if (error.code !== 'ENOENT') {
                throw error;
            }
            console.warn('Agent directory not found, continuing with empty agent set');
        }
    }

    async loadWorkflows() {
        // Load default workflows
        this.workflows.set('deploy-feature', this.createDeployFeatureWorkflow());
        this.workflows.set('security-review', this.createSecurityReviewWorkflow());
        this.workflows.set('code-quality-check', this.createCodeQualityWorkflow());
        this.workflows.set('full-stack-deploy', this.createFullStackDeployWorkflow());
        
        // Try to load custom workflows from files
        try {
            const workflowDir = path.join(this.config.projectRoot, this.config.workflowDirectory);
            const workflowFiles = await fs.readdir(workflowDir);
            
            for (const file of workflowFiles) {
                if (file.endsWith('.yml') || file.endsWith('.yaml')) {
                    // TODO: Implement YAML workflow loading
                }
            }
        } catch (error) {
            // Workflow directory doesn't exist, use defaults only
        }
    }

    createDeployFeatureWorkflow() {
        return {
            name: 'deploy-feature',
            description: 'Full feature deployment with comprehensive validation',
            steps: [
                {
                    name: 'pattern-analysis',
                    agent: 'PatternHarvestingAgent',
                    method: 'extractPatterns',
                    required: true,
                    timeout: 30000,
                    description: 'Analyze new code patterns and changes'
                },
                {
                    name: 'audit-compliance',
                    agent: 'AuditorAgent',
                    method: 'runFullAudit',
                    required: true,
                    timeout: 60000,
                    depends: ['pattern-analysis'],
                    description: 'Validate compliance with .clinerules standards'
                },
                {
                    name: 'cost-analysis',
                    agent: 'SecurityReviewerAgent',
                    method: 'performSecurityReview',
                    required: true,
                    timeout: 45000,
                    depends: ['audit-compliance'],
                    description: 'Analyze infrastructure costs and security implications',
                    failConditions: ['fixedCosts > environmentThreshold']
                },
                {
                    name: 'security-review',
                    agent: 'SecurityReviewerAgent', 
                    method: 'assessSecurityRisks',
                    required: true,
                    timeout: 30000,
                    depends: ['cost-analysis'],
                    description: 'Comprehensive security risk assessment'
                },
                {
                    name: 'deploy',
                    agent: 'DeploymentAgent',
                    method: 'executeDeployment',
                    required: true,
                    timeout: 180000,
                    depends: ['security-review'],
                    description: 'Multi-account deployment with frontend test updates'
                }
            ],
            onSuccess: 'deployment-complete',
            onFailure: 'deployment-failed'
        };
    }

    createSecurityReviewWorkflow() {
        return {
            name: 'security-review',
            description: 'Comprehensive security assessment',
            steps: [
                {
                    name: 'pattern-analysis',
                    agent: 'PatternHarvestingAgent',
                    method: 'extractPatterns',
                    required: false,
                    parallel: true,
                    timeout: 30000
                },
                {
                    name: 'security-assessment',
                    agent: 'SecurityReviewerAgent',
                    method: 'performSecurityReview', 
                    required: true,
                    parallel: true,
                    timeout: 60000
                },
                {
                    name: 'audit-validation',
                    agent: 'AuditorAgent',
                    method: 'runFullAudit',
                    required: true,
                    timeout: 45000,
                    depends: ['pattern-analysis', 'security-assessment']
                }
            ]
        };
    }

    createCodeQualityWorkflow() {
        return {
            name: 'code-quality-check',
            description: 'Comprehensive code quality analysis',
            steps: [
                {
                    name: 'pattern-extraction',
                    agent: 'PatternHarvestingAgent',
                    method: 'extractPatterns',
                    required: true,
                    timeout: 45000
                },
                {
                    name: 'quality-audit',
                    agent: 'AuditorAgent', 
                    method: 'runFullAudit',
                    required: true,
                    timeout: 60000,
                    depends: ['pattern-extraction']
                },
                {
                    name: 'knowledge-synthesis',
                    agent: 'KnowledgeSynthesisAgent',
                    method: 'synthesizeKnowledge',
                    required: false,
                    timeout: 30000,
                    depends: ['quality-audit']
                }
            ]
        };
    }

    createFullStackDeployWorkflow() {
        return {
            name: 'full-stack-deploy',
            description: 'Complete full-stack deployment with all validations',
            steps: [
                {
                    name: 'pattern-analysis',
                    agent: 'PatternHarvestingAgent',
                    method: 'extractPatterns',
                    required: true,
                    timeout: 30000
                },
                {
                    name: 'test-data-preparation',
                    agent: 'TestDataAgent',
                    method: 'generateScenarioData',
                    required: false,
                    parallel: true,
                    timeout: 45000
                },
                {
                    name: 'audit-compliance',
                    agent: 'AuditorAgent',
                    method: 'runFullAudit',
                    required: true,
                    timeout: 60000,
                    depends: ['pattern-analysis']
                },
                {
                    name: 'cost-security-analysis',
                    agent: 'SecurityReviewerAgent',
                    method: 'performSecurityReview',
                    required: true,
                    timeout: 45000,
                    depends: ['audit-compliance'],
                    failConditions: ['criticalFindings > 0', 'fixedCosts > environmentThreshold']
                },
                {
                    name: 'knowledge-capture',
                    agent: 'KnowledgeSynthesisAgent',
                    method: 'synthesizeKnowledge',
                    required: false,
                    timeout: 30000,
                    depends: ['cost-security-analysis']
                },
                {
                    name: 'deploy-with-tests',
                    agent: 'DeploymentAgent',
                    method: 'executeDeployment',
                    required: true,
                    timeout: 300000,
                    depends: ['cost-security-analysis', 'test-data-preparation']
                }
            ]
        };
    }

    async executeWorkflow(workflowName, options = {}) {
        const workflowId = this.generateWorkflowId(workflowName);
        
        try {
            const workflow = this.workflows.get(workflowName);
            if (!workflow) {
                throw new Error(`Workflow '${workflowName}' not found`);
            }

            const execution = {
                id: workflowId,
                workflow: workflowName,
                status: 'running',
                startTime: new Date(),
                steps: new Map(),
                results: [],
                context: options.context || {},
                environment: options.environment || 'dev'
            };

            this.activeWorkflows.set(workflowId, execution);
            
            this.emit('workflow:started', {
                workflowId,
                workflowName,
                steps: workflow.steps.length
            });

            // Execute workflow steps
            const results = await this.executeWorkflowSteps(workflow, execution, options);
            
            execution.status = 'completed';
            execution.endTime = new Date();
            execution.duration = execution.endTime - execution.startTime;
            
            this.workflowHistory.push(execution);
            this.activeWorkflows.delete(workflowId);
            
            this.emit('workflow:completed', {
                workflowId,
                workflowName,
                duration: execution.duration,
                results: results.length
            });

            return {
                success: true,
                workflowId,
                results,
                duration: execution.duration
            };

        } catch (error) {
            const execution = this.activeWorkflows.get(workflowId);
            if (execution) {
                execution.status = 'failed';
                execution.error = error.message;
                execution.endTime = new Date();
                this.workflowHistory.push(execution);
                this.activeWorkflows.delete(workflowId);
            }

            this.emit('workflow:failed', {
                workflowId,
                workflowName,
                error: error.message
            });

            return {
                success: false,
                workflowId,
                error: error.message
            };
        }
    }

    async executeWorkflowSteps(workflow, execution, options) {
        const results = [];
        const completed = new Set();
        const running = new Map();
        
        // Build dependency graph
        const dependencyGraph = this.buildDependencyGraph(workflow.steps);
        
        while (completed.size < workflow.steps.length) {
            // Find steps that can run (dependencies satisfied)
            const readySteps = workflow.steps.filter(step => {
                if (completed.has(step.name) || running.has(step.name)) {
                    return false;
                }
                
                if (!step.depends) {
                    return true;
                }
                
                return step.depends.every(dep => completed.has(dep));
            });

            if (readySteps.length === 0 && running.size === 0) {
                throw new Error('Workflow deadlock: no steps can proceed');
            }

            // Execute ready steps (up to concurrent limit)
            const parallelSteps = readySteps.slice(0, this.config.maxConcurrentAgents - running.size);
            
            for (const step of parallelSteps) {
                const stepPromise = this.executeWorkflowStep(step, execution, options);
                running.set(step.name, stepPromise);
                
                stepPromise.then(result => {
                    results.push(result);
                    completed.add(step.name);
                    running.delete(step.name);
                }).catch(error => {
                    running.delete(step.name);
                    if (step.required) {
                        throw error;
                    } else {
                        console.warn(`Non-required step '${step.name}' failed:`, error.message);
                        completed.add(step.name);
                    }
                });
            }

            // Wait for at least one step to complete before continuing
            if (running.size > 0) {
                await Promise.race(running.values());
            }
        }

        return results;
    }

    async executeWorkflowStep(step, execution, options) {
        const stepStart = Date.now();
        
        try {
            this.emit('step:started', {
                workflowId: execution.id,
                stepName: step.name,
                agent: step.agent
            });

            const agent = this.agents.get(step.agent);
            if (!agent) {
                throw new Error(`Agent '${step.agent}' not available`);
            }

            // Prepare step context
            const stepContext = {
                ...execution.context,
                workflowId: execution.id,
                stepName: step.name,
                environment: execution.environment,
                previousResults: execution.results
            };

            // Execute the agent method
            let result;
            if (typeof agent.instance[step.method] === 'function') {
                result = await Promise.race([
                    agent.instance[step.method](stepContext, options),
                    this.createTimeoutPromise(step.timeout || this.config.defaultTimeout)
                ]);
            } else {
                throw new Error(`Method '${step.method}' not found on agent '${step.agent}'`);
            }

            // Validate step results against fail conditions
            if (step.failConditions) {
                this.validateStepResults(result, step.failConditions);
            }

            const stepResult = {
                stepName: step.name,
                agent: step.agent,
                method: step.method,
                success: true,
                result,
                duration: Date.now() - stepStart
            };

            execution.steps.set(step.name, stepResult);
            
            this.emit('step:completed', {
                workflowId: execution.id,
                stepName: step.name,
                duration: stepResult.duration
            });

            return stepResult;

        } catch (error) {
            const stepResult = {
                stepName: step.name,
                agent: step.agent,
                method: step.method,
                success: false,
                error: error.message,
                duration: Date.now() - stepStart
            };

            execution.steps.set(step.name, stepResult);
            
            this.emit('step:failed', {
                workflowId: execution.id,
                stepName: step.name,
                error: error.message
            });

            throw error;
        }
    }

    validateStepResults(result, failConditions) {
        for (const condition of failConditions) {
            // Simple condition evaluation (can be enhanced)
            if (condition.includes('fixedCosts > environmentThreshold')) {
                if (result.costAnalysis && result.costAnalysis.fixedCosts > 100) {
                    throw new Error(`Fixed costs exceed threshold: $${result.costAnalysis.fixedCosts}`);
                }
            }
            if (condition.includes('criticalFindings > 0')) {
                if (result.findings && result.findings.filter(f => f.severity === 'critical').length > 0) {
                    throw new Error('Critical security findings detected');
                }
            }
        }
    }

    createTimeoutPromise(timeout) {
        return new Promise((_, reject) => {
            setTimeout(() => reject(new Error(`Step timed out after ${timeout}ms`)), timeout);
        });
    }

    buildDependencyGraph(steps) {
        const graph = new Map();
        
        for (const step of steps) {
            graph.set(step.name, {
                step,
                dependencies: step.depends || [],
                dependents: []
            });
        }

        // Build reverse dependencies
        for (const [stepName, node] of graph) {
            for (const dep of node.dependencies) {
                if (graph.has(dep)) {
                    graph.get(dep).dependents.push(stepName);
                }
            }
        }

        return graph;
    }

    generateWorkflowId(workflowName) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const random = Math.random().toString(36).substr(2, 6);
        return `${workflowName}-${timestamp}-${random}`;
    }

    extractCapabilities(agentInstance) {
        // Try to extract capabilities from the agent
        if (agentInstance.capabilities) {
            return agentInstance.capabilities;
        }
        
        // Fallback: extract method names
        const methods = [];
        const proto = Object.getPrototypeOf(agentInstance);
        const methodNames = Object.getOwnPropertyNames(proto);
        
        for (const name of methodNames) {
            if (typeof agentInstance[name] === 'function' && !name.startsWith('_') && name !== 'constructor') {
                methods.push(name);
            }
        }
        
        return methods;
    }

    // Workflow management methods
    listWorkflows() {
        return Array.from(this.workflows.keys()).map(name => ({
            name,
            description: this.workflows.get(name).description,
            steps: this.workflows.get(name).steps.length
        }));
    }

    listAgents() {
        return Array.from(this.agents.values()).map(agent => ({
            name: agent.name,
            capabilities: agent.capabilities,
            status: agent.status
        }));
    }

    getWorkflowStatus(workflowId) {
        return this.activeWorkflows.get(workflowId) || 
               this.workflowHistory.find(w => w.id === workflowId);
    }

    getActiveWorkflows() {
        return Array.from(this.activeWorkflows.values());
    }

    getWorkflowHistory(limit = 50) {
        return this.workflowHistory.slice(-limit);
    }
}

module.exports = AgentOrchestrator;