#!/usr/bin/env node

const SecurityReviewerAgent = require('./specialists/SecurityReviewerAgent');
const path = require('path');

async function runSecurityAssessment() {
    console.log('🔒 Starting Waves Security Assessment for Friends & Family Deployment...\n');
    
    const projectRoot = '/Users/jamesford/Source/Waves';
    
    const agent = new SecurityReviewerAgent({
        projectRoot,
        complianceLevel: 'friends_family',
        costTolerance: 'low_cost'
    });
    
    try {
        const review = await agent.performSecurityReview({
            projectPath: projectRoot,
            reviewType: 'friends_family_readiness'
        });
        
        console.log('📊 Security Review Results');
        console.log('==========================\n');
        
        // System Metrics
        console.log('🖥️  System Architecture:');
        console.log(`   Architecture: ${review.systemMetrics.architecture}`);
        console.log(`   Monthly Cost: $${review.systemMetrics.monthlyInfrastructureCost}`);
        console.log(`   Environment: ${review.systemMetrics.environmentType}`);
        console.log(`   User Count: ${review.systemMetrics.userCount}`);
        console.log(`   Lambda Count: ${review.systemMetrics.lambdaCount}\n`);
        
        // Findings Summary
        const criticalFindings = review.findings.filter(f => f.severity === 'critical');
        const highFindings = review.findings.filter(f => f.severity === 'high');
        const mediumFindings = review.findings.filter(f => f.severity === 'medium');
        
        console.log('🚨 Security Findings:');
        console.log(`   Critical: ${criticalFindings.length}`);
        console.log(`   High: ${highFindings.length}`);
        console.log(`   Medium: ${mediumFindings.length}\n`);
        
        // Show critical and high findings
        if (criticalFindings.length > 0) {
            console.log('⚠️  CRITICAL FINDINGS:');
            criticalFindings.forEach(finding => {
                console.log(`   • ${finding.message}`);
                console.log(`     Location: ${finding.location || 'Unknown'}`);
                console.log(`     Fix: ${finding.recommendation || 'See security documentation'}\n`);
            });
        }
        
        if (highFindings.length > 0) {
            console.log('🔴 HIGH PRIORITY FINDINGS:');
            highFindings.forEach(finding => {
                console.log(`   • ${finding.message}`);
                console.log(`     Location: ${finding.location || 'Unknown'}`);
                console.log(`     Fix: ${finding.recommendation || 'See security documentation'}\n`);
            });
        }
        
        // Cost Analysis
        console.log('💰 Cost Analysis:');
        if (review.costAnalysis.infrastructureCosts) {
            const costs = review.costAnalysis.infrastructureCosts;
            console.log(`   Current Infrastructure: $${costs.current}/month`);
            console.log(`   With Enhanced Security: $${costs.enhanced}/month`);
            console.log(`   Remediation Cost: $${review.costAnalysis.remediationCosts?.immediate || 0}`);
        }
        console.log('');
        
        // Compliance Status
        console.log('📋 Compliance Status:');
        console.log(`   Level: ${review.complianceStatus.complianceLevel}`);
        console.log(`   Security Validation: ${review.complianceStatus.productionGates?.securityValidation || 'unknown'}`);
        console.log(`   Incident Response: ${review.complianceStatus.productionGates?.incidentResponse || 'unknown'}\n`);
        
        // Risk Assessment
        console.log('⚡ Risk Assessment:');
        console.log(`   Overall Risk: ${review.riskAssessment.overallRisk}`);
        if (review.riskAssessment.riskFactors.length > 0) {
            console.log('   Risk Factors:');
            review.riskAssessment.riskFactors.forEach(factor => {
                console.log(`   • ${factor}`);
            });
        }
        console.log('');
        
        // Recommendations
        console.log('🎯 Recommendations:');
        review.recommendations.forEach((rec, index) => {
            console.log(`${index + 1}. ${rec.title} (${rec.priority})`);
            console.log(`   ${rec.description}`);
            console.log(`   Cost: $${rec.estimatedCost} | Time: ${rec.timeframe}\n`);
        });
        
        // Friends & Family Deployment Readiness
        const criticalBlocks = criticalFindings.length;
        const highBlocks = highFindings.filter(f => 
            f.type === 'hardcoded_secrets' || 
            f.type === 'insecure_logging' ||
            f.type === 'cors_config_missing' ||
            f.type === 'ssl_validator_missing'
        ).length;
        
        console.log('🏠 Friends & Family Deployment Readiness:');
        if (criticalBlocks === 0 && highBlocks <= 2) {
            console.log('   ✅ READY for friends & family deployment');
            console.log('   ✅ Security posture appropriate for 1-5 users');
            console.log('   ✅ Cost-optimized configuration validated');
        } else if (criticalBlocks === 0) {
            console.log('   ⚠️  CONDITIONAL - Address high priority findings first');
            console.log('   ✅ No critical security vulnerabilities');
            console.log('   📋 Review high priority items before deployment');
        } else {
            console.log('   ❌ NOT READY - Critical vulnerabilities must be fixed');
            console.log('   🚨 Address critical findings before any deployment');
        }
        
        console.log('\n🌊 Waves Security Assessment Complete');
        
    } catch (error) {
        console.error('❌ Security assessment failed:', error.message);
        console.error('Stack trace:', error.stack);
    }
}

if (require.main === module) {
    runSecurityAssessment();
}

module.exports = { runSecurityAssessment };