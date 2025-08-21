/**
 * Test Data Agent - Specialized Database Coherence Management
 * 
 * Ensures consistent, realistic test data across all environments
 * Maintains referential integrity and business logic consistency
 */

const { executeQuery } = require('../../backend/src/helpers/dbOperations');
const { createSuccessResponse, createErrorResponse } = require('../../backend/src/helpers/responseUtil');

class TestDataAgent {
    constructor() {
        this.scenarios = {
            // Core test scenarios with complete data chains
            'basic_company_setup': {
                description: 'Complete company with employees, integrations, and analytics data',
                dependencies: ['companies', 'employees', 'integration_instances', 'analytics_data']
            },
            'timebridge_flow': {
                description: 'Full TimeBridge workflow from setup to data sync',
                dependencies: ['companies', 'employees', 'integration_templates', 'integration_instances', 'timesheet_data']
            },
            'pos_connect_setup': {
                description: 'POS system integration with employee mapping and sales data',
                dependencies: ['companies', 'employees', 'pos_systems', 'employee_mappings', 'sales_transactions']
            },
            'analytics_complete': {
                description: 'Complete analytics pipeline with flight risk and wage data',
                dependencies: ['companies', 'employees', 'performance_data', 'wage_data', 'flight_risk_scores']
            }
        };
    }

    /**
     * Generate coherent test data for specific scenario
     */
    async generateScenarioData(scenarioName, options = {}) {
        try {
            const scenario = this.scenarios[scenarioName];
            if (!scenario) {
                throw new Error(`Unknown scenario: ${scenarioName}`);
            }

            console.log(`🧪 Generating test data for scenario: ${scenarioName}`);
            
            const testData = {};
            
            // Generate data in dependency order
            for (const dependency of scenario.dependencies) {
                testData[dependency] = await this.generateEntityData(dependency, options);
            }

            // Ensure referential integrity
            await this.validateDataIntegrity(testData);

            return createSuccessResponse(
                { testData },
                `Successfully generated ${scenarioName} test data`,
                { 
                    scenario: scenarioName,
                    entities_created: Object.keys(testData).length,
                    timestamp: new Date().toISOString()
                }
            );

        } catch (error) {
            console.error('Test data generation failed:', error);
            return createErrorResponse(error.message, 'TEST_DATA_GENERATION_ERROR');
        }
    }

    /**
     * Generate realistic data for specific entity type
     */
    async generateEntityData(entityType, options) {
        const generators = {
            companies: () => this.generateCompanies(options.companyCount || 3),
            employees: (companies) => this.generateEmployees(companies, options.employeeCount || 50),
            integration_templates: () => this.generateIntegrationTemplates(),
            integration_instances: (companies, templates) => this.generateIntegrationInstances(companies, templates),
            pos_systems: () => this.generatePOSSystems(),
            timesheet_data: (employees, instances) => this.generateTimesheetData(employees, instances),
            sales_transactions: (employees, pos_systems) => this.generateSalesTransactions(employees, pos_systems),
            performance_data: (employees) => this.generatePerformanceData(employees),
            wage_data: (employees) => this.generateWageData(employees),
            flight_risk_scores: (employees, performance, wage) => this.generateFlightRiskScores(employees, performance, wage)
        };

        return generators[entityType] ? generators[entityType]() : [];
    }

    /**
     * Generate realistic company data
     */
    async generateCompanies(count = 3) {
        const companies = [];
        const companyTemplates = [
            { name: 'Acme Restaurant Group', industry: 'Food Service', size: 'Medium', employee_count: 150 },
            { name: 'TechStart Solutions', industry: 'Technology', size: 'Small', employee_count: 25 },
            { name: 'Retail Plus Corp', industry: 'Retail', size: 'Large', employee_count: 500 }
        ];

        for (let i = 0; i < count; i++) {
            const template = companyTemplates[i % companyTemplates.length];
            const companyId = `TEST_COMPANY_${i + 1}`;
            
            const company = {
                Company_ID: companyId,
                Company_Name: `${template.name} ${i > 0 ? i + 1 : ''}`,
                Industry: template.industry,
                Company_Size: template.size,
                Expected_Employee_Count: template.employee_count,
                Created_Date: new Date().toISOString(),
                Status: 'Active',
                Test_Data_Flag: true
            };

            // Insert into database
            await executeQuery(
                'INSERT INTO companies (Company_ID, Company_Name, Industry, Company_Size, Created_Date, Status, Test_Data_Flag) VALUES ($1, $2, $3, $4, $5, $6, $7)',
                [company.Company_ID, company.Company_Name, company.Industry, company.Company_Size, company.Created_Date, company.Status, company.Test_Data_Flag]
            );

            companies.push(company);
        }

        return companies;
    }

    /**
     * Generate realistic employee data with proper distributions
     */
    async generateEmployees(companies, totalCount = 50) {
        const employees = [];
        const departments = ['Sales', 'Marketing', 'Engineering', 'HR', 'Finance', 'Operations'];
        const positions = ['Manager', 'Senior', 'Associate', 'Junior', 'Intern'];
        const locations = ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix'];

        for (const company of companies) {
            const employeeCount = Math.floor(totalCount / companies.length);
            
            for (let i = 0; i < employeeCount; i++) {
                const employeeId = `${company.Company_ID}_EMP_${i + 1}`;
                const department = departments[Math.floor(Math.random() * departments.length)];
                const position = positions[Math.floor(Math.random() * positions.length)];
                const location = locations[Math.floor(Math.random() * locations.length)];

                const employee = {
                    Employee_ID: employeeId,
                    Company_ID: company.Company_ID,
                    First_Name: this.generateRandomName('first'),
                    Last_Name: this.generateRandomName('last'),
                    Department: department,
                    Position: `${position} ${department} Specialist`,
                    Location: location,
                    Hire_Date: this.generateRandomDate(-1000, -30), // Hired 30-1000 days ago
                    Employment_Status: 'Active',
                    Salary: this.generateRealisticSalary(position, department),
                    Test_Data_Flag: true
                };

                // Insert into database
                await executeQuery(
                    'INSERT INTO employees (Employee_ID, Company_ID, First_Name, Last_Name, Department, Position, Location, Hire_Date, Employment_Status, Salary, Test_Data_Flag) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
                    [employee.Employee_ID, employee.Company_ID, employee.First_Name, employee.Last_Name, employee.Department, employee.Position, employee.Location, employee.Hire_Date, employee.Employment_Status, employee.Salary, employee.Test_Data_Flag]
                );

                employees.push(employee);
            }
        }

        return employees;
    }

    /**
     * Generate integration templates for testing
     */
    async generateIntegrationTemplates() {
        const templates = [
            {
                Template_ID: 'quickbooks_time_test',
                Template_Name: 'QuickBooks Time Test Integration',
                Source_System: 'QuickBooks Time',
                Target_System: 'ADP',
                Template_Type: 'Timesheet Sync',
                Status: 'Active'
            },
            {
                Template_ID: 'square_pos_test',
                Template_Name: 'Square POS Test Integration',
                Source_System: 'Square',
                Target_System: 'Internal Analytics',
                Template_Type: 'Sales Sync',
                Status: 'Active'
            },
            {
                Template_ID: 'clover_pos_test',
                Template_Name: 'Clover POS Test Integration',
                Source_System: 'Clover',
                Target_System: 'Payroll System',
                Template_Type: 'Employee Hours',
                Status: 'Active'
            }
        ];

        for (const template of templates) {
            await executeQuery(
                'INSERT INTO integration_templates (Template_ID, Template_Name, Source_System, Target_System, Template_Type, Status, Test_Data_Flag) VALUES ($1, $2, $3, $4, $5, $6, $7)',
                [template.Template_ID, template.Template_Name, template.Source_System, template.Target_System, template.Template_Type, template.Status, true]
            );
        }

        return templates;
    }

    /**
     * Validate referential integrity across generated data
     */
    async validateDataIntegrity(testData) {
        const validations = [
            // Ensure all employees belong to valid companies
            () => this.validateEmployeeCompanyRelationships(testData.employees, testData.companies),
            // Ensure integration instances have valid templates
            () => this.validateIntegrationInstanceTemplates(testData.integration_instances, testData.integration_templates),
            // Ensure performance data has valid employee references
            () => this.validatePerformanceDataEmployees(testData.performance_data, testData.employees)
        ];

        for (const validation of validations) {
            await validation();
        }
    }

    /**
     * Clean up test data for specific scenario
     */
    async cleanupScenarioData(scenarioName) {
        try {
            console.log(`🧹 Cleaning up test data for scenario: ${scenarioName}`);

            // Delete in reverse dependency order to maintain referential integrity
            const cleanupQueries = [
                'DELETE FROM flight_risk_scores WHERE Test_Data_Flag = true',
                'DELETE FROM wage_data WHERE Test_Data_Flag = true',
                'DELETE FROM performance_data WHERE Test_Data_Flag = true', 
                'DELETE FROM sales_transactions WHERE Test_Data_Flag = true',
                'DELETE FROM timesheet_data WHERE Test_Data_Flag = true',
                'DELETE FROM integration_instances WHERE Test_Data_Flag = true',
                'DELETE FROM integration_templates WHERE Test_Data_Flag = true',
                'DELETE FROM pos_systems WHERE Test_Data_Flag = true',
                'DELETE FROM employees WHERE Test_Data_Flag = true',
                'DELETE FROM companies WHERE Test_Data_Flag = true'
            ];

            for (const query of cleanupQueries) {
                await executeQuery(query);
            }

            return createSuccessResponse(
                { cleaned: true },
                `Successfully cleaned up ${scenarioName} test data`
            );

        } catch (error) {
            console.error('Test data cleanup failed:', error);
            return createErrorResponse(error.message, 'TEST_DATA_CLEANUP_ERROR');
        }
    }

    /**
     * Generate realistic salary based on position and department
     */
    generateRealisticSalary(position, department) {
        const baseSalaries = {
            'Manager': 85000,
            'Senior': 70000, 
            'Associate': 55000,
            'Junior': 45000,
            'Intern': 35000
        };

        const departmentMultipliers = {
            'Engineering': 1.3,
            'Sales': 1.1,
            'Finance': 1.2,
            'Marketing': 1.0,
            'HR': 0.9,
            'Operations': 0.95
        };

        const base = baseSalaries[position] || 50000;
        const multiplier = departmentMultipliers[department] || 1.0;
        const variance = 0.8 + (Math.random() * 0.4); // ±20% variance

        return Math.round(base * multiplier * variance);
    }

    /**
     * Generate random names from predefined lists
     */
    generateRandomName(type) {
        const firstNames = ['John', 'Jane', 'Michael', 'Sarah', 'David', 'Emily', 'Robert', 'Ashley', 'James', 'Jessica'];
        const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez'];

        const names = type === 'first' ? firstNames : lastNames;
        return names[Math.floor(Math.random() * names.length)];
    }

    /**
     * Generate random date within range
     */
    generateRandomDate(minDaysAgo, maxDaysAgo) {
        const now = new Date();
        const randomDays = minDaysAgo + Math.random() * (maxDaysAgo - minDaysAgo);
        const date = new Date(now.getTime() - (randomDays * 24 * 60 * 60 * 1000));
        return date.toISOString().split('T')[0];
    }
}

module.exports = { TestDataAgent };