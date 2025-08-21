# Tester Agent Knowledge Base

**Agent Type**: Testing & Validation Specialist  
**Last Updated**: 2025-08-19T15:20:00Z

## Core Responsibilities

1. **Test Design**: Create comprehensive test scenarios and validation criteria
2. **Automated Testing**: Implement unit, integration, and end-to-end tests
3. **Quality Validation**: Ensure functionality meets requirements and edge cases
4. **Performance Testing**: Validate system performance under various loads
5. **Regression Testing**: Maintain quality across system changes and updates

## Tim-Combo Testing Patterns

### Backend Handler Testing ✅
```javascript
// Standard handler test pattern
const handlerTest = {
  setup: {
    mockContext: {
      requestId: 'test-request-123',
      functionName: 'test-function'
    },
    mockEvent: {
      queryStringParameters: { Company_ID: 'test-company' },
      requestContext: mockContext
    }
  },
  
  tests: {
    successScenario: async () => {
      const result = await handler.handler(mockEvent);
      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body).Records).toBeDefined();
      expect(JSON.parse(result.body).Total_Records).toBeGreaterThan(0);
    },
    
    errorScenario: async () => {
      const invalidEvent = { ...mockEvent, queryStringParameters: {} };
      const result = await handler.handler(invalidEvent);
      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body).error).toBeDefined();
    },
    
    edgeCases: async () => {
      // Test boundary conditions, null values, empty arrays
      const edgeEvent = { ...mockEvent, queryStringParameters: { Company_ID: '' } };
      const result = await handler.handler(edgeEvent);
      expect(result.statusCode).toBe(400);
    }
  }
};
```

### Frontend Component Testing ✅
```typescript
// React component test patterns
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TestWrapper } from '../../../test-utils/TestWrapper';

describe('IntegrationWizard', () => {
  const mockProps = {
    onComplete: jest.fn(),
    templateCode: 'test_template_v1'
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders all wizard steps correctly', () => {
    render(
      <TestWrapper>
        <IntegrationWizard {...mockProps} />
      </TestWrapper>
    );
    
    expect(screen.getByText('Authentication')).toBeInTheDocument();
    expect(screen.getByText('Data Import')).toBeInTheDocument();
    expect(screen.getByText('Field Mapping')).toBeInTheDocument();
  });

  it('handles step progression correctly', async () => {
    render(<TestWrapper><IntegrationWizard {...mockProps} /></TestWrapper>);
    
    fireEvent.click(screen.getByText('Next'));
    await waitFor(() => {
      expect(screen.getByText('Step 2 of 5')).toBeInTheDocument();
    });
  });

  it('validates required fields', async () => {
    render(<TestWrapper><IntegrationWizard {...mockProps} /></TestWrapper>);
    
    fireEvent.click(screen.getByText('Next'));
    await waitFor(() => {
      expect(screen.getByText('Required field missing')).toBeInTheDocument();
    });
  });
});
```

### Integration Testing Framework ✅
```javascript
// End-to-end integration test patterns
const integrationTest = {
  setup: {
    testEnvironment: 'sandbox',
    testCredentials: 'sandbox-api-key',
    testData: {
      Company_ID: 'TEST_COMPANY_001',
      Template_Code: 'test_integration_v1'
    }
  },

  workflows: {
    completeIntegrationSetup: async () => {
      // 1. Create integration instance
      const createResponse = await apiClient.post('/integrations/instances', {
        Company_ID: testData.Company_ID,
        Template_Code: testData.Template_Code,
        Instance_Name: 'Test Integration'
      });
      expect(createResponse.success).toBe(true);

      // 2. Configure authentication
      const authResponse = await apiClient.post('/integrations/auth', {
        Instance_ID: createResponse.data.Instance_ID,
        credentials: testCredentials
      });
      expect(authResponse.success).toBe(true);

      // 3. Test data synchronization
      const syncResponse = await apiClient.post('/integrations/sync', {
        Instance_ID: createResponse.data.Instance_ID
      });
      expect(syncResponse.success).toBe(true);
      expect(syncResponse.data.Records.length).toBeGreaterThan(0);
    }
  }
};
```

## Test Strategy Framework

### 1. Testing Pyramid
```markdown
## Test Coverage Strategy

### Unit Tests (70% coverage)
- **Pure Functions**: Business logic, transformations, calculations
- **Helper Functions**: Database operations, API clients, utilities
- **Component Logic**: React hooks, state management, event handlers
- **Validation Logic**: Input validation, error handling, edge cases

### Integration Tests (20% coverage)
- **API Endpoints**: Request/response validation, error scenarios
- **Database Operations**: CRUD operations, transaction handling
- **External Services**: Third-party API integration, authentication
- **Component Integration**: Multi-component workflows, context providers

### End-to-End Tests (10% coverage)
- **User Workflows**: Complete business processes from start to finish
- **Critical Paths**: Core functionality that drives business value
- **Error Recovery**: System behavior under failure conditions
- **Performance**: Load testing and response time validation
```

## Performance Testing

