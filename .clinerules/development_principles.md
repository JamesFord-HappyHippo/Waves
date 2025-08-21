# Development Principles

## 1. No Mocks, No Fallback Data

### Rule
Do not implement mock data or fallback data handling in production code. We need to see failures for what they are so we can fix the root causes, rather than masking issues with workarounds.

### Rationale
- **Visibility**: Hidden failures don't get fixed. When we mask failures with fallbacks or mock data, we lose visibility into underlying issues.
- **Technical Debt**: Fallbacks create technical debt by allowing broken systems to appear functional.
- **Dependency Clarity**: Clear failures make service dependencies explicit and encourage proper error handling.
- **Customer Experience**: While internal systems may appear to work with mocks, the end customer experience is still broken.

### Implementation Guidelines
- ❌ **Avoid**: Creating mock data generators in production code
- ❌ **Avoid**: Adding fallback values when APIs fail
- ❌ **Avoid**: Silently handling error conditions with defaults
- ✅ **Do**: Implement proper error boundaries to show failures clearly
- ✅ **Do**: Log and report all failures with complete context
- ✅ **Do**: Design error states as first-class UI elements

### Exceptions
- Development/testing environments may use mocks in controlled ways
- Feature flags may be used to disable incomplete features in production
- Stubs are acceptable in tests but not in production code

## 2. Fail Fast, Fail Loudly

### Rule
Make failures obvious, immediate, and descriptive rather than hiding or delaying them.

### Rationale
- **Early Detection**: Obvious failures are detected earlier in the development cycle
- **Complete Context**: Immediate failures retain the full context needed for diagnosis
- **Reduced Impact**: Fast failures minimize the blast radius of an issue
- **Clear Communication**: Descriptive failures help non-technical stakeholders understand issues

### Implementation Guidelines
- ✅ **Do**: Add descriptive error messages with actionable information
- ✅ **Do**: Implement proper error boundaries at component and feature levels
- ✅ **Do**: Design error states that are impossible to miss
- ✅ **Do**: Include context data in error reports

## 3. Consistent Error Handling

### Rule
Handle errors consistently across the application, following established patterns.

### Rationale
- **Predictability**: Users and developers know what to expect
- **Efficiency**: Consistent patterns make debugging faster
- **Documentation**: Well-known patterns reduce the need for documentation
- **Reusability**: Consistent approaches enable reusable error handling components

### Implementation Guidelines
- ✅ **Do**: Use error boundaries at appropriate levels
- ✅ **Do**: Implement consistent API error handling patterns
- ✅ **Do**: Display user-friendly messages while preserving technical details
- ✅ **Do**: Log errors in a standardized format with context

## 4. Error-First Design

### Rule
Design for error states first, then implement the happy path.

### Rationale
- **Resilience**: Applications designed with error handling in mind are more resilient
- **Completeness**: Error-first design ensures edge cases are considered
- **User Experience**: Properly designed error states improve overall user experience
- **Maintenance**: Error states are often the most challenging to retrofit later

### Implementation Guidelines
- ✅ **Do**: Create error state designs before implementing features
- ✅ **Do**: Consider loading, empty, and error states for every component
- ✅ **Do**: Test error paths explicitly in automated tests
- ✅ **Do**: Review error handling in code reviews with the same priority as feature code
