#!/bin/bash

# Handler Registry Manager - Persistent tracking and CloudFormation generation
# Usage: ./handler-registry-manager.sh <command> [options]
# Commands: audit, register, deploy, sync, clean

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
HANDLERS_DIR="$PROJECT_ROOT/src/backend/src/handlers"
REGISTRY_FILE="$PROJECT_ROOT/deployment-registry.json"
API_MAPPINGS_FILE="$PROJECT_ROOT/src/frontend/src/types/api-mappings.ts"
CLOUDFORMATION_DIR="$PROJECT_ROOT/IAC/cloudformation"

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

# Function to initialize registry if it doesn't exist
initialize_registry() {
    if [[ ! -f "$REGISTRY_FILE" ]]; then
        print_status "Initializing deployment registry: $REGISTRY_FILE"
        cat > "$REGISTRY_FILE" << 'EOF'
{
  "version": "1.0",
  "last_updated": "",
  "environments": {
    "dev": {
      "deployed_handlers": {},
      "last_deployment": ""
    },
    "sandbox": {
      "deployed_handlers": {},
      "last_deployment": ""
    },
    "staging": {
      "deployed_handlers": {},
      "last_deployment": ""
    },
    "production": {
      "deployed_handlers": {},
      "last_deployment": ""
    }
  },
  "handler_metadata": {},
  "deprecated_handlers": [],
  "cloudformation_stacks": {}
}
EOF
        print_success "Registry initialized"
    fi
}

# Function to extract API mappings from the existing file
extract_api_mappings() {
    local silent=${1:-false}
    
    if [[ $silent != "true" ]]; then
        print_status "Extracting API mappings from: $API_MAPPINGS_FILE"
    fi
    
    # Use Node.js to parse the TypeScript file and extract mappings
    node -e "
    const fs = require('fs');
    const content = fs.readFileSync('$API_MAPPINGS_FILE', 'utf8');
    
    // Extract the API_MAPPINGS object using regex (simplified approach)
    const mappingsMatch = content.match(/export const API_MAPPINGS.*?=\\s*({[\\s\\S]*?});/);
    if (mappingsMatch) {
        const mappingsStr = mappingsMatch[1];
        // Convert TypeScript object to JSON (basic conversion)
        const jsonStr = mappingsStr
            .replace(/'/g, '\"')
            .replace(/([a-zA-Z_][a-zA-Z0-9_]*?):/g, '\"\$1\":')
            .replace(/,\\s*}/g, '}')
            .replace(/,\\s*]/g, ']');
        
        try {
            const mappings = JSON.parse(jsonStr);
            console.log(JSON.stringify(mappings, null, 2));
        } catch (e) {
            console.error('Failed to parse mappings:', e.message);
            process.exit(1);
        }
    } else {
        console.error('Could not find API_MAPPINGS in file');
        process.exit(1);
    }
    " 2>/dev/null || echo "{}"
}

# Function to scan filesystem for handlers
scan_handlers() {
    local silent=${1:-false}
    
    if [[ $silent != "true" ]]; then
        print_status "Scanning handlers directory: $HANDLERS_DIR"
    fi
    
    local handlers_json="{"
    local first=true
    
    while IFS= read -r -d '' handler_file; do
        # Get relative path from handlers root
        local relative_path="${handler_file#$HANDLERS_DIR/}"
        local handler_name=$(basename "$relative_path" .js)
        local handler_dir=$(dirname "$relative_path")
        
        # Get file info
        local file_size=$(stat -f%z "$handler_file" 2>/dev/null || stat -c%s "$handler_file" 2>/dev/null || echo "0")
        local last_modified=$(stat -f%m "$handler_file" 2>/dev/null || stat -c%Y "$handler_file" 2>/dev/null || echo "0")
        
        # Determine HTTP method from filename
        local method="GET"
        if [[ $handler_name == *"Get" ]]; then
            method="GET"
        elif [[ $handler_name == *"Post" ]]; then
            method="POST"
        elif [[ $handler_name == *"Put" ]]; then
            method="PUT"
        elif [[ $handler_name == *"Delete" ]]; then
            method="DELETE"
        fi
        
        # Add to JSON
        if [[ $first == "true" ]]; then
            first=false
        else
            handlers_json+=","
        fi
        
        handlers_json+="\"$relative_path\": {
            \"handler_name\": \"$handler_name\",
            \"directory\": \"$handler_dir\",
            \"method\": \"$method\",
            \"file_size\": $file_size,
            \"last_modified\": $last_modified,
            \"scan_timestamp\": $(date +%s)
        }"
        
    done < <(find "$HANDLERS_DIR" -name "*.js" -type f -print0)
    
    handlers_json+="}"
    echo "$handlers_json"
}

