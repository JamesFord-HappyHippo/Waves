/**
 * Pattern Harvesting Agent - Cross-Language Project Analysis
 * 
 * Analyzes existing projects in different languages/architectures
 * Harvests patterns, structures, and best practices for adaptation
 * Generates templates and implementation guidance for target architecture
 */

const fs = require('fs').promises;
const path = require('path');

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

class PatternHarvestingAgent {
    constructor() {
        this.supportedLanguages = {
            'csharp': {
                extensions: ['.cs', '.csproj', '.sln'],
                patterns: ['Controllers', 'Services', 'Models', 'DTOs', 'Repositories'],
                frameworks: ['ASP.NET Core', 'Entity Framework', '.NET']
            },
            'javascript': {
                extensions: ['.js', '.ts', '.jsx', '.tsx', '.json'],
                patterns: ['Components', 'Services', 'Handlers', 'Contexts', 'Hooks'],
                frameworks: ['React', 'Node.js', 'Express']
            },
            'python': {
                extensions: ['.py', '.requirements.txt', '.pyproject.toml'],
                patterns: ['Models', 'Views', 'Serializers', 'Services'],
                frameworks: ['Django', 'FastAPI', 'Flask']
            },
            'java': {
                extensions: ['.java', '.gradle', '.maven'],
                patterns: ['Controllers', 'Services', 'Entities', 'Repositories'],
                frameworks: ['Spring Boot', 'Spring MVC']
            }
        };

        this.harvestedPatterns = {
            architecture: [],
            dataStructures: [],
            apiPatterns: [],
            securityPatterns: [],
            businessLogic: [],
            integrationPatterns: []
        };
    }

    /**
     * Analyze project and harvest patterns for adaptation
     */
    async harvestProject(sourceProjectPath, targetArchitecture = 'tim-combo') {
        try {
            console.log(`🔍 Starting pattern harvest from: ${sourceProjectPath}`);
            
            // Phase 1: Project discovery and language detection
            const projectInfo = await this.analyzeProjectStructure(sourceProjectPath);
            console.log(`📋 Detected: ${projectInfo.language} project with ${projectInfo.fileCount} files`);

            // Phase 2: Pattern extraction based on language and framework
            const patterns = await this.extractPatterns(sourceProjectPath, projectInfo);
            console.log(`💡 Extracted ${patterns.totalPatterns} patterns across ${Object.keys(patterns.categories).length} categories`);

            // Phase 3: Check existing templates to avoid duplication
            const existingTemplates = await this.checkExistingTemplates();
            console.log(`📚 Found ${existingTemplates.length} existing templates`);

            // Phase 4: Generate adaptation recommendations
            const adaptations = await this.generateAdaptations(patterns, targetArchitecture, existingTemplates);
            console.log(`🎯 Generated ${adaptations.length} adaptation recommendations`);

            // Phase 5: Create implementation templates (only new ones)
            const templates = await this.generateTemplates(adaptations, targetArchitecture);
            console.log(`📝 Created ${templates.newTemplates} new templates (skipped ${templates.skippedDuplicates} duplicates)`);

            const harvestResults = {
                sourceProject: {
                    path: sourceProjectPath,
                    language: projectInfo.language,
                    framework: projectInfo.framework,
                    fileCount: projectInfo.fileCount
                },
                patternsHarvested: patterns,
                adaptationsGenerated: adaptations,
                templatesCreated: templates,
                existingTemplates: existingTemplates.length,
                recommendations: this.generateRecommendations(patterns, adaptations)
            };

            return createSuccessResponse(
                harvestResults,
                `Successfully harvested patterns from ${projectInfo.language} project`,
                {
                    patterns_extracted: patterns.totalPatterns,
                    templates_created: templates.newTemplates,
                    duplicates_avoided: templates.skippedDuplicates,
                    timestamp: new Date().toISOString()
                }
            );

        } catch (error) {
            console.error('Pattern harvesting failed:', error);
            return createErrorResponse(error.message, 'PATTERN_HARVEST_ERROR');
        }
    }

