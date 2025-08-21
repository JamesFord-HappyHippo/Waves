#!/bin/bash

# Waves Sister Project Agent System Upgrade Script
# Automated installation and setup for enhanced agent patterns

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
TIM_COMBO_PATH="/Users/jamesford/Source/Tim-Combo"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to detect project type
detect_project_type() {
    local project_path=$1
    
    if [[ -f "$project_path/package.json" ]]; then
        # Check for React Native/Expo
        if grep -q "react-native\|expo" "$project_path/package.json" 2>/dev/null; then
            echo "react-native"
        # Check for pure React
        elif grep -q "\"react\":" "$project_path/package.json" 2>/dev/null; then
            echo "react"
        # Check for Node.js backend
        elif grep -q "fastify\|express\|serverless" "$project_path/package.json" 2>/dev/null; then
            echo "nodejs"
        else
            echo "javascript"
        fi
    elif [[ -f "$project_path/pubspec.yaml" ]]; then
        echo "flutter"
    elif [[ -f "$project_path/Cargo.toml" ]]; then
        echo "rust"
    elif [[ -f "$project_path/go.mod" ]]; then
        echo "go"
    else
        echo "unknown"
    fi
}

# Function to detect domain
detect_domain() {
    local project_path=$1
    local project_name=$(basename "$project_path")
    
    case "$project_name" in
        *"waves"*|*"marine"*|*"navigation"*)
            echo "marine-navigation"
            ;;
        *"honeydо"*|*"honey"*|*"task"*)
            echo "task-management"
            ;;
        *"seawater"*|*"climate"*|*"risk"*)
            echo "climate-risk"
            ;;
        *)
            echo "general"
            ;;
    esac
}