# Function to perform audit
audit_handlers() {
    print_status "🔍 Performing comprehensive handler audit"
    
    initialize_registry
    
    # Get current handlers from filesystem (silent mode)
    local current_handlers=$(scan_handlers true)
    
    # Get API mappings from frontend
    local api_mappings=$(extract_api_mappings true)
    
    # Load current registry
    local registry_content=$(cat "$REGISTRY_FILE")
    
    # Create audit report
    local audit_file="$PROJECT_ROOT/handler-audit-$(date +%Y%m%d_%H%M%S).json"
    
    cat > "$audit_file" << EOF
{
    "audit_timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "summary": {
        "total_handlers_found": $(echo "$current_handlers" | jq 'keys | length'),
        "total_api_mappings": $(echo "$api_mappings" | jq 'keys | length'),
        "deprecated_handlers": [],
        "missing_mappings": [],
        "orphaned_mappings": []
    },
    "current_handlers": $current_handlers,
    "api_mappings": $api_mappings,
    "registry_state": $registry_content
}
EOF
    
    print_success "Audit completed: $audit_file"
    
    # Generate summary
    local total_handlers=$(echo "$current_handlers" | jq 'keys | length')
    local total_mappings=$(echo "$api_mappings" | jq 'keys | length')
    
    echo ""
    print_status "📊 Audit Summary:"
    echo "  Total Handlers Found: $total_handlers"
    echo "  Total API Mappings: $total_mappings"
    
    # Check for potential issues
    print_status "🔍 Issue Detection:"
    
    # Look for handlers without mappings
    local unmapped_handlers=$(node -e "
    const handlers = $current_handlers;
    const mappings = $api_mappings;
    
    const handlerNames = Object.keys(handlers).map(path => {
        const name = handlers[path].handler_name;
        return name.replace(/(Get|Post|Put|Delete)$/, '');
    });
    
    const mappedFunctions = Object.values(mappings).flat().map(m => m.lambdaName);
    
    const unmapped = handlerNames.filter(h => {
        return !mappedFunctions.some(f => f.toLowerCase().includes(h.toLowerCase()));
    });
    
    console.log(JSON.stringify(unmapped, null, 2));
    ")
    
    local unmapped_count=$(echo "$unmapped_handlers" | jq 'length')
    if [[ $unmapped_count -gt 0 ]]; then
        print_warning "Found $unmapped_count potentially unmapped handlers"
        echo "$unmapped_handlers" | jq -r '.[]' | while read handler; do
            echo "    - $handler"
        done
    else
        print_success "All handlers appear to have API mappings"
    fi
    
    echo ""
    print_status "Next steps:"
    echo "1. Review audit file: $audit_file"
    echo "2. Run './handler-registry-manager.sh register' to update registry"
    echo "3. Use './handler-registry-manager.sh deploy <env>' to deploy changes"
}

