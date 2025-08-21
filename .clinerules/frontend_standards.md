# Frontend Development Standards

## Technology Stack

### Core Technologies

1. **React**
   - Functional component approach
   - Hooks-based state management
   - Composition over inheritance
   - Memoization for performance optimization

2. **TypeScript**
   - Strict type checking enabled
   - Interface-first development
   - Union types for state management
   - Type guards over type assertions
   - Generic components for reusability

3. **Flowbite React**
   - Primary component library
   - TailwindCSS for styling
   - Consistent theme configuration
   - Dark mode support
   - Accessibility compliance

4. **React Router**
   - Declarative routing
   - Role-based route protection
   - Nested routes for feature organization
   - Context-aware navigation

## Application Structure

### Core Application Components

1. **AuthenticatedApp**
   - Role-based access control
   - Context provider hierarchy
   - Persistent navigation state
   - Feature flag integration
   - Theme management

2. **Layout System**
   - Responsive design patterns
   - Common header/footer/sidebar
   - Workspace-specific layouts
   - Feature-specific sub-layouts
   - Mobile-first approach

3. **Navigation Structure**
   - Role-filtered navigation items
   - Context-sensitive menus
   - Breadcrumb navigation
   - Permission-based feature links

### Context Provider Architecture

```jsx
// Provider nesting pattern for proper layering
<AuthProvider>
  <StatusProvider>
    <AccountProvider>
      <CompanyProvider>
        <FeatureProviders>
          <RouteComponent />
        </FeatureProviders>
      </CompanyProvider>
    </AccountProvider>
  </StatusProvider>
</AuthProvider>
```

1. **Provider Hierarchy**
   - **AuthProvider**: User authentication state
   - **StatusProvider**: System-wide state (Super User layer)
   - **AccountProvider**: Client and company selection (Account layer)
   - **CompanyProvider**: Company-specific data (Company layer)
   - **FeatureProviders**: Feature-specific contexts (Feature layer)

2. **Performance Optimization**
   - Selective context updates
   - Memoized context values
   - Context splitting for granular updates
   - Lazy-loading for heavy feature contexts

3. **Data Flow Pattern**
   - Props for component-specific data
   - Context for shared/hierarchical data
   - State for local component data
   - Refs for non-render values

## Component Standards

### Component Organization

1. **Feature-Based Structure**
   ```
   src/
   ├── features/
   │   ├── [feature]/
   │   │   ├── components/
   │   │   ├── hooks/
   │   │   └── contexts/
   ```

2. **Common Components**
   ```
   src/
   ├── components/
   │   ├── common/        # Basic UI elements
   │   ├── data/          # Data presentation components
   │   ├── layout/        # Layout components
   │   └── [domain]/      # Domain-specific components
   ```

3. **Shared Hooks**
   ```
   src/
   ├── hooks/
   │   ├── useActionFieldTypes.ts
   │   ├── useUserRole.ts
   │   └── [other shared hooks]
   ```

### Component Implementation

1. **Functional Component Pattern**
   ```tsx
   import React, { useState, useEffect } from 'react';
   import type { ComponentProps } from './types';

   export const ExampleComponent: React.FC<ComponentProps> = ({
     initialData,
     onAction
   }) => {
     // Local state
     const [data, setData] = useState(initialData);
     
     // Effects
     useEffect(() => {
       // Side effect handling
     }, [dependencies]);
     
     // Event handlers
     const handleClick = () => {
       // Update state and trigger callbacks
       setData(newData);
       onAction(newData);
     };
     
     // Render
     return (
       <div className="example-component">
         {/* Component rendering */}
       </div>
     );
   };
   ```

2. **Component Prop Types**
   ```tsx
   // In types.ts
   export interface ComponentProps {
     initialData: DataType;
     onAction?: (data: DataType) => void;
     isDisabled?: boolean;
     variant?: 'primary' | 'secondary';
   }
   ```

