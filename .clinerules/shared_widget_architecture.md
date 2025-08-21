# Shared Widget Architecture Standards

## Overview

The HappyHippo platform uses a **"Mothership Widget Architecture"** where core admin dashboard widgets serve as the foundational UI palette for all specialized admin interfaces. This architecture enables CI (Callisto Integration) and TB (TimeBridge) admin dashboards to reuse core HappyHippo widgets while maintaining domain-specific functionality.

## Core Architecture Principles

### 1. Widget Foundation Strategy

**Core "Mothership" Dashboard**: `/src/frontend/src/features/admin/pages/AdminDashboard.tsx`
- Establishes the foundational widget palette and design patterns
- Sets theme, color schemes, and interaction patterns for all admin interfaces
- Provides the base widget library that other admin interfaces extend

**Shared Widget Library**: `/src/frontend/src/features/admin/components/`
- **ActionMetricsWidget** - Workflow action metrics with approval group breakdown
- **CompanyStatsWidget** - Company-level analytics (employees, attrition, risk distribution)
- **HeadcountWidget** - Advanced employee headcount analytics with risk overlay

### 2. Context-Based Specialization

Instead of duplicating widgets, specialized admin interfaces use **context providers** to adapt shared widgets to their domain:

```typescript
// Core widget with domain-agnostic structure
export const ActionMetricsWidget: React.FC<ActionMetricsProps> = ({ context }) => {
  // Uses context to determine data source and display logic
  const data = useContext(context); // Could be IntegrationDataContext or TimeBridgeDataContext
  
  return (
    <Card>
      <CardHeader>Action Metrics</CardHeader>
      <CardContent>
        {/* Renders domain-specific metrics based on context */}
      </CardContent>
    </Card>
  );
};
```

### 3. Progressive Enhancement Pattern

**Base Implementation**: Core widget functionality in HappyHippo widgets
**Domain Enhancement**: CI/TB specific features added through composition

```typescript
// CI Admin enhances core widget with integration-specific features
export const CIAdminDashboard: React.FC = () => {
  return (
    <IntegrationDataProvider>
      {/* Core shared widgets with integration context */}
      <ActionMetricsWidget />
      <CompanyStatsWidget />
      
      {/* CI-specific widgets */}
      <IntegrationWorkflowWidget />
      <IntegrationEmployeeWidget />
    </IntegrationDataProvider>
  );
};
```

## Implementation Standards

### 1. Shared Component Requirements

**Widget Structure**:
```typescript
interface BaseWidgetProps {
  title?: string;
  variant?: 'default' | 'compact' | 'detailed';
  contextProvider?: 'integration' | 'timebridge' | 'core';
  onAction?: (action: string, data: any) => void;
}

export const BaseWidget: React.FC<BaseWidgetProps> = ({
  title,
  variant = 'default',
  contextProvider = 'core',
  onAction
}) => {
  // Widget implementation that adapts based on context
};
```

**Context Integration**:
```typescript
// Widget adapts data source based on available context
export const AdaptiveWidget: React.FC = () => {
  const integrationData = useContext(IntegrationDataContext);
  const timebridgeData = useContext(TimeBridgeDataContext);
  const coreData = useContext(CompanyContext);
  
  // Use appropriate data source based on context availability
  const data = integrationData || timebridgeData || coreData;
  
  return <WidgetContent data={data} />;
};
```

### 2. Role-Based Widget Visibility

**Entitlement-Based Rendering**:
```typescript
export const AdminDashboard: React.FC = () => {
  const { entitlements } = useStatus();
  
  return (
    <DashboardLayout>
      {/* Core widgets visible to all admins */}
      <CompanyStatsWidget />
      
      {/* CI-specific widgets */}
      {entitlements.CI_Admin && (
        <IntegrationWorkflowWidget />
      )}
      
      {/* TB-specific widgets */}
      {entitlements.TB_Admin && (
        <TimeBridgeSyncStatusWidget />
      )}
    </DashboardLayout>
  );
};
```

### 3. Consistent Design Patterns

**Shared Design System**:
- **Card-based Layout** - All widgets use Flowbite's Card component
- **Color Palette** - Blue (primary), Green (success), Red (error), Yellow (warning)
- **Icon Library** - HeroIcons for consistency across all interfaces
- **Loading States** - Shared spinner and skeleton patterns
- **Error Handling** - Consistent error display components

**Widget Template**:
```typescript
export const StandardWidget: React.FC<WidgetProps> = ({ title, children, status, onAction }) => {
  return (
    <Card className="widget-container">
      <Card.Header className="widget-header">
        <h3 className="widget-title">{title}</h3>
        {status && <Badge color={getStatusColor(status)}>{status}</Badge>}
      </Card.Header>
      <Card.Body className="widget-content">
        {children}
      </Card.Body>
      {onAction && (
        <Card.Footer className="widget-actions">
          <Button onClick={() => onAction('primary')} color="blue">
            Action
          </Button>
        </Card.Footer>
      )}
    </Card>
  );
};
```

## CI and TB Admin Implementation Patterns

### CI Admin Dashboard

**File**: `/src/frontend/src/features/integrations/pages/CIAdminDashboard.tsx`

**Widget Strategy**:
- **Reuses Core Widgets**: ActionMetricsWidget, CompanyStatsWidget (with IntegrationDataContext)
- **Adds Specialized Widgets**: IntegrationWorkflowWidget, IntegrationEmployeeWidget
- **Shared Components**: EmptyStateOnboarding, CreateServiceTicketForm