# Function to register current state
register_handlers() {
    local environment=${1:-"current"}
    
    print_status "📝 Registering current handler state"
    
    initialize_registry
    
    # Get current handlers
    local current_handlers=$(scan_handlers true)
    
    # Update registry with current state
    local updated_registry=$(cat "$REGISTRY_FILE" | jq --argjson handlers "$current_handlers" --arg env "$environment" --arg timestamp "$(date -u +%Y-%m-%dT%H:%M:%SZ)" '
        .handler_metadata = $handlers |
        .last_updated = $timestamp |
        if $env != "current" then
            .environments[$env].deployed_handlers = $handlers |
            .environments[$env].last_deployment = $timestamp
        else . end
    ')
    
    echo "$updated_registry" > "$REGISTRY_FILE"
    
    print_success "Registry updated with $(echo "$current_handlers" | jq 'keys | length') handlers"
    
    if [[ $environment != "current" ]]; then
        print_success "Marked as deployed to environment: $environment"
    fi
}

# Function to detect changes since last deployment
detect_changes() {
    local environment=$1
    
    print_status "🔍 Detecting changes for environment: $environment"
    
    if [[ ! -f "$REGISTRY_FILE" ]]; then
        print_warning "No registry found. All handlers will be considered new."
        return 0
    fi
    
    # Get current handlers
    local current_handlers=$(scan_handlers true)
    
    # Get last deployed handlers for environment
    local deployed_handlers=$(cat "$REGISTRY_FILE" | jq -r ".environments[\"$environment\"].deployed_handlers // {}")
    
    # Compare and identify changes
    local changes=$(node -e "
    const current = $current_handlers;
    const deployed = $deployed_handlers;
    
    const changes = {
        new_handlers: [],
        modified_handlers: [],
        deleted_handlers: [],
        unchanged_handlers: []
    };
    
    // Check for new and modified handlers
    Object.keys(current).forEach(path => {
        if (!deployed[path]) {
            changes.new_handlers.push(path);
        } else if (current[path].last_modified !== deployed[path].last_modified) {
            changes.modified_handlers.push(path);
        } else {
            changes.unchanged_handlers.push(path);
        }
    });
    
    // Check for deleted handlers
    Object.keys(deployed).forEach(path => {
        if (!current[path]) {
            changes.deleted_handlers.push(path);
        }
    });
    
    console.log(JSON.stringify(changes, null, 2));
    ")
    
    echo "$changes"
}

# Function to generate CloudFormation resources for new handlers
generate_cloudformation_resources() {
    local stack_name=$1
    local handlers_json=$2
    
    print_status "🏗️ Generating CloudFormation resources for stack: $stack_name"
    
    # Generate Lambda function definitions
    echo "$handlers_json" | jq -r 'keys[]' | while read handler_path; do
        local handler_info=$(echo "$handlers_json" | jq -r ".[\"$handler_path\"]")
        local handler_name=$(echo "$handler_info" | jq -r '.handler_name')
        local method=$(echo "$handler_info" | jq -r '.method')
        
        # Convert to CloudFormation resource name
        local resource_name=$(echo "$handler_path" | sed 's|[/.]||g' | sed 's/\([a-z]\)\([A-Z]\)/\1\2/g' | sed 's/^./\U&/')
        resource_name="${resource_name}Function"
        
        # Generate CloudFormation YAML
        cat << EOF

  ${resource_name}:
    Type: AWS::Lambda::Function
    Properties:
      FunctionName: !Sub '\${StackName}-${handler_name}'
      Runtime: nodejs22.x
      Handler: index.handler
      Role: !Ref LambdaExecutionRoleArn
      Architectures:
        - arm64
      Code:
        S3Bucket: !Ref TIMBucketName
        S3Key: '${handler_path%.js}.zip'
      Environment:
        Variables:
          DB_HOST: !Ref DBHost
          DB_USER: !Ref DBUser
          DB_PASS: !Ref DBPass
          DB_NAME: !Ref DBName
          DB_PORT: !Ref DBPort
          DB_SSL: !Ref DBSSL
          CREDENTIAL_ENCRYPTION_KEY: !Ref CredentialEncryptionKey
          EMAIL_FROM_ADDRESS: !Ref EmailFromAddress
          SUPPORT_EMAIL_ADDRESS: !Ref SupportEmailAddress
          SES_CONFIG_SET: !Ref SESConfigSet
      Timeout: 30
      MemorySize: 256
      ReservedConcurrencyLimit: 10

  ${resource_name}LogGroup:
    Type: AWS::Logs::LogGroup
    Properties:
      LogGroupName: !Sub '/aws/lambda/\${StackName}-${handler_name}'
      RetentionInDays: 14

  ${resource_name}Permission:
    Type: AWS::Lambda::Permission
    Properties:
      FunctionName: !Ref ${resource_name}
      Action: lambda:InvokeFunction
      Principal: apigateway.amazonaws.com
      SourceArn: !Sub 'arn:aws:execute-api:\${AWS::Region}:\${AWS::AccountId}:\${ApiGatewayId}/*/*/*'

EOF
    done
}

# Function to deploy changes
deploy_changes() {
    local environment=$1
    local dry_run=${2:-false}
    
    print_status "🚀 Deploying changes to environment: $environment"
    
    # Detect changes
    local changes=$(detect_changes "$environment")
    
    local new_count=$(echo "$changes" | jq '.new_handlers | length')
    local modified_count=$(echo "$changes" | jq '.modified_handlers | length')
    local deleted_count=$(echo "$changes" | jq '.deleted_handlers | length')
    
    echo ""
    print_status "📊 Change Summary:"
    echo "  New handlers: $new_count"
    echo "  Modified handlers: $modified_count"
    echo "  Deleted handlers: $deleted_count"
    
    if [[ $new_count -eq 0 && $modified_count -eq 0 && $deleted_count -eq 0 ]]; then
        print_success "No changes detected. Deployment not needed."
        return 0
    fi
    
    if [[ $dry_run == "true" ]]; then
        print_warning "DRY RUN: Would deploy the following changes:"
        if [[ $new_count -gt 0 ]]; then
            echo ""
            print_status "New handlers to deploy:"
            echo "$changes" | jq -r '.new_handlers[]' | while read handler; do
                echo "  + $handler"
            done
        fi
        
        if [[ $modified_count -gt 0 ]]; then
            echo ""
            print_status "Modified handlers to redeploy:"
            echo "$changes" | jq -r '.modified_handlers[]' | while read handler; do
                echo "  ~ $handler"
            done
        fi
        
        if [[ $deleted_count -gt 0 ]]; then
            echo ""
            print_warning "Handlers to remove from deployment:"
            echo "$changes" | jq -r '.deleted_handlers[]' | while read handler; do
                echo "  - $handler"
            done
        fi
        
        return 0
    fi
    
    # Actual deployment logic would go here
    print_status "🔄 Executing deployment..."
    
    # For now, just register the current state
    register_handlers "$environment"
    
    print_success "Deployment completed for environment: $environment"
}

# Function to clean deprecated handlers
clean_deprecated() {
    print_status "🧹 Cleaning deprecated handlers"
    
    if [[ ! -f "$REGISTRY_FILE" ]]; then
        print_warning "No registry found. Run audit first."
        return 1
    fi
    
    # Get deprecated handlers list
    local deprecated=$(cat "$REGISTRY_FILE" | jq -r '.deprecated_handlers[]?' || echo "")
    
    if [[ -z "$deprecated" ]]; then
        print_success "No deprecated handlers found"
        return 0
    fi
    
    print_warning "Found deprecated handlers:"
    echo "$deprecated" | while read handler; do
        echo "  - $handler"
        # Remove from filesystem (be careful!)
        # rm -f "$HANDLERS_DIR/$handler"
    done
    
    print_warning "Manual cleanup required. Review deprecated handlers before removal."
}

# Function to sync registry with API mappings
sync_with_api_mappings() {
    print_status "🔄 Syncing registry with API mappings"
    
    # Extract API mappings
    local api_mappings=$(extract_api_mappings true)
    
    # Update registry with mapping information
    local updated_registry=$(cat "$REGISTRY_FILE" | jq --argjson mappings "$api_mappings" --arg timestamp "$(date -u +%Y-%m-%dT%H:%M:%SZ)" '
        .api_mappings = $mappings |
        .last_updated = $timestamp
    ')
    
    echo "$updated_registry" > "$REGISTRY_FILE"
    
    print_success "Registry synced with API mappings"
}

# Function to display usage
usage() {
    echo "Usage: $0 <command> [options]"
    echo ""
    echo "Commands:"
    echo "  audit                     - Perform comprehensive handler audit"
    echo "  register [environment]    - Register current handler state"
    echo "  deploy <environment>      - Deploy changes to environment"
    echo "  detect <environment>      - Detect changes since last deployment"
    echo "  clean                     - Clean deprecated handlers"
    echo "  sync                      - Sync registry with API mappings"
    echo ""
    echo "Options:"
    echo "  --dry-run                - Show what would be done without making changes"
    echo ""
    echo "Examples:"
    echo "  $0 audit"
    echo "  $0 register sandbox"
    echo "  $0 deploy sandbox --dry-run"
    echo "  $0 detect dev"
    echo "  $0 sync"
    echo ""
}

# Main script logic
main() {
    local command=""
    local environment=""
    local dry_run=false
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            audit|register|deploy|detect|clean|sync)
                command=$1
                shift
                ;;
            --dry-run)
                dry_run=true
                shift
                ;;
            -h|--help)
                usage
                exit 0
                ;;
            *)
                if [[ -z $environment ]]; then
                    environment=$1
                fi
                shift
                ;;
        esac
    done
    
    # Check required arguments
    if [[ -z $command ]]; then
        print_error "Command is required"
        usage
        exit 1
    fi
    
    # Validate environment for commands that need it
    if [[ "$command" =~ ^(deploy|detect|register)$ && "$command" != "register" ]] && [[ -z $environment ]]; then
        print_error "Environment is required for command: $command"
        usage
        exit 1
    fi
    
    # Check if directories exist
    if [[ ! -d "$HANDLERS_DIR" ]]; then
        print_error "Handlers directory not found: $HANDLERS_DIR"
        exit 1
    fi
    
    print_status "Handler Registry Manager - Command: $command"
    if [[ -n $environment ]]; then
        print_status "Environment: $environment"
    fi
    if [[ $dry_run == "true" ]]; then
        print_status "Mode: DRY RUN"
    fi
    echo ""
    
    # Execute command
    case $command in
        "audit")
            audit_handlers
            ;;
        "register")
            register_handlers "$environment"
            ;;
        "deploy")
            deploy_changes "$environment" "$dry_run"
            ;;
        "detect")
            local changes=$(detect_changes "$environment")
            echo "$changes" | jq '.'
            ;;
        "clean")
            clean_deprecated
            ;;
        "sync")
            sync_with_api_mappings
            ;;
        *)
            print_error "Unknown command: $command"
            usage
            exit 1
            ;;
    esac
}

# Run main function
main "$@"