3. **Performance Optimization**
   ```tsx
   // Memoization
   import React, { memo, useMemo, useCallback } from 'react';

   export const OptimizedComponent = memo(({ data, onAction }) => {
     // Memoized derived data
     const processedData = useMemo(() => {
       return processData(data);
     }, [data]);
     
     // Memoized callbacks
     const handleAction = useCallback(() => {
       onAction(processedData);
     }, [onAction, processedData]);
     
     return (
       <div onClick={handleAction}>
         {processedData.map(item => (
           <div key={item.id}>{item.name}</div>
         ))}
       </div>
     );
   });
   ```

## Authentication and Authorization

### Role-Based Access Control (RBAC)

1. **User Roles**
   - SuperAdmin: System-wide access
   - ClientAdmin: Client-scoped access
   - CompanyAdmin: Company-scoped access
   - Manager: Department-scoped access
   - User: Limited feature access

2. **Permission Implementation**
   ```tsx
   // Role-based component rendering
   import { useUserRole } from '../hooks/useUserRole';

   const FeatureComponent: React.FC = () => {
     const { hasRole, hasPermission } = useUserRole();
     
     // Role-based rendering
     if (hasRole('SuperAdmin')) {
       return <SuperAdminView />;
     }
     
     // Permission-based rendering
     if (hasPermission('feature:edit')) {
       return <EditableView />;
     }
     
     return <ReadOnlyView />;
   };
   ```

3. **Route Protection**
   ```tsx
   // Protected routes
   <Routes>
     <Route path="/" element={<Dashboard />} />
     <Route
       path="/admin/*"
       element={
         <RequireRole role="SuperAdmin">
           <AdminRoutes />
         </RequireRole>
       }
     />
   </Routes>
   ```

## State Management

### Context-Based State Management

1. **Context Structure**
   ```tsx
   // Context definition
   import React, { createContext, useContext, useState } from 'react';

   interface FeatureContextType {
     data: DataType[];
     isLoading: boolean;
     error: Error | null;
     actions: {
       fetchData: () => Promise<void>;
       updateItem: (id: string, data: Partial<DataType>) => Promise<void>;
     };
   }

   const FeatureContext = createContext<FeatureContextType | undefined>(undefined);

   export const useFeature = () => {
     const context = useContext(FeatureContext);
     if (context === undefined) {
       throw new Error('useFeature must be used within a FeatureProvider');
     }
     return context;
   };
   ```

2. **Context Provider Pattern**
   ```tsx
   export const FeatureProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
     // State
     const [data, setData] = useState<DataType[]>([]);
     const [isLoading, setIsLoading] = useState(false);
     const [error, setError] = useState<Error | null>(null);
     
     // API calls and actions
     const fetchData = async () => {
       try {
         setIsLoading(true);
         setError(null);
         const result = await api.getData();
         setData(result);
       } catch (err) {
         setError(err as Error);
       } finally {
         setIsLoading(false);
       }
     };
     
     const updateItem = async (id: string, updates: Partial<DataType>) => {
       // Implementation
     };
     
     // Context value
     const value = {
       data,
       isLoading,
       error,
       actions: {
         fetchData,
         updateItem
       }
     };
     
     return (
       <FeatureContext.Provider value={value}>
         {children}
       </FeatureContext.Provider>
     );
   };
   ```

3. **Optimizing Re-renders**
   ```tsx
   import React, { useMemo } from 'react';

   export const OptimizedProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
     // Split context by update frequency
     const [frequentData, setFrequentData] = useState({});
     const [stableData, setStableData] = useState({});
     
     // Memoize stable context
     const stableContext = useMemo(() => ({
       data: stableData,
       actions: {
         updateStableData: setStableData
       }
     }), [stableData]);
     
     // Separate providers to prevent unnecessary re-renders
     return (
       <StableContext.Provider value={stableContext}>
         <FrequentContext.Provider value={{ data: frequentData, setFrequentData }}>
           {children}
         </FrequentContext.Provider>
       </StableContext.Provider>
     );
   };
   ```

## Error Handling

### Error Boundary Pattern

```tsx
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ErrorBoundary caught an error', error, errorInfo);
    // Log to monitoring service
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="error-container">
          <h2>Something went wrong.</h2>
          <details>
            <summary>Error Details</summary>
            <pre>{this.state.error?.toString()}</pre>
          </details>
        </div>
      );
    }

    return this.props.children;
  }
}
```

