# Development Principles - Equilateral AI

**Developed by Equilateral AI (Pareidolia LLC)**

Core development principles for the Equilateral AI multi-agent orchestration system.

## Core Tenets

1. **Agent Coordination First** - Design for multi-agent collaboration
2. **Standards-Driven Development** - Follow established patterns consistently
3. **Fail Fast, Fail Loudly** - Make failures obvious and traceable
4. **Self-Bootstrapping** - Agents should be able to generate and improve themselves
5. **Enterprise-Ready** - Production-grade reliability and observability

## Agent Design Principles

### Universal Agent Structure
- All agents MUST implement standard lifecycle methods
- Consistent response formatting across all agents
- Event-driven architecture with proper error handling
- Capability registration and discovery

### Communication Standards
- Standardized context passing between agents
- Event emission for workflow coordination
- Retry logic for unstable operations
- Graceful degradation when dependencies unavailable

### Quality Gates
- Automatic validation of generated code
- Standards compliance checking
- Performance monitoring and optimization
- Cost awareness in production environments

This ensures reliable, scalable agent orchestration across diverse development scenarios.