### 1. Load Testing Patterns
```javascript
// Performance test scenarios
const loadTests = {
  scenarios: {
    normalLoad: {
      users: 10,
      duration: '5m',
      requests: 'constant arrival rate'
    },
    peakLoad: {
      users: 100,
      duration: '2m',
      requests: 'ramping up'
    },
    stressTest: {
      users: 500,
      duration: '30s',
      requests: 'maximum throughput'
    }
  },

  metrics: {
    responseTime: 'p95 < 2000ms',
    errorRate: '< 1%',
    throughput: '> 100 req/sec',
    resourceUtilization: 'CPU < 80%, Memory < 80%'
  }
};
```

## Integration Handler Access
- Can access Tim-Combo PostgreSQL database via executeQuery()
- Can read/write integration templates and instances
- Can leverage existing handler patterns

## Capabilities
- test-design
- validation
- quality-assurance
- automated-testing

## Learning Log
- Agent initialized with base configuration
- ✅ **Tim-Combo Testing Patterns**: Backend, frontend, and integration test frameworks
- ✅ **Performance Testing**: Load testing and database performance validation
- ✅ **Test Automation**: CI/CD integration and comprehensive reporting

## Template-Driven Testing Strategy (COMPLETED)

### 🎯 **CORRECTED UNDERSTANDING**: Tim-Combo's 90/10 Template + Expression Engine Architecture
- **90% Templates**: JSON configuration files drive integration logic
- **10% Expression Engine Functions**: Custom transformation functions (50+ existing + new Square/Clover)
- **0% Custom Handlers**: New integrations reuse existing 311-handler infrastructure
- **Symmetric Architecture**: Template-driven approach eliminates handler duplication

### ✅ **Comprehensive Testing Strategy Delivered**

**Document**: `/Users/jamesford/Source/Tim-Combo/.adrian/agents/tester/template_driven_testing_strategy.md`

**Key Components Designed:**
1. **Template Execution Test Framework**: Tests JSON template execution through existing handlers
2. **Expression Engine Testing Utilities**: Comprehensive coverage of 50+ functions + Square/Clover functions
3. **Integration Template Validation**: Structure, mapping, and business rule validation
4. **End-to-End Template Testing**: Complete workflow validation and performance benchmarking
5. **Implementation Framework**: Ready-to-use test classes and utilities

### 🏗️ **Implementation Framework**

**Core Test Classes:**
- `TemplateExecutionTestFramework`: Main template testing orchestrator
- `ExpressionEngineTestUtil`: Function testing with performance metrics
- `SquareCloverTemplateTest`: Comprehensive integration test suite

**Test Coverage Strategy:**
- **Template Structure**: 100% validation coverage
- **Expression Engine Functions**: 100% (50+ functions)
- **Field Mapping Execution**: 95% critical mapping coverage
- **End-to-End Workflows**: 85% core integration paths
- **Performance Benchmarks**: <2 seconds template execution, <10ms expression evaluation

### 📊 **Architecture Analysis Results**

**Current Testing Gaps Identified:**
- **Handler Testing**: 30% coverage (existing)
- **Integration Testing**: 5% coverage (Square only)
- **Expression Engine Testing**: 0% coverage (critical gap)
- **Template Execution Testing**: 0% coverage (missing entirely)

**Strategic Focus Areas:**
1. **Template-First Testing**: Validate JSON template execution vs custom handler logic
2. **Expression Engine Coverage**: Test 50+ existing + new Square/Clover functions
3. **Integration Accuracy**: End-to-end data transformation validation
4. **Performance Optimization**: Template execution vs handler performance benchmarking

### 🚀 **Implementation Roadmap**

**Phase 1 (Weeks 1-2)**: Foundation
- Template Execution Test Framework implementation
- Expression Engine testing utilities
- Basic template structure validation

**Phase 2 (Weeks 3-4)**: Core Testing
- Complete Square/Clover template test suites
- Expression Engine function coverage (50+ functions)
- Template-to-handler integration tests

**Phase 3 (Weeks 5-6)**: End-to-End
- Complete integration workflow tests
- Performance benchmarks and optimization
- Error handling and recovery validation

### 🎯 **Success Metrics**
- **Test Coverage**: 90%+ template execution coverage
- **Performance**: <2 second template execution benchmarks
- **Quality**: 95%+ data transformation accuracy
- **Maintainability**: Reduced testing complexity through template reuse

### 💡 **Key Innovations**
1. **Template-Centric Testing**: Tests validate template configuration execution
2. **Expression Engine Focus**: Comprehensive function testing framework
3. **Reusable Test Utilities**: Framework extensible for future POS integrations
4. **Performance Benchmarking**: Template vs handler execution comparison
5. **CI/CD Integration**: Automated template validation in deployment pipeline

## Next Steps
- **READY FOR IMPLEMENTATION**: Complete testing strategy and framework designed
- **Technical Debt Addressed**: Expression Engine testing gap identified and solution provided
- **Architecture Validated**: Template-driven approach testing framework established