# Main upgrade function
upgrade_project() {
    local target_path=${1:-$SCRIPT_DIR}
    
    print_status "Starting Sister Project Agent System Upgrade"
    print_status "Target: $target_path"
    
    # Validate paths
    if [[ ! -d "$TIM_COMBO_PATH" ]]; then
        print_error "Tim-Combo not found at $TIM_COMBO_PATH"
        print_error "Please update TIM_COMBO_PATH in the script"
        exit 1
    fi
    
    if [[ ! -d "$target_path" ]]; then
        print_error "Target path does not exist: $target_path"
        exit 1
    fi
    
    cd "$target_path"
    
    # Detect project characteristics
    local project_type=$(detect_project_type "$target_path")
    local domain=$(detect_domain "$target_path")
    
    print_status "Detected project type: $project_type"
    print_status "Detected domain: $domain"
    
    # Step 1: Create directory structure
    print_status "Creating agent directory structure..."
    mkdir -p src/agents/specialists
    mkdir -p src/agents/templates
    mkdir -p .project-rules
    mkdir -p scripts
    
    # Step 2: Copy enhanced Agent Factory and core agents
    print_status "Copying enhanced agent system..."
    
    # Copy all 11 agents from Tim-Combo
    if [[ -d "$TIM_COMBO_PATH/src/agents/specialists" ]]; then
        cp -r "$TIM_COMBO_PATH/src/agents/specialists/"*.js src/agents/specialists/ 2>/dev/null || true
    fi
    
    # Copy agent templates
    if [[ -d "$TIM_COMBO_PATH/src/agents/templates" ]]; then
        cp -r "$TIM_COMBO_PATH/src/agents/templates/"*.js src/agents/templates/ 2>/dev/null || true
    fi
    
    # Step 3: Copy enhanced standards framework
    print_status "Installing enhanced standards framework..."
    
    if [[ -d "$TIM_COMBO_PATH/.clinerules" ]]; then
        cp "$TIM_COMBO_PATH/.clinerules/agent_"*.md .project-rules/ 2>/dev/null || true
        cp "$TIM_COMBO_PATH/.clinerules/domain_"*.md .project-rules/ 2>/dev/null || true
    fi
    
    # Step 4: Create domain-specific configuration
    print_status "Configuring domain-specific settings for $domain..."
    
    cat > src/agents/config.json << EOF
{
  "domain": "$domain",
  "projectType": "$project_type",
  "agents": {
    "SecurityReviewerAgent": {
      "enabled": true,
      "domainSpecific": true
    },
    "TestAgent": {
      "enabled": true,
      "uiRemapping": true
    },
    "PatternHarvestingAgent": {
      "enabled": true
    },
    "KnowledgeSynthesisAgent": {
      "enabled": true
    },
    "DeploymentAgent": {
      "enabled": true
    },
    "AuditorAgent": {
      "enabled": true
    }
  },
  "workflows": [
    "validation-workflow",
    "testing-workflow", 
    "deployment-workflow",
    "monitoring-workflow"
  ]
}
EOF
    
    # Step 5: Create NPM scripts
    print_status "Setting up NPM scripts..."
    
    # Check if package.json exists
    if [[ -f "package.json" ]]; then
        # Create backup
        cp package.json package.json.backup
        
        # Add agent scripts using node
        node -e "
        const fs = require('fs');
        const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
        
        if (!pkg.scripts) pkg.scripts = {};
        
        // Add agent management scripts
        pkg.scripts['agents:list'] = 'node scripts/list-agents.js';
        pkg.scripts['agents:run'] = 'node scripts/run-agent.js';
        pkg.scripts['agents:test'] = 'node scripts/test-agents.js';
        pkg.scripts['agents:validate'] = 'node scripts/validate-agents.js';
        pkg.scripts['agents:upgrade'] = './upgrade-script.sh';
        
        fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
        "
        
        print_success "NPM scripts added to package.json"
    else
        print_warning "No package.json found - scripts will need to be added manually"
    fi
    
    # Step 6: Create utility scripts
    print_status "Creating utility scripts..."
    
    # List agents script
    cat > scripts/list-agents.js << 'EOF'
#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🤖 Available Agents:');
console.log('==================');

const agentsDir = path.join(__dirname, '..', 'src', 'agents', 'specialists');
if (fs.existsSync(agentsDir)) {
    const agents = fs.readdirSync(agentsDir)
        .filter(file => file.endsWith('.js'))
        .map(file => file.replace('.js', ''));
    
    agents.forEach((agent, index) => {
        console.log(`${index + 1}. ${agent}`);
    });
    
    console.log(`\nTotal: ${agents.length} agents available`);
} else {
    console.log('No agents directory found. Run upgrade script first.');
}
EOF
    
    # Run agent script
    cat > scripts/run-agent.js << 'EOF'
#!/usr/bin/env node

const path = require('path');

const agentName = process.argv[2];
const operation = process.argv[3] || 'executeOperation';

if (!agentName) {
    console.log('Usage: npm run agents:run <AgentName> [operation]');
    console.log('Example: npm run agents:run SecurityReviewerAgent performSecurityReview');
    process.exit(1);
}

try {
    const AgentClass = require(`../src/agents/specialists/${agentName}`);
    const agent = new AgentClass();
    
    console.log(`🚀 Running ${agentName}.${operation}()`);
    
    if (typeof agent[operation] === 'function') {
        agent[operation]({ projectRoot: process.cwd() })
            .then(result => {
                console.log('✅ Agent execution completed');
                console.log(JSON.stringify(result, null, 2));
            })
            .catch(error => {
                console.error('❌ Agent execution failed:', error.message);
                process.exit(1);
            });
    } else {
        console.error(`❌ Operation '${operation}' not found in ${agentName}`);
        process.exit(1);
    }
} catch (error) {
    console.error(`❌ Failed to load agent '${agentName}':`, error.message);
    process.exit(1);
}
EOF
    
    # Test agents script
    cat > scripts/test-agents.js << 'EOF'
#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🧪 Testing Agent System...');

const agentsDir = path.join(__dirname, '..', 'src', 'agents', 'specialists');
const configPath = path.join(__dirname, '..', 'src', 'agents', 'config.json');

// Test 1: Check agents directory
if (!fs.existsSync(agentsDir)) {
    console.log('❌ Agents directory not found');
    process.exit(1);
}

// Test 2: Check configuration
if (!fs.existsSync(configPath)) {
    console.log('❌ Agent configuration not found');
    process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
console.log(`✅ Domain: ${config.domain}`);
console.log(`✅ Project Type: ${config.projectType}`);

// Test 3: Load each agent
const agents = fs.readdirSync(agentsDir).filter(file => file.endsWith('.js'));
let successCount = 0;

agents.forEach(agentFile => {
    try {
        const AgentClass = require(path.join(agentsDir, agentFile));
        const agent = new AgentClass();
        console.log(`✅ ${agentFile} loaded successfully`);
        successCount++;
    } catch (error) {
        console.log(`❌ ${agentFile} failed to load: ${error.message}`);
    }
});

console.log(`\n📊 Agent System Status: ${successCount}/${agents.length} agents operational`);

if (successCount === agents.length) {
    console.log('🎉 All agents loaded successfully!');
    process.exit(0);
} else {
    console.log('⚠️  Some agents failed to load');
    process.exit(1);
}
EOF
    
    # Make scripts executable
    chmod +x scripts/*.js
    
    # Step 7: Install dependencies if package.json exists
    if [[ -f "package.json" ]] && command -v npm &> /dev/null; then
        print_status "Installing dependencies..."
        npm install --silent
    fi
    
    # Step 8: Validate installation
    print_status "Validating installation..."
    
    local validation_passed=true
    
    # Check critical files
    if [[ ! -d "src/agents/specialists" ]]; then
        print_error "Agents directory not created"
        validation_passed=false
    fi
    
    if [[ ! -f "src/agents/config.json" ]]; then
        print_error "Agent configuration not created"
        validation_passed=false
    fi
    
    # Count agents
    local agent_count=$(find src/agents/specialists -name "*.js" 2>/dev/null | wc -l)
    if [[ $agent_count -lt 5 ]]; then
        print_warning "Only $agent_count agents installed (expected 11+)"
    else
        print_success "$agent_count agents installed"
    fi
    
    if [[ "$validation_passed" == true ]]; then
        print_success "Installation validation passed!"
        
        # Final instructions
        echo
        echo "🎉 Sister Project Agent System Upgrade Complete!"
        echo "================================================"
        echo
        echo "✅ Installed: $agent_count agents"
        echo "✅ Domain: $domain"
        echo "✅ Project Type: $project_type"
        echo "✅ Enhanced standards framework active"
        echo
        echo "📋 Next Steps:"
        echo "1. Test the installation:"
        echo "   npm run agents:list"
        echo
        echo "2. Run a basic test:"
        echo "   npm run agents:test"
        echo
        echo "3. Try running an agent:"
        echo "   npm run agents:run SecurityReviewerAgent"
        echo
        echo "4. Review the upgrade guide:"
        echo "   cat SISTER_PROJECT_UPGRADE_GUIDE.md"
        echo
        return 0
    else
        print_error "Installation validation failed"
        return 1
    fi
}

# Script entry point
main() {
    if [[ $# -eq 0 ]]; then
        # No arguments - upgrade current directory
        upgrade_project "$SCRIPT_DIR"
    elif [[ $# -eq 1 ]]; then
        # One argument - upgrade specified path
        upgrade_project "$1"
    else
        echo "Usage: $0 [project_path]"
        echo "Example: $0 /path/to/project"
        echo "If no path provided, upgrades current directory"
        exit 1
    fi
}

# Run main function
main "$@"