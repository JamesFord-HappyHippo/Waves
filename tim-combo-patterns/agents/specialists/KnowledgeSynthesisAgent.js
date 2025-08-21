/**
 * Knowledge Synthesis Agent - Memory Consolidation & Standards Evolution
 * 
 * Reads through agent private memories and proposes additions to shared standards
 * Evolves .clinerules, CLAUDE.md, and other shared knowledge bases
 */

const fs = require('fs').promises;
const path = require('path');
const { createSuccessResponse, createErrorResponse } = require('../../backend/src/helpers/responseUtil');

class KnowledgeSynthesisAgent {
    constructor() {
        this.memoryTypes = {
            'agent_memories': {
                description: 'Private agent learning and experience records',
                locations: [
                    'src/agents/memories/',
                    'src/agents/private/',
                    'src/agents/tasks/completed/',
                    'src/agents/learnings/'
                ]
            },
            'session_logs': {
                description: 'Development session logs and discoveries',
                locations: [
                    'logs/',
                    'session-notes/',
                    'development-log/',
                    'docs/sessions/'
                ]
            },
            'implementation_patterns': {
                description: 'Successful implementation patterns discovered',
                locations: [
                    'src/patterns/',
                    'src/examples/',
                    'src/templates/',
                    'src/blueprints/'
                ]
            }
        };

        this.sharedKnowledgeBases = {
            '.clinerules/': {
                description: 'Systematic development patterns and standards',
                files: [
                    'api_standards.md',
                    'backend_handler_standards.md', 
                    'frontend_standards.md',
                    'development_principles.md',
                    'core_architecture.md'
                ]
            },
            'CLAUDE.md': {
                description: 'Claude Code configuration and guidelines',
                single_file: true
            },
            '.adrian/': {
                description: 'Adrian (Cline) configuration patterns',
                files: [
                    'rules.md',
                    'patterns.md',
                    'architecture.md'
                ]
            }
        };

        this.synthesisResults = {
            patterns_discovered: [],
            standards_gaps: [],
            proposed_additions: [],
            knowledge_conflicts: []
        };
    }

    /**
     * Run comprehensive knowledge synthesis across all agent memories
     */
    async synthesizeKnowledge(targetDirectory = '/Users/jamesford/Source/Tim-Combo') {
        try {
            console.log('🧠 Starting knowledge synthesis from agent memories...');
            
            // Phase 1: Collect all agent memories and experiences
            const memories = await this.collectAgentMemories(targetDirectory);
            console.log(`📚 Collected ${memories.length} memory sources`);

            // Phase 2: Analyze current shared knowledge bases
            const currentKnowledge = await this.analyzeSharedKnowledge(targetDirectory);
            console.log(`📖 Analyzed ${Object.keys(currentKnowledge).length} knowledge bases`);

            // Phase 3: Extract patterns and insights from memories
            const insights = await this.extractInsights(memories);
            console.log(`💡 Extracted ${insights.patterns.length} patterns and ${insights.learnings.length} learnings`);

            // Phase 4: Identify gaps in shared knowledge
            const gaps = await this.identifyKnowledgeGaps(insights, currentKnowledge);
            console.log(`🔍 Identified ${gaps.length} knowledge gaps`);

            // Phase 5: Generate proposals for shared standards
            const proposals = await this.generateStandardsProposals(insights, gaps, currentKnowledge);
            console.log(`📝 Generated ${proposals.length} standards proposals`);

            // Phase 6: Create synthesis report
            const synthesisReport = this.createSynthesisReport(memories, insights, gaps, proposals);

            return createSuccessResponse(
                { synthesisReport, proposals },
                'Knowledge synthesis completed successfully',
                {
                    memories_processed: memories.length,
                    insights_extracted: insights.patterns.length + insights.learnings.length,
                    gaps_identified: gaps.length,
                    proposals_generated: proposals.length,
                    timestamp: new Date().toISOString()
                }
            );

        } catch (error) {
            console.error('Knowledge synthesis failed:', error);
            return createErrorResponse(error.message, 'KNOWLEDGE_SYNTHESIS_ERROR');
        }
    }