### TB Admin Dashboard

**File**: `/src/frontend/src/features/timebridge/pages/TBAdminDashboard.tsx`

**Widget Strategy**:
- **Reuses Core Widgets**: ActionMetricsWidget, CompanyStatsWidget (with TimeBridgeDataContext)
- **Adds Specialized Widgets**: TimeBridgeSyncStatusWidget
- **Shared Components**: EmptyStateOnboarding, CreateServiceTicketForm

### Shared Cross-Platform Components

**EmptyStateOnboarding**: `/src/frontend/src/features/integrations/components/EmptyStateOnboarding.tsx`
```typescript
interface EmptyStateProps {
  dashboardType: 'CI_Admin' | 'TB_Admin' | 'Core_Admin';
  onGetStarted: () => void;
}

export const EmptyStateOnboarding: React.FC<EmptyStateProps> = ({ dashboardType, onGetStarted }) => {
  const content = getContentForDashboard(dashboardType);
  
  return (
    <Card className="empty-state">
      <CardContent className="text-center py-12">
        <Icon name={content.icon} className="h-16 w-16 mx-auto mb-4 text-gray-400" />
        <h3 className="text-lg font-medium mb-2">{content.title}</h3>
        <p className="text-gray-600 mb-6">{content.description}</p>
        <Button onClick={onGetStarted} color="blue">
          {content.actionLabel}
        </Button>
      </CardContent>
    </Card>
  );
};
```

## Context Provider Architecture

### Hierarchical Context Structure

```typescript
// CI Admin Context Stack
<AuthProvider>
  <StatusProvider>
    <AccountProvider>
      <CompanyProvider>
        <IntegrationDataProvider>  {/* CI-specific context */}
          <CIAdminDashboard />
        </IntegrationDataProvider>
      </CompanyProvider>
    </AccountProvider>
  </StatusProvider>
</AuthProvider>

// TB Admin Context Stack
<AuthProvider>
  <StatusProvider>
    <AccountProvider>
      <CompanyProvider>
        <TimeBridgeDataProvider>  {/* TB-specific context */}
          <TBAdminDashboard />
        </TimeBridgeDataProvider>
      </CompanyProvider>
    </AccountProvider>
  </StatusProvider>
</AuthProvider>
```

### Context Data Scoping

**Integration Data Context**: `/src/frontend/src/contexts/IntegrationDataContext.tsx`
- Employee integration records and validation
- Integration workflow status and metrics
- CI-specific error handling and notifications

**TimeBridge Data Context**: `/src/frontend/src/contexts/TimeBridgeDataContext.tsx`
- Timesheet and payroll sync operations
- TB-specific scheduling and status monitoring
- Sync error tracking and resolution

## Benefits of Shared Widget Architecture

### 1. Development Efficiency
- **Reduced Code Duplication** - Core widgets reused across admin interfaces
- **Consistent UX** - Same interaction patterns across all admin dashboards
- **Shared Maintenance** - Bug fixes and improvements benefit all admin interfaces

### 2. Design Consistency
- **Unified Theme** - All admin interfaces follow the same design system
- **Predictable Interactions** - Users experience consistent behavior across platforms
- **Brand Coherence** - HappyHippo branding and styling maintained everywhere

### 3. Scalability
- **Easy Extension** - New admin interfaces can quickly adopt existing widget library
- **Context Isolation** - Domain-specific logic isolated in context providers
- **Progressive Enhancement** - Core functionality enhanced rather than reimplemented

## Best Practices

### 1. Widget Development
- **Start with Core** - Develop widgets in core admin dashboard first
- **Context Awareness** - Design widgets to adapt based on available context
- **Composition Over Inheritance** - Use composition to add domain-specific features

### 2. Context Design
- **Single Responsibility** - Each context handles one domain area
- **Minimal Interface** - Expose only necessary data and actions
- **Performance Optimization** - Use memoization and selective updates

### 3. Styling and Theming
- **Use Shared Classes** - Leverage TailwindCSS utility classes for consistency
- **Component Variants** - Support different display modes (compact, detailed, etc.)
- **Responsive Design** - Ensure widgets work across all screen sizes

## File Organization

```
src/frontend/src/
├── features/
│   ├── admin/
│   │   ├── components/           # Core shared widgets
│   │   │   ├── ActionMetricsWidget.tsx
│   │   │   ├── CompanyStatsWidget.tsx
│   │   │   └── HeadcountWidget.tsx
│   │   └── pages/
│   │       └── AdminDashboard.tsx  # "Mothership" dashboard
│   ├── integrations/
│   │   ├── components/           # CI-specific widgets + shared components
│   │   │   ├── IntegrationWorkflowWidget.tsx
│   │   │   └── EmptyStateOnboarding.tsx
│   │   └── pages/
│   │       └── CIAdminDashboard.tsx
│   └── timebridge/
│       ├── components/           # TB-specific widgets
│       │   └── TimeBridgeSyncStatusWidget.tsx
│       └── pages/
│           └── TBAdminDashboard.tsx
└── contexts/
    ├── IntegrationDataContext.tsx  # CI domain context
    └── TimeBridgeDataContext.tsx   # TB domain context
```

This architecture enables the HappyHippo platform to maintain a consistent admin experience while supporting specialized functionality for different domains through the power of React's context system and component composition patterns.