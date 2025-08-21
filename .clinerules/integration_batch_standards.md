# Integration and Batch Processing Standards

## Callisto Integration Platform

### Integration Templates

Integration templates are reusable patterns that define:
- Source and target system schemas
- Field mapping specifications
- Business rule frameworks
- Default approval workflows

```typescript
// Standard Template Structure
interface IntegrationTemplate {
  template_code: string;         // Business key identifier
  template_name: string;         // User-friendly name
  template_type: string;         // Integration category
  source_schema: SchemaDefinition;
  target_schema: SchemaDefinition;
  default_mappings: FieldMapping[];
  approval_workflow: ApprovalConfig;
  error_handling: ErrorHandlingConfig;
}
```

### Business Key Architecture

All integration components must use business keys instead of UUIDs:

1. **Template Business Keys**:
   ```typescript
   // Example: template_QBT_WFN (QuickBooks Time to WorkForce Now)
   const templateCode = `template_${source}_${target}`;
   ```

2. **Mapping Business Keys**:
   ```typescript
   // Example: mapping_QBT_WFN_ACME_20250724
   const mappingId = `mapping_${source}_${target}_${clientCode}_${datestamp}`;
   ```

3. **Processing Business Keys**:
   ```typescript
   // Example: proc_QBT_WFN_ACME_20250724_145623
   const processingId = `proc_${source}_${target}_${clientCode}_${timestamp}`;
   ```

4. **Certificate Business Keys**:
   ```typescript
   // Example: cert_ACME_QBT_20250724
   const certificateId = `cert_${clientCode}_${integrationSystem}_${datestamp}`;
   ```

### Template-Driven Workflow Generation

Workflows must be auto-generated from mappings:

1. Analyze field mappings to determine complexity
2. Generate appropriate approval sequences
3. Create execution pipelines with proper error handling
4. Configure monitoring and alerting

```typescript
// Example Pipeline Structure
interface ExecutionPipeline {
  steps: ExecutionStep[];
  retryPolicy: RetryPolicy;
  errorHandling: ErrorHandling;
  monitoring: MonitoringConfig;
}
```

## Batch Processing Systems

### Database PL/SQL Processing

For data-intensive batch operations, use PostgreSQL PL/SQL:

1. **Standard Batch Function Pattern**
   ```sql
   CREATE OR REPLACE FUNCTION batch_process_data(
     p_company_id VARCHAR,
     p_batch_size INTEGER DEFAULT 1000,
     p_max_runtime_minutes INTEGER DEFAULT 30
   )
   RETURNS TABLE (
     records_processed INTEGER,
     processing_time_ms INTEGER,
     success_rate DECIMAL
   )
   LANGUAGE plpgsql
   AS $$
   DECLARE
     v_start_time TIMESTAMP := clock_timestamp();
     v_end_time TIMESTAMP;
     v_processed INTEGER := 0;
     v_succeeded INTEGER := 0;
     v_batch_id VARCHAR := 'batch_' || p_company_id || '_' || to_char(now(), 'YYYYMMDD_HH24MISS');
     v_max_end_time TIMESTAMP := v_start_time + (p_max_runtime_minutes || ' minutes')::INTERVAL;
   BEGIN
     -- Create processing log
     INSERT INTO batch_processing_log (batch_id, company_id, start_time, status)
     VALUES (v_batch_id, p_company_id, v_start_time, 'RUNNING');
     
     -- Process data in batches
     WHILE clock_timestamp() < v_max_end_time LOOP
       -- Process batch logic here
       -- ...
       
       v_processed := v_processed + records_in_current_batch;
       v_succeeded := v_succeeded + successful_records;
       
       -- Exit if no more records
       IF records_in_current_batch = 0 THEN
         EXIT;
       END IF;
       
       -- Commit batch
       COMMIT;
     END LOOP;
     
     -- Update log with results
     v_end_time := clock_timestamp();
     UPDATE batch_processing_log 
     SET end_time = v_end_time,
         status = 'COMPLETED',
         records_processed = v_processed,
         records_succeeded = v_succeeded,
         processing_time_ms = EXTRACT(EPOCH FROM (v_end_time - v_start_time)) * 1000
     WHERE batch_id = v_batch_id;
     
     -- Return results
     RETURN QUERY
     SELECT v_processed, 
            EXTRACT(EPOCH FROM (v_end_time - v_start_time))::INTEGER * 1000,
            CASE WHEN v_processed > 0 THEN (v_succeeded::DECIMAL / v_processed) ELSE 1.0 END;
   END;
   $$;
   ```

2. **Batch Table Structure**
   ```sql
   CREATE TABLE batch_processing_log (
     batch_id VARCHAR PRIMARY KEY,
     company_id VARCHAR NOT NULL,
     start_time TIMESTAMP NOT NULL,
     end_time TIMESTAMP,
     status VARCHAR NOT NULL,
     records_processed INTEGER,
     records_succeeded INTEGER,
     processing_time_ms INTEGER,
     error_details TEXT
   );
   ```

3. **Batch Execution Patterns**
   - Weekly analytics calculations
   - Monthly compliance processing
   - Daily data reconciliation
   - End-of-period financial calculations

### ECS Scheduler (Future Implementation)

For scheduled integrations, use AWS ECS Scheduler:

1. **Scheduled Task Definition**
   ```json
   {
     "family": "scheduled-integration-task",
     "containerDefinitions": [
       {
         "name": "integration-processor",
         "image": "happyhippo/integration-processor:latest",
         "essential": true,
         "environment": [
           { "name": "INTEGRATION_TYPE", "value": "timebridge" },
           { "name": "MAX_RUNTIME", "value": "30" },
           { "name": "BATCH_SIZE", "value": "1000" }
         ],
         "logConfiguration": {
           "logDriver": "awslogs",
           "options": {
             "awslogs-group": "/ecs/scheduled-integrations",
             "awslogs-region": "us-east-1",
             "awslogs-stream-prefix": "ecs"
           }
         }
       }
     ]
   }
   ```

2. **CloudWatch Events Schedule**
   ```json
   {
     "name": "timebridge-daily-sync",
     "description": "Triggers daily TimeBridge data synchronization",
     "scheduleExpression": "cron(0 3 * * ? *)",
     "target": {
       "id": "run-timebridge-sync",
       "arn": "arn:aws:ecs:us-east-1:123456789012:cluster/integration-cluster",
       "roleArn": "arn:aws:iam::123456789012:role/service-scheduler",
       "ecsParameters": {
         "taskDefinitionArn": "arn:aws:ecs:us-east-1:123456789012:task-definition/scheduled-integration-task",
         "taskCount": 1,
         "launchType": "FARGATE",
         "networkConfiguration": {
           "awsvpcConfiguration": {
             "subnets": ["subnet-12345678"],
             "securityGroups": ["sg-12345678"],
             "assignPublicIp": "DISABLED"
           }
         }
       }
     }
   }
   ```

3. **Common Scheduled Integration Patterns**
   - Daily TimeBridge synchronization (QuickBooks Time → ADP WFN)
   - Weekly employee data reconciliation
   - Bi-weekly payroll data processing
   - Monthly compliance reporting
   - Certificate expiration monitoring

## Implementation Standards

### Handler Organization

Integration handlers should be organized in the following structure:

```
src/backend/src/handlers/integrations/
├── callisto/
│   ├── listTemplates.js           // Template discovery
│   ├── templateSchema.js          // Schema definition
│   ├── createMapping.js           // Field mapping creation
│   ├── suggestMappings.js         // Auto-suggest mappings
│   ├── executeIntegration.js      // Integration execution
│   ├── processEvents.js           // Event processing
│   └── healthCheck.js             // Health monitoring
├── timebridge/
│   ├── dataSync.js                // Data synchronization
│   ├── scheduleSync.js            // Schedule management
│   └── statusCheck.js             // Status monitoring
└── system/
    ├── certificateManager.js      // Certificate management
    └── credentialManager.js       // Credential handling
```

### Error Handling

Use consistent error handling across all integration components:

```javascript
try {
  // Integration logic
} catch (error) {
  console.error(`Integration Error [${integrationId}]:`, error);
  
  // Create detailed error record
  const errorRecord = {
    error_id: `err_${integration_type}_${Date.now()}`,
    company_id: company_id,
    integration_id: integrationId,
    error_type: determineErrorType(error),
    error_message: error.message,
    error_details: JSON.stringify(error),
    error_stack: error.stack,
    occurred_at: new Date().toISOString(),
    status: 'NEW'
  };
  
  // Store error for tracking
  await storeIntegrationError(errorRecord);
  
  // Return proper error response
  return createErrorResponse(
    'Integration processing failed',
    error.code || 'INTEGRATION_ERROR',
    errorRecord.error_id
  );
}
```

## Performance Optimization

### Batch Processing Performance

Optimize PL/SQL batch operations:

1. **Memory Management**
   - Use proper `WORK_MEM` settings
   - Process in appropriately sized batches
   - Implement checkpointing for long-running operations

2. **Indexing Strategy**
   - Create appropriate indexes for batch lookups
   - Consider partial indexes for filtered data
   - Use proper index types (B-tree, Hash, GIN)

3. **Transaction Management**
   - Commit in batches to avoid long-running transactions
   - Use savepoints for partial commits
   - Implement proper error recovery

4. **Monitoring**
   - Track batch processing metrics
   - Monitor memory and CPU usage
   - Implement timeout handling

### Integration Performance

1. **Business Key Optimization**
   - Use meaningful business keys
   - Implement composite indexes
   - Avoid UUID bottlenecks

2. **Caching Strategy**
   - Cache template definitions
   - Cache mapping configurations
   - Implement TTL-based invalidation

3. **Parallelization**
   - Process independent records in parallel
   - Use connection pooling
   - Implement proper concurrency controls