    /**
     * Collect memories from all agent sources
     */
    async collectAgentMemories(targetDir) {
        const memories = [];

        for (const [type, config] of Object.entries(this.memoryTypes)) {
            console.log(`🔍 Collecting ${type}...`);
            
            for (const location of config.locations) {
                const fullPath = path.join(targetDir, location);
                const memoryFiles = await this.findMemoryFiles(fullPath);
                
                for (const memoryFile of memoryFiles) {
                    try {
                        const content = await fs.readFile(memoryFile, 'utf8');
                        memories.push({
                            type,
                            source: memoryFile,
                            content,
                            lastModified: (await fs.stat(memoryFile)).mtime
                        });
                    } catch (error) {
                        // File not accessible, skip
                    }
                }
            }
        }

        return memories;
    }

    /**
     * Analyze current shared knowledge bases
     */
    async analyzeSharedKnowledge(targetDir) {
        const knowledge = {};

        for (const [baseName, config] of Object.entries(this.sharedKnowledgeBases)) {
            const basePath = path.join(targetDir, baseName);
            
            try {
                if (config.single_file) {
                    // Single file like CLAUDE.md
                    const content = await fs.readFile(basePath, 'utf8');
                    knowledge[baseName] = {
                        type: 'single_file',
                        content,
                        sections: this.extractSections(content)
                    };
                } else {
                    // Directory with multiple files
                    const directoryFiles = {};
                    
                    if (config.files) {
                        for (const fileName of config.files) {
                            const filePath = path.join(basePath, fileName);
                            try {
                                const content = await fs.readFile(filePath, 'utf8');
                                directoryFiles[fileName] = {
                                    content,
                                    sections: this.extractSections(content)
                                };
                            } catch (error) {
                                // File doesn't exist yet
                                directoryFiles[fileName] = { missing: true };
                            }
                        }
                    }
                    
                    knowledge[baseName] = {
                        type: 'directory',
                        files: directoryFiles
                    };
                }
            } catch (error) {
                knowledge[baseName] = { missing: true, error: error.message };
            }
        }

        return knowledge;
    }

    /**
     * Extract insights and patterns from collected memories
     */
    async extractInsights(memories) {
        const insights = {
            patterns: [],
            learnings: [],
            solutions: [],
            antiPatterns: []
        };

        for (const memory of memories) {
            const extracted = this.analyzeMemoryContent(memory);
            
            insights.patterns.push(...extracted.patterns);
            insights.learnings.push(...extracted.learnings);
            insights.solutions.push(...extracted.solutions);
            insights.antiPatterns.push(...extracted.antiPatterns);
        }

        // Deduplicate and rank by frequency/importance
        insights.patterns = this.deduplicate(insights.patterns);
        insights.learnings = this.deduplicate(insights.learnings);
        insights.solutions = this.deduplicate(insights.solutions);
        insights.antiPatterns = this.deduplicate(insights.antiPatterns);

        return insights;
    }

    /**
     * Analyze individual memory content for patterns
     */
    analyzeMemoryContent(memory) {
        const extracted = {
            patterns: [],
            learnings: [],
            solutions: [],
            antiPatterns: []
        };

        const content = memory.content.toLowerCase();

        // Pattern detection
        if (content.includes('pattern') || content.includes('approach')) {
            extracted.patterns.push(...this.extractPatterns(memory));
        }

        // Learning detection
        if (content.includes('learned') || content.includes('discovered') || content.includes('found')) {
            extracted.learnings.push(...this.extractLearnings(memory));
        }

        // Solution detection
        if (content.includes('solution') || content.includes('fix') || content.includes('resolved')) {
            extracted.solutions.push(...this.extractSolutions(memory));
        }

        // Anti-pattern detection
        if (content.includes('avoid') || content.includes('don\'t') || content.includes('problem')) {
            extracted.antiPatterns.push(...this.extractAntiPatterns(memory));
        }

        return extracted;
    }

    /**
     * Extract patterns from memory content
     */
    extractPatterns(memory) {
        const patterns = [];
        const lines = memory.content.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].toLowerCase();
            