### API Error Handling

```tsx
import { isSuccessResponse } from '../api/core';

const MyComponent: React.FC = () => {
  const [data, setData] = useState<DataType[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  const fetchData = async () => {
    try {
      const response = await Make_Authorized_API_Call<DataType>(
        API_ENDPOINTS.DOMAIN.ACTION,
        'GET'
      );
      
      if (isSuccessResponse(response)) {
        setData(response.data.Records);
        setError(null);
      } else {
        setError(response.message || 'An error occurred');
        // Optionally log the error for monitoring
      }
    } catch (err) {
      setError('An unexpected error occurred');
      console.error('API call failed:', err);
    }
  };
  
  // Error display in UI
  if (error) {
    return <Alert color="failure">{error}</Alert>;
  }
  
  return (
    // Regular component rendering
  );
};
```

## Dashboard and Advanced UI Patterns

### Card-Based UI
- Card components for dashboard layouts
- Consistent spacing and elevation
- Hover effects for interactive cards
- Standard card header/footer patterns
- Responsive card grids (1-3 columns based on viewport)

### Workspace Pattern
```typescript
// Workspace component structure
export const ClientOperationsWorkspace: React.FC<WorkspaceProps> = ({
  selectedClientId,
  selectedCompanyId,
  onBack,
  initialAction
}) => {
  // Workspace state and navigation logic
  return (
    <div className="workspace">
      <WorkspaceHeader title="Client Operations" onBack={onBack} />
      <WorkspaceContent>
        {/* Workspace-specific components */}
      </WorkspaceContent>
    </div>
  );
};
```

### Interactive Visualizations
- Flowchart components for process visualization
- Dynamic charts for analytics data
- Interactive diagrams with click handlers
- Visual feedback for user interactions
- Consistent color schemes for data types

### Dynamic Component Loading
```typescript
// Load components dynamically based on context
const renderActionContent = () => {
  if (!activeAction) return null;

  switch (activeAction) {
    case 'user_management':
      const UserManagement = require('./UserManagement').default;
      return <UserManagement />;
    case 'analytics_dashboard':
      const AnalyticsDashboard = require('./AnalyticsDashboard').default;
      return <AnalyticsDashboard />;
    // Additional cases...
  }
};
```

## Performance Best Practices

1. **Component Optimization**
   - Use React.memo for pure functional components
   - Implement shouldComponentUpdate for class components
   - Avoid anonymous functions in render
   - Use key prop correctly in lists

2. **Data Loading Patterns**
   - Implement virtualized lists for large datasets
   - Use pagination for data tables
   - Implement intelligent caching
   - Prefetch data for common user paths

3. **Resource Management**
   - Properly clean up subscriptions in useEffect
   - Cancel in-flight requests when components unmount
   - Implement proper resource pooling
   - Lazy load heavy components

4. **Rendering Optimization**
   - Avoid unnecessary re-renders
   - Use React.lazy and Suspense for code splitting
   - Optimize CSS for rendering performance
   - Implement progressive loading for large forms

## Testing Standards

1. **Component Testing**
   - Unit tests for business logic
   - Component tests with React Testing Library
   - Snapshot testing for UI stability
   - Integration tests for feature flows

2. **Test Organization**
   ```
   src/
   ├── features/
   │   ├── [feature]/
   │   │   ├── __tests__/
   │   │   │   ├── Component.test.tsx
   │   │   │   └── hooks.test.ts
   ```

3. **Testing Patterns**
   - Test behavior, not implementation
   - Mock external dependencies
   - Test error states and edge cases
   - Ensure accessibility in component tests

## Accessibility Standards

1. **Core Requirements**
   - Semantic HTML
   - Proper ARIA attributes
   - Keyboard navigation
   - Screen reader compatibility
   - Focus management

2. **Flowbite Component Usage**
   - Prefer built-in accessible components
   - Extend with proper accessibility attributes
   - Test custom components with screen readers
   - Maintain proper color contrast
