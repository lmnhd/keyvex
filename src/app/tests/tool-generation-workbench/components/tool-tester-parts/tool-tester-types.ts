export interface BrainstormData {
    id: string;
    toolType: string;
    targetAudience: string;
    businessContext?: string;
    industry?: string;
    timestamp: number;
    result?: any;
  }
  
  export interface ModelOption {
    id: string;
    name: string;
    provider?: string;
  }
  
  export interface AgentModelMapping {
    [agentName: string]: string;
  }
  
  export type WorkflowMode = 'v1' | 'v2' | 'debug';
  export type OrchestrationStatus = 'free' | 'paused' | 'runone';
  export type TccSource = 'brainstorm' | 'savedV2Job' | 'mockScenario';
  
  export const STORAGE_KEYS = {
    selectedModels: 'tool-generation-workbench-selected-models',
    agentMapping: 'tool-generation-workbench-agent-mapping'
  };
  
  // Mock TCC scenarios for testing - Phase 3.1: Enhanced with comprehensive brainstorm data
  export const mockTccScenarios = [
    {
      id: 'simple-calculator',
      name: 'Simple Calculator',
      tcc: {
        jobId: 'mock-calculator-1',
        userId: 'mock-user',
        userInput: {
          description: 'A simple calculator tool for basic mathematical operations',
          targetAudience: 'students and professionals',
          toolType: 'calculator',
          industry: 'education'
        },
        selectedModel: 'gpt-4o-mini',
        agentModelMapping: {
          'function-planner': 'gpt-4o-mini',
          'state-design': 'gpt-4o-mini',
          'jsx-layout': 'gpt-4o-mini',
          'tailwind-styling': 'gpt-4o-mini',
          'component-assembler': 'gpt-4o-mini',
          'validator': 'gpt-4o-mini',
          'tool-finalizer': 'gpt-4o-mini'
        },
        status: 'in_progress',
        currentOrchestrationStep: 'planning_function_signatures',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        steps: {},
        // Phase 3.1: Add comprehensive brainstorm data to mock scenarios
        brainstormData: {
          coreConcept: 'Simple mathematical calculator for basic operations',
          valueProposition: 'Provides quick and accurate calculations for everyday math needs',
          suggestedInputs: [
            {
              id: 'first_number',
              label: 'First Number',
              type: 'number',
              required: true,
              description: 'The first number for calculation'
            },
            {
              id: 'second_number', 
              label: 'Second Number',
              type: 'number',
              required: true,
              description: 'The second number for calculation'
            },
            {
              id: 'operation',
              label: 'Operation',
              type: 'select',
              required: true,
              description: 'Mathematical operation to perform',
              options: ['add', 'subtract', 'multiply', 'divide']
            }
          ],
          keyCalculations: [
            {
              name: 'Basic Math Operation',
              formula: 'result = performOperation(firstNumber, operation, secondNumber)',
              description: 'Performs the selected mathematical operation',
              variables: ['firstNumber', 'secondNumber', 'operation']
            }
          ],
          interactionFlow: [
            {
              step: 1,
              title: 'Number Input',
              description: 'User enters two numbers',
              userAction: 'Enter first and second numbers',
              engagementHook: 'Large, clear number input fields'
            },
            {
              step: 2,
              title: 'Operation Selection',
              description: 'User selects mathematical operation',
              userAction: 'Click operation button (+, -, ×, ÷)',
              engagementHook: 'Visual operation buttons with symbols'
            },
            {
              step: 3,
              title: 'Result Display',
              description: 'System shows calculation result',
              userAction: 'View result and history',
              engagementHook: 'Immediate result display with calculation history'
            }
          ],
          leadCaptureStrategy: {
            timing: 'after_completion',
            method: 'email_signup',
            incentive: 'Save calculation history and advanced functions'
          },
          creativeEnhancements: [
            'Clean, modern calculator interface',
            'Visual operation feedback',
            'Calculation history display',
            'Responsive design for mobile and desktop'
          ],
          calculationLogic: [
            {
              id: 'basic_math',
              name: 'Basic Mathematical Operations',
              formula: 'switch(operation) { case "add": return a + b; case "subtract": return a - b; case "multiply": return a * b; case "divide": return a / b; }',
              dependencies: ['firstNumber', 'secondNumber', 'operation'],
              outputFormat: 'number',
              engagementMoment: 'Instant calculation on operation selection'
            }
          ],
          promptOptions: {
            includeComprehensiveColors: true,
            includeGorgeousStyling: true,
            includeAdvancedLayouts: false,
            styleComplexity: 'standard',
            industryFocus: 'education',
            toolComplexity: 'simple'
          }
        }
      }
    },
    {
      id: 'bmi-calculator',
      name: 'BMI Calculator',
      tcc: {
        jobId: 'mock-bmi-1',
        userId: 'mock-user',
        userInput: {
          description: 'Body Mass Index calculator for health assessment',
          targetAudience: 'health-conscious individuals',
          toolType: 'health calculator',
          industry: 'healthcare'
        },
        selectedModel: 'gpt-4o-mini',
        agentModelMapping: {
          'function-planner': 'gpt-4o-mini',
          'state-design': 'gpt-4o-mini',
          'jsx-layout': 'gpt-4o-mini',
          'tailwind-styling': 'gpt-4o-mini',
          'component-assembler': 'gpt-4o-mini',
          'validator': 'gpt-4o-mini',
          'tool-finalizer': 'gpt-4o-mini'
        },
        status: 'in_progress',
        currentOrchestrationStep: 'planning_function_signatures',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        steps: {},
        brainstormData: {
          coreConcept: 'BMI calculator with health recommendations',
          valueProposition: 'Quick BMI calculation with personalized health insights',
          suggestedInputs: [
            {
              id: 'height',
              label: 'Height',
              type: 'number',
              required: true,
              description: 'Height in inches or cm'
            },
            {
              id: 'weight',
              label: 'Weight',
              type: 'number',
              required: true,
              description: 'Weight in pounds or kg'
            },
            {
              id: 'unit_system',
              label: 'Unit System',
              type: 'select',
              required: true,
              description: 'Imperial or metric units',
              options: ['imperial', 'metric']
            }
          ],
          keyCalculations: [
            {
              name: 'BMI Calculation',
              formula: 'BMI = weight / (height * height) - adjusted for unit system',
              description: 'Calculates Body Mass Index with unit conversion',
              variables: ['weight', 'height', 'unitSystem']
            }
          ],
          interactionFlow: [
            {
              step: 1,
              title: 'Measurement Input',
              description: 'User enters height and weight',
              userAction: 'Enter physical measurements',
              engagementHook: 'Unit toggle for convenience'
            },
            {
              step: 2,
              title: 'BMI Calculation',
              description: 'System calculates BMI score',
              userAction: 'Click calculate button',
              engagementHook: 'Instant BMI score with visual indicator'
            },
            {
              step: 3,
              title: 'Health Assessment',
              description: 'Display BMI category and recommendations',
              userAction: 'Review health insights',
              engagementHook: 'Color-coded health categories and tips'
            }
          ],
          leadCaptureStrategy: {
            timing: 'after_completion',
            method: 'email_signup',
            incentive: 'Personalized health tracking and tips'
          },
          creativeEnhancements: [
            'Health-focused color scheme',
            'BMI category visualization',
            'Responsive health recommendations',
            'Unit conversion toggle'
          ],
          calculationLogic: [
            {
              id: 'bmi_calc',
              name: 'BMI Calculation with Units',
              formula: 'imperial: (weight * 703) / (height * height), metric: weight / ((height/100) * (height/100))',
              dependencies: ['weight', 'height', 'unitSystem'],
              outputFormat: 'number',
              engagementMoment: 'Real-time BMI updates as user types'
            }
          ],
          promptOptions: {
            includeComprehensiveColors: true,
            includeGorgeousStyling: true,
            includeAdvancedLayouts: false,
            styleComplexity: 'standard',
            industryFocus: 'healthcare',
            toolComplexity: 'standard'
          }
        }
      }
    }
  ];
  
  // Phase 3.2: Add agent mode for create/edit toggle
  export type AgentMode = 'create' | 'edit';
  