            // Look for pattern indicators
            if (line.includes('pattern') || line.includes('approach') || line.includes('methodology')) {
                const context = lines.slice(Math.max(0, i-2), i+3).join('\n');
                patterns.push({
                    type: 'pattern',
                    source: memory.source,
                    context: context.trim(),
                    confidence: this.calculateConfidence(context, 'pattern'),
                    domain: this.identifyDomain(context)
                });
            }
        }

        return patterns;
    }

    /**
     * Extract learnings from memory content
     */
    extractLearnings(memory) {
        const learnings = [];
        const lines = memory.content.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].toLowerCase();
            
            if (line.includes('learned') || line.includes('discovered') || line.includes('insight')) {
                const context = lines.slice(Math.max(0, i-1), i+2).join('\n');
                learnings.push({
                    type: 'learning',
                    source: memory.source,
                    context: context.trim(),
                    confidence: this.calculateConfidence(context, 'learning'),
                    domain: this.identifyDomain(context)
                });
            }
        }

        return learnings;
    }

    /**
     * Identify knowledge gaps between insights and current standards
     */
    async identifyKnowledgeGaps(insights, currentKnowledge) {
        const gaps = [];

        // Check for patterns not covered in standards
        for (const pattern of insights.patterns) {
            if (!this.isPatternCovered(pattern, currentKnowledge)) {
                gaps.push({
                    type: 'missing_pattern',
                    pattern,
                    suggestedLocation: this.suggestLocation(pattern),
                    priority: this.calculatePriority(pattern)
                });
            }
        }

        // Check for learnings that should be documented
        for (const learning of insights.learnings) {
            if (!this.isLearningDocumented(learning, currentKnowledge)) {
                gaps.push({
                    type: 'missing_learning',
                    learning,
                    suggestedLocation: this.suggestLocation(learning),
                    priority: this.calculatePriority(learning)
                });
            }
        }

        return gaps.sort((a, b) => b.priority - a.priority);
    }

    /**
     * Generate proposals for updating shared standards
     */
    async generateStandardsProposals(insights, gaps, currentKnowledge) {
        const proposals = [];

        // Group gaps by suggested location
        const gapsByLocation = this.groupBy(gaps, 'suggestedLocation');

        for (const [location, locationGaps] of Object.entries(gapsByLocation)) {
            const proposal = {
                targetFile: location,
                type: 'standards_addition',
                additions: [],
                rationale: '',
                priority: Math.max(...locationGaps.map(gap => gap.priority))
            };

            for (const gap of locationGaps) {
                if (gap.type === 'missing_pattern') {
                    proposal.additions.push({
                        section: this.determineSectionForPattern(gap.pattern),
                        content: this.formatPatternForStandards(gap.pattern),
                        type: 'pattern'
                    });
                } else if (gap.type === 'missing_learning') {
                    proposal.additions.push({
                        section: this.determineSectionForLearning(gap.learning),
                        content: this.formatLearningForStandards(gap.learning),
                        type: 'learning'
                    });
                }
            }

            proposal.rationale = this.generateRationale(locationGaps);
            proposals.push(proposal);
        }

        return proposals.sort((a, b) => b.priority - a.priority);
    }

    /**
     * Create comprehensive synthesis report
     */
    createSynthesisReport(memories, insights, gaps, proposals) {
        return {
            summary: {
                memories_analyzed: memories.length,
                patterns_discovered: insights.patterns.length,
                learnings_extracted: insights.learnings.length,
                gaps_identified: gaps.length,
                proposals_generated: proposals.length
            },
            topPatterns: insights.patterns.slice(0, 10),
            topLearnings: insights.learnings.slice(0, 10),
            criticalGaps: gaps.filter(gap => gap.priority > 0.7),
            highPriorityProposals: proposals.filter(proposal => proposal.priority > 0.7),
            recommendedActions: this.generateRecommendedActions(proposals),
            knowledgeEvolution: this.trackKnowledgeEvolution(insights, gaps)
        };
    }

    /**
     * Generate recommended actions for knowledge consolidation
     */
    generateRecommendedActions(proposals) {
        const actions = [];

        const highPriorityProposals = proposals.filter(p => p.priority > 0.8);
        
        if (highPriorityProposals.length > 0) {
            actions.push({
                action: 'immediate_standards_update',
                description: 'Update shared standards with high-priority patterns',
                targets: highPriorityProposals.map(p => p.targetFile),
                effort: 'medium'
            });
        }

        const newPatternCount = proposals.reduce((sum, p) => 
            sum + p.additions.filter(a => a.type === 'pattern').length, 0
        );

        if (newPatternCount > 5) {
            actions.push({
                action: 'pattern_consolidation',
                description: 'Consolidate discovered patterns into comprehensive documentation',
                effort: 'high',
                impact: 'high'
            });
        }

        return actions;
    }

    // Helper methods
    async findMemoryFiles(dirPath) {
        const files = [];
        try {
            const entries = await fs.readdir(dirPath, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);
                
                if (entry.isDirectory()) {
                    const subFiles = await this.findMemoryFiles(fullPath);
                    files.push(...subFiles);
                } else if (this.isMemoryFile(entry.name)) {
                    files.push(fullPath);
                }
            }
        } catch (error) {
            // Directory not accessible
        }
        
        return files;
    }

    isMemoryFile(fileName) {
        const memoryExtensions = ['.md', '.txt', '.log', '.json'];
        const memoryKeywords = ['memory', 'learning', 'session', 'note', 'discovery', 'insight'];
        
        return memoryExtensions.some(ext => fileName.endsWith(ext)) &&
               (memoryKeywords.some(keyword => fileName.toLowerCase().includes(keyword)) ||
                fileName.includes('task') || fileName.includes('agent'));
    }

    extractSections(content) {
        const sections = [];
        const lines = content.split('\n');
        let currentSection = null;
        
        for (const line of lines) {
            if (line.startsWith('#')) {
                if (currentSection) {
                    sections.push(currentSection);
                }
                currentSection = {
                    title: line.replace(/^#+\s*/, ''),
                    content: []
                };
            } else if (currentSection) {
                currentSection.content.push(line);
            }
        }
        
        if (currentSection) {
            sections.push(currentSection);
        }
        
        return sections;
    }

    calculateConfidence(context, type) {
        // Simple heuristic for confidence scoring
        const indicators = {
            pattern: ['consistently', 'always', 'standard', 'approach'],
            learning: ['discovered', 'realized', 'found', 'important']
        };
        
        const relevantIndicators = indicators[type] || [];
        const matches = relevantIndicators.filter(indicator => 
            context.toLowerCase().includes(indicator)
        );
        
        return Math.min(matches.length * 0.3, 1.0);
    }

    identifyDomain(context) {
        const domains = {
            'frontend': ['react', 'component', 'ui', 'interface'],
            'backend': ['handler', 'api', 'database', 'server'],
            'deployment': ['deploy', 'build', 'environment', 'aws'],
            'testing': ['test', 'spec', 'playwright', 'validation']
        };

        for (const [domain, keywords] of Object.entries(domains)) {
            if (keywords.some(keyword => context.toLowerCase().includes(keyword))) {
                return domain;
            }
        }

        return 'general';
    }

    deduplicate(items) {
        const seen = new Set();
        return items.filter(item => {
            const key = item.context?.substring(0, 100) || item.toString();
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
    }

    groupBy(array, key) {
        return array.reduce((groups, item) => {
            const group = item[key];
            groups[group] = groups[group] || [];
            groups[group].push(item);
            return groups;
        }, {});
    }

    // Additional helper methods for pattern analysis
    extractSolutions(memory) { return []; }
    extractAntiPatterns(memory) { return []; }
    isPatternCovered(pattern, knowledge) { return false; }
    isLearningDocumented(learning, knowledge) { return false; }
    suggestLocation(item) { return '.clinerules/discovered_patterns.md'; }
    calculatePriority(item) { return item.confidence || 0.5; }
    determineSectionForPattern(pattern) { return 'Discovered Patterns'; }
    determineSectionForLearning(learning) { return 'Key Learnings'; }
    formatPatternForStandards(pattern) { return `**Pattern**: ${pattern.context}`; }
    formatLearningForStandards(learning) { return `**Learning**: ${learning.context}`; }
    generateRationale(gaps) { return `Consolidating ${gaps.length} discovered insights`; }
    trackKnowledgeEvolution(insights, gaps) { return { evolution: 'positive' }; }
}

module.exports = { KnowledgeSynthesisAgent };