    /**
     * Analyze project structure and detect language/framework
     */
    async analyzeProjectStructure(projectPath) {
        const structure = {
            language: 'unknown',
            framework: 'unknown',
            fileCount: 0,
            directories: [],
            keyFiles: [],
            architecture: 'unknown'
        };

        try {
            const files = await this.scanProjectFiles(projectPath);
            structure.fileCount = files.length;

            // Detect language by file extensions
            const extensionCounts = {};
            for (const file of files) {
                const ext = path.extname(file);
                extensionCounts[ext] = (extensionCounts[ext] || 0) + 1;
            }

            // Determine primary language
            for (const [lang, config] of Object.entries(this.supportedLanguages)) {
                const relevantFiles = files.filter(file => 
                    config.extensions.some(ext => file.endsWith(ext))
                );
                
                if (relevantFiles.length > structure.fileCount * 0.3) { // 30% threshold
                    structure.language = lang;
                    structure.keyFiles = relevantFiles.slice(0, 20); // Sample key files
                    break;
                }
            }

            // Detect framework/architecture
            if (structure.language === 'csharp') {
                structure.framework = await this.detectDotNetFramework(files);
                structure.architecture = await this.detectDotNetArchitecture(projectPath);
            }

            // Extract directory structure patterns
            structure.directories = await this.extractDirectoryPatterns(projectPath);

        } catch (error) {
            console.error('Project structure analysis failed:', error);
        }

        return structure;
    }

    /**
     * Extract patterns from source project based on language
     */
    async extractPatterns(projectPath, projectInfo) {
        const patterns = {
            categories: {},
            totalPatterns: 0
        };

        switch (projectInfo.language) {
            case 'csharp':
                patterns.categories = await this.extractDotNetPatterns(projectPath);
                break;
            case 'javascript':
                patterns.categories = await this.extractJavaScriptPatterns(projectPath);
                break;
            default:
                patterns.categories = await this.extractGenericPatterns(projectPath);
        }

        patterns.totalPatterns = Object.values(patterns.categories)
            .reduce((sum, category) => sum + category.length, 0);

        return patterns;
    }

    /**
     * Extract .NET specific patterns from Callisto
     */
    async extractDotNetPatterns(projectPath) {
        const patterns = {
            controllers: [],
            services: [],
            models: [],
            dtos: [],
            repositories: [],
            middleware: [],
            configuration: [],
            security: []
        };

        try {
            // Find and analyze Controllers
            const controllerFiles = await this.findFilesByPattern(projectPath, '*Controller.cs');
            for (const controllerFile of controllerFiles.slice(0, 10)) { // Limit for performance
                const controllerPattern = await this.analyzeDotNetController(controllerFile);
                if (controllerPattern) {
                    patterns.controllers.push(controllerPattern);
                }
            }

            // Find and analyze Services
            const serviceFiles = await this.findFilesByPattern(projectPath, '*Service.cs');
            for (const serviceFile of serviceFiles.slice(0, 10)) {
                const servicePattern = await this.analyzeDotNetService(serviceFile);
                if (servicePattern) {
                    patterns.services.push(servicePattern);
                }
            }

            // Find and analyze Models/DTOs
            const modelFiles = await this.findFilesByPattern(projectPath, '*.cs');
            const modelPatterns = await this.analyzeDotNetModels(modelFiles.slice(0, 20));
            patterns.models.push(...modelPatterns.models);
            patterns.dtos.push(...modelPatterns.dtos);

            // Find configuration patterns
            const configFiles = await this.findFilesByPattern(projectPath, 'appsettings*.json');
            for (const configFile of configFiles) {
                const configPattern = await this.analyzeDotNetConfiguration(configFile);
                if (configPattern) {
                    patterns.configuration.push(configPattern);
                }
            }

        } catch (error) {
            console.error('Error extracting .NET patterns:', error);
        }

        return patterns;
    }

    /**
     * Analyze .NET Controller for API patterns
     */
    async analyzeDotNetController(controllerPath) {
        try {
            const content = await fs.readFile(controllerPath, 'utf8');
            const fileName = path.basename(controllerPath, '.cs');

            const pattern = {
                name: fileName,
                type: 'controller',
                source: controllerPath,
                endpoints: [],
                authPatterns: [],
                validationPatterns: [],
                responsePatterns: []
            };

            // Extract API endpoints
            const endpointMatches = content.match(/\[Http(Get|Post|Put|Delete)(?:\("([^"]+)")?\)\]/gi) || [];
            pattern.endpoints = endpointMatches.map(match => {
                const method = match.match(/Http(Get|Post|Put|Delete)/i)[1];
                const route = match.match(/"([^"]+)"/) ? match.match(/"([^"]+)"/)[1] : '';
                return { method, route };
            });

            // Extract authorization patterns
            if (content.includes('[Authorize')) {
                const authMatches = content.match(/\[Authorize[^\]]*\]/g) || [];
                pattern.authPatterns = authMatches.map(auth => auth.trim());
            }

            // Extract validation patterns
            if (content.includes('[Valid')) {
                const validationMatches = content.match(/\[Valid[^\]]*\]/g) || [];
                pattern.validationPatterns = validationMatches.map(val => val.trim());
            }

            // Extract response patterns
            const actionMethods = content.match(/public\s+(?:async\s+)?(?:Task<)?(?:IActionResult|ActionResult)[^{]+\{[^}]+\}/gs) || [];
            pattern.responsePatterns = actionMethods.map(method => {
                const returnStatements = method.match(/return\s+[^;]+;/g) || [];
                return returnStatements.map(ret => ret.replace(/return\s+/, '').replace(/;$/, ''));
            }).flat();

            return pattern;

        } catch (error) {
            console.error(`Error analyzing controller ${controllerPath}:`, error);
            return null;
        }
    }

    /**
     * Check existing templates to avoid duplication
     */
    async checkExistingTemplates() {
        const existingTemplates = [];
        
        try {
            // Check integration_templates table in database would be ideal,
            // but for now check file system patterns
            const templatesDir = '/Users/jamesford/Source/Tim-Combo/src/templates';
            
            try {
                const templateFiles = await fs.readdir(templatesDir);
                for (const templateFile of templateFiles) {
                    if (templateFile.endsWith('.json') || templateFile.endsWith('.js')) {
                        existingTemplates.push({
                            name: templateFile,
                            path: path.join(templatesDir, templateFile),
                            type: 'file_template'
                        });
                    }
                }
            } catch (error) {
                // Templates directory doesn't exist yet
            }

            // Check database templates (would require DB connection)
            // For now, we'll assume some common templates exist
            const commonTemplates = [
                'basic_crud_controller',
                'authentication_middleware', 
                'api_response_wrapper',
                'error_handling_pattern'
            ];

            existingTemplates.push(...commonTemplates.map(name => ({
                name,
                type: 'database_template',
                source: 'existing_system'
            })));

        } catch (error) {
            console.error('Error checking existing templates:', error);
        }

        return existingTemplates;
    }

    /**
     * Generate adaptation recommendations
     */
    async generateAdaptations(patterns, targetArchitecture, existingTemplates) {
        const adaptations = [];
        const existingNames = new Set(existingTemplates.map(t => t.name.toLowerCase()));

        // Adapt .NET Controllers to Node.js/Lambda handlers
        if (patterns.categories.controllers) {
            for (const controller of patterns.categories.controllers) {
                const adaptationName = `${controller.name.toLowerCase()}_handler_pattern`;
                
                if (!existingNames.has(adaptationName)) {
                    adaptations.push({
                        name: adaptationName,
                        type: 'controller_to_handler',
                        source: controller,
                        targetPattern: 'lambda_handler_with_wrapper',
                        adaptations: {
                            structure: this.adaptControllerToHandler(controller),
                            authentication: this.adaptAuthPatterns(controller.authPatterns),
                            validation: this.adaptValidationPatterns(controller.validationPatterns),
                            responses: this.adaptResponsePatterns(controller.responsePatterns)
                        },
                        priority: controller.endpoints.length > 3 ? 'high' : 'medium'
                    });
                }
            }
        }

        // Adapt .NET Services to Node.js services
        if (patterns.categories.services) {
            for (const service of patterns.categories.services) {
                const adaptationName = `${service.name.toLowerCase()}_service_pattern`;
                
                if (!existingNames.has(adaptationName)) {
                    adaptations.push({
                        name: adaptationName,
                        type: 'service_to_service',
                        source: service,
                        targetPattern: 'nodejs_service_class',
                        adaptations: {
                            structure: this.adaptServiceStructure(service),
                            dependencies: this.adaptServiceDependencies(service),
                            methods: this.adaptServiceMethods(service)
                        },
                        priority: 'medium'
                    });
                }
            }
        }

        return adaptations.filter(adaptation => 
            !existingNames.has(adaptation.name.toLowerCase())
        );
    }

    /**
     * Generate implementation templates from adaptations
     */
    async generateTemplates(adaptations, targetArchitecture) {
        const results = {
            newTemplates: 0,
            skippedDuplicates: 0,
            templates: []
        };

        for (const adaptation of adaptations) {
            try {
                const template = await this.createImplementationTemplate(adaptation, targetArchitecture);
                
                if (template) {
                    results.templates.push(template);
                    results.newTemplates++;
                    
                    // Save template to file system
                    await this.saveTemplate(template);
                }
                
            } catch (error) {
                console.error(`Error generating template for ${adaptation.name}:`, error);
                results.skippedDuplicates++;
            }
        }

        return results;
    }

    /**
     * Create implementation template from adaptation
     */
    async createImplementationTemplate(adaptation, targetArchitecture) {
        const template = {
            template_id: adaptation.name,
            template_name: this.formatTemplateName(adaptation.name),
            source_system: adaptation.source.type || 'dotnet',
            target_system: targetArchitecture,
            category: adaptation.type,
            description: `Adapted ${adaptation.source.type} pattern for ${targetArchitecture}`,
            implementation: {},
            metadata: {
                created: new Date().toISOString(),
                source_file: adaptation.source.source,
                adaptation_type: adaptation.type,
                priority: adaptation.priority
            }
        };

        switch (adaptation.type) {
            case 'controller_to_handler':
                template.implementation = this.generateHandlerImplementation(adaptation);
                break;
            case 'service_to_service':
                template.implementation = this.generateServiceImplementation(adaptation);
                break;
            default:
                template.implementation = this.generateGenericImplementation(adaptation);
        }

        return template;
    }

    /**
     * Generate Lambda handler implementation from .NET controller
     */
    generateHandlerImplementation(adaptation) {
        const controller = adaptation.source;
        
        return {
            handler_file: `${controller.name.toLowerCase()}Handler.js`,
            handler_code: this.generateHandlerCode(controller),
            test_file: `${controller.name.toLowerCase()}Handler.test.js`,
            test_code: this.generateHandlerTests(controller),
            dependencies: ['./lambdaWrapper', './dbOperations', './responseUtil', './errorHandler'],
            deployment_config: {
                timeout: 30,
                memory: 256,
                environment_variables: ['DB_HOST', 'DB_NAME']
            },
            api_endpoints: controller.endpoints.map(endpoint => ({
                method: endpoint.method,
                path: endpoint.route || `/${controller.name.toLowerCase()}`,
                handler: `${controller.name.toLowerCase()}Handler.handler`
            }))
        };
    }

    /**
     * Generate actual handler code
     */
    generateHandlerCode(controller) {
        return `const { wrapHandler } = require('./lambdaWrapper');
const { executeQuery } = require('./dbOperations');
const { createSuccessResponse, createErrorResponse } = require('./responseUtil');
const { handleError } = require('./errorHandler');

/**
 * ${controller.name} Handler
 * Adapted from .NET Controller: ${controller.source}
 * 
 * Endpoints: ${controller.endpoints.map(e => `${e.method} ${e.route}`).join(', ')}
 */

async function ${controller.name.toLowerCase()}Handler({ queryParams = {}, requestBody = {}, requestContext }) {
    try {
        const Request_ID = requestContext.requestId;
        
        // Extract HTTP method from request context
        const httpMethod = requestContext.httpMethod || requestContext.requestContext?.http?.method;
        
        switch (httpMethod) {
            case 'GET':
                return await handle${controller.name}Get(queryParams, Request_ID);
            case 'POST':
                return await handle${controller.name}Post(requestBody, Request_ID);
            case 'PUT':
                return await handle${controller.name}Put(queryParams, requestBody, Request_ID);
            case 'DELETE':
                return await handle${controller.name}Delete(queryParams, Request_ID);
            default:
                return createErrorResponse('Method not allowed', 'METHOD_NOT_ALLOWED');
        }
    } catch (error) {
        console.error('${controller.name} Handler Error:', error);
        return handleError(error);
    }
}

${controller.endpoints.map(endpoint => this.generateEndpointMethod(controller.name, endpoint)).join('\n\n')}

exports.handler = wrapHandler(${controller.name.toLowerCase()}Handler);`;
    }

    /**
     * Generate endpoint method implementation
     */
    generateEndpointMethod(controllerName, endpoint) {
        const methodName = `handle${controllerName}${endpoint.method}`;
        const params = endpoint.method === 'GET' || endpoint.method === 'DELETE' 
            ? 'queryParams, Request_ID' 
            : 'requestBody, Request_ID';

        return `async function ${methodName}(${params}) {
    // TODO: Implement ${endpoint.method} ${endpoint.route || `/${controllerName.toLowerCase()}`}
    // Adapted from .NET Controller endpoint
    
    try {
        // Add your business logic here
        const results = await executeQuery(
            'SELECT * FROM your_table WHERE condition = $1',
            [/* parameters */]
        );

        return createSuccessResponse(
            { Records: results },
            '${endpoint.method} operation completed successfully',
            {
                Request_ID,
                Timestamp: new Date().toISOString(),
                Total_Records: results.length
            }
        );
    } catch (error) {
        console.error('${methodName} Error:', error);
        return handleError(error);
    }
}`;
    }

    // Helper methods for pattern analysis and adaptation
    async scanProjectFiles(projectPath) {
        const files = [];
        
        try {
            const entries = await fs.readdir(projectPath, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(projectPath, entry.name);
                
                // Skip common directories we don't need to analyze
                if (entry.isDirectory() && !['node_modules', 'bin', 'obj', '.git', '.vs'].includes(entry.name)) {
                    const subFiles = await this.scanProjectFiles(fullPath);
                    files.push(...subFiles);
                } else if (entry.isFile()) {
                    files.push(fullPath);
                }
            }
        } catch (error) {
            console.error(`Error scanning ${projectPath}:`, error.message);
        }
        
        return files;
    }

    async findFilesByPattern(projectPath, pattern) {
        const allFiles = await this.scanProjectFiles(projectPath);
        const regex = new RegExp(pattern.replace('*', '.*'), 'i');
        return allFiles.filter(file => regex.test(path.basename(file)));
    }

    async detectDotNetFramework(files) {
        const csprojFiles = files.filter(f => f.endsWith('.csproj'));
        if (csprojFiles.length > 0) {
            try {
                const content = await fs.readFile(csprojFiles[0], 'utf8');
                if (content.includes('<TargetFramework>net')) {
                    return '.NET Core/.NET 5+';
                } else if (content.includes('Microsoft.AspNetCore')) {
                    return 'ASP.NET Core';
                }
            } catch (error) {
                // File read error
            }
        }
        return '.NET Framework';
    }

    async detectDotNetArchitecture(projectPath) {
        const directories = await this.extractDirectoryPatterns(projectPath);
        
        if (directories.includes('Controllers') && directories.includes('Models')) {
            return 'MVC';
        } else if (directories.includes('Controllers') && directories.includes('Services')) {
            return 'Web API with Services';
        } else if (directories.includes('Areas')) {
            return 'Areas-based Architecture';
        }
        
        return 'Standard';
    }

    async extractDirectoryPatterns(projectPath) {
        try {
            const entries = await fs.readdir(projectPath, { withFileTypes: true });
            return entries
                .filter(entry => entry.isDirectory())
                .map(entry => entry.name)
                .filter(name => !['bin', 'obj', 'node_modules', '.git', '.vs'].includes(name));
        } catch (error) {
            return [];
        }
    }

    // Adaptation helper methods
    adaptControllerToHandler(controller) {
        return {
            original_controller: controller.name,
            lambda_handler: `${controller.name.toLowerCase()}Handler`,
            endpoint_mapping: controller.endpoints.map(endpoint => ({
                original: `${endpoint.method} ${endpoint.route}`,
                adapted: `Lambda handler with ${endpoint.method} method`
            }))
        };
    }

    adaptAuthPatterns(authPatterns) {
        return authPatterns.map(pattern => {
            if (pattern.includes('Authorize')) {
                return 'AWS Cognito JWT validation in Lambda wrapper';
            }
            return 'Custom authentication middleware';
        });
    }

    adaptValidationPatterns(validationPatterns) {
        return validationPatterns.map(pattern => {
            if (pattern.includes('Valid')) {
                return 'Request validation using validationUtil helper';
            }
            return 'Custom validation logic';
        });
    }

    adaptResponsePatterns(responsePatterns) {
        return responsePatterns.map(pattern => {
            if (pattern.includes('Ok(')) {
                return 'createSuccessResponse with Records array';
            } else if (pattern.includes('BadRequest')) {
                return 'createErrorResponse with validation errors';
            } else if (pattern.includes('NotFound')) {
                return 'createErrorResponse with NOT_FOUND code';
            }
            return 'Standard API response format';
        });
    }

    // Additional helper methods would continue here...
    formatTemplateName(templateId) {
        return templateId.split('_').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
    }

    generateRecommendations(patterns, adaptations) {
        const recommendations = [];

        if (adaptations.length > 5) {
            recommendations.push({
                type: 'implementation_priority',
                message: 'Consider implementing high-priority adaptations first',
                action: 'Focus on controller adaptations with multiple endpoints'
            });
        }

        if (patterns.categories.controllers?.length > 0) {
            recommendations.push({
                type: 'architecture_alignment',
                message: 'Align Lambda handlers with existing API patterns',
                action: 'Use consistent response formats and error handling'
            });
        }

        return recommendations;
    }

    async saveTemplate(template) {
        // Save template to file system for review
        const templatesDir = '/Users/jamesford/Source/Tim-Combo/src/templates/harvested';
        
        try {
            await fs.mkdir(templatesDir, { recursive: true });
            const templatePath = path.join(templatesDir, `${template.template_id}.json`);
            await fs.writeFile(templatePath, JSON.stringify(template, null, 2));
            console.log(`💾 Saved template: ${templatePath}`);
        } catch (error) {
            console.error('Error saving template:', error);
        }
    }

    // Placeholder methods for other pattern types
    async extractJavaScriptPatterns(projectPath) { return {}; }
    async extractGenericPatterns(projectPath) { return {}; }
    async analyzeDotNetService(servicePath) { return null; }
    async analyzeDotNetModels(modelFiles) { return { models: [], dtos: [] }; }
    async analyzeDotNetConfiguration(configPath) { return null; }
    adaptServiceStructure(service) { return {}; }
    adaptServiceDependencies(service) { return []; }
    adaptServiceMethods(service) { return []; }
    generateServiceImplementation(adaptation) { return {}; }
    generateGenericImplementation(adaptation) { return {}; }
    generateHandlerTests(controller) { return `// TODO: Generate comprehensive tests for ${controller.name}`; }
}

module.exports = PatternHarvestingAgent;