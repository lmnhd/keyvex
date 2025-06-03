// Random Tool Creation Test Scenarios
// This provides 10 diverse test cases to validate the tool creation agent across different industries and use cases

export interface RandomTestScenario {
  id: string;
  name: string;
  userIntent: string;
  context: {
    toolType: string;
    targetAudience: string;
    industry: string;
    businessDescription: string;
    features: string[];
    colors: string[];
    complexity: 'simple' | 'medium' | 'complex';
  };
}

export const RANDOM_TEST_SCENARIOS: RandomTestScenario[] = [
  {
    id: 'roi-calculator',
    name: 'ROI Calculator for Marketing Agencies',
    userIntent: 'Create a professional ROI calculator that helps marketing agencies demonstrate value to their clients',
    context: {
      toolType: 'ROI Calculator',
      targetAudience: 'marketing agencies and their clients',
      industry: 'digital marketing',
      businessDescription: 'Marketing agencies need to show clear ROI to justify their fees and demonstrate campaign effectiveness',
      features: ['multiple campaign types', 'time period comparison', 'export reports', 'client branding'],
      colors: ['professional-blue', 'trust-green'],
      complexity: 'medium'
    }
  },
  {
    id: 'pricing-calculator',
    name: 'SaaS Pricing Calculator',
    userIntent: 'Build a dynamic pricing calculator for SaaS companies to help prospects estimate their monthly costs',
    context: {
      toolType: 'Pricing Calculator',
      targetAudience: 'SaaS prospects and sales teams',
      industry: 'software as a service',
      businessDescription: 'SaaS companies need transparent pricing tools that help prospects understand costs and convert to paid plans',
      features: ['user tiers', 'feature toggles', 'discount codes', 'annual vs monthly'],
      colors: ['modern-purple', 'tech-blue'],
      complexity: 'complex'
    }
  },
  {
    id: 'lead-qualifier',
    name: 'Real Estate Lead Qualifier',
    userIntent: 'Create a lead qualification tool that helps real estate agents identify serious buyers',
    context: {
      toolType: 'Lead Qualifier',
      targetAudience: 'real estate agents and potential home buyers',
      industry: 'real estate',
      businessDescription: 'Real estate agents need to quickly identify qualified leads and focus their time on serious buyers',
      features: ['budget assessment', 'timeline evaluation', 'financing readiness', 'automated scoring'],
      colors: ['professional-navy', 'luxury-gold'],
      complexity: 'medium'
    }
  },
  {
    id: 'assessment-tool',
    name: 'Business Readiness Assessment',
    userIntent: 'Build a comprehensive assessment tool that evaluates if a business is ready for digital transformation',
    context: {
      toolType: 'Assessment Tool',
      targetAudience: 'business owners and IT consultants',
      industry: 'business consulting',
      businessDescription: 'Consultants need to assess client readiness before proposing digital transformation solutions',
      features: ['scored categories', 'detailed recommendations', 'action plan', 'progress tracking'],
      colors: ['consultant-gray', 'professional-blue'],
      complexity: 'complex'
    }
  },
  {
    id: 'savings-calculator',
    name: 'Energy Savings Calculator',
    userIntent: 'Create a simple calculator that shows potential energy savings from solar panel installation',
    context: {
      toolType: 'Savings Calculator',
      targetAudience: 'homeowners considering solar energy',
      industry: 'renewable energy',
      businessDescription: 'Solar companies need to show homeowners potential savings to generate interest in consultations',
      features: ['monthly savings', 'payback period', 'environmental impact', 'financing options'],
      colors: ['eco-green', 'solar-yellow'],
      complexity: 'simple'
    }
  },
  {
    id: 'cost-analyzer',
    name: 'Healthcare Cost Analyzer',
    userIntent: 'Build a tool that helps patients estimate medical procedure costs across different providers',
    context: {
      toolType: 'Cost Analyzer',
      targetAudience: 'patients and healthcare consumers',
      industry: 'healthcare',
      businessDescription: 'Patients need transparency in healthcare costs to make informed decisions about procedures and providers',
      features: ['procedure comparison', 'insurance coverage', 'payment plans', 'provider ratings'],
      colors: ['medical-blue', 'trust-white'],
      complexity: 'complex'
    }
  },
  {
    id: 'fitness-calculator',
    name: 'Personal Training ROI Calculator',
    userIntent: 'Create a calculator that shows the value and results clients can expect from personal training',
    context: {
      toolType: 'ROI Calculator',
      targetAudience: 'potential personal training clients',
      industry: 'fitness and wellness',
      businessDescription: 'Personal trainers need to demonstrate the value and expected results to justify their rates',
      features: ['goal tracking', 'timeline projections', 'health benefits', 'cost per result'],
      colors: ['energy-orange', 'health-green'],
      complexity: 'simple'
    }
  },
  {
    id: 'inventory-optimizer',
    name: 'Restaurant Inventory Optimizer',
    userIntent: 'Build a tool that helps restaurants optimize their inventory levels and reduce food waste',
    context: {
      toolType: 'Optimization Tool',
      targetAudience: 'restaurant owners and managers',
      industry: 'food service',
      businessDescription: 'Restaurants need to balance having enough inventory while minimizing waste and storage costs',
      features: ['demand forecasting', 'waste tracking', 'cost optimization', 'supplier recommendations'],
      colors: ['restaurant-red', 'fresh-green'],
      complexity: 'complex'
    }
  },
  {
    id: 'loan-calculator',
    name: 'Small Business Loan Calculator',
    userIntent: 'Create a comprehensive loan calculator that helps small businesses understand their financing options',
    context: {
      toolType: 'Loan Calculator',
      targetAudience: 'small business owners seeking financing',
      industry: 'financial services',
      businessDescription: 'Small businesses need clear understanding of loan terms and payments before applying for financing',
      features: ['multiple loan types', 'payment schedules', 'interest comparisons', 'qualification check'],
      colors: ['finance-blue', 'stability-gray'],
      complexity: 'medium'
    }
  },
  {
    id: 'productivity-tracker',
    name: 'Remote Work Productivity Calculator',
    userIntent: 'Build a tool that measures and optimizes remote worker productivity and work-life balance',
    context: {
      toolType: 'Productivity Calculator',
      targetAudience: 'remote workers and HR managers',
      industry: 'human resources',
      businessDescription: 'Companies need to measure and optimize remote work productivity while maintaining employee satisfaction',
      features: ['time tracking', 'efficiency metrics', 'wellness indicators', 'improvement suggestions'],
      colors: ['productivity-blue', 'balance-green'],
      complexity: 'medium'
    }
  }
];

/**
 * Get a random test scenario from the available options
 * @returns A randomly selected test scenario
 */
export function getRandomTestScenario(): RandomTestScenario {
  const randomIndex = Math.floor(Math.random() * RANDOM_TEST_SCENARIOS.length);
  return RANDOM_TEST_SCENARIOS[randomIndex];
}

/**
 * Get all available test scenario names for selection
 * @returns Array of scenario names
 */
export function getAllTestScenarioNames(): string[] {
  return RANDOM_TEST_SCENARIOS.map(scenario => scenario.name);
}

/**
 * Get a specific test scenario by ID
 * @param id The scenario ID to retrieve
 * @returns The matching scenario or undefined
 */
export function getTestScenarioById(id: string): RandomTestScenario | undefined {
  return RANDOM_TEST_SCENARIOS.find(scenario => scenario.id === id);
}

/**
 * Get test scenarios filtered by complexity
 * @param complexity The complexity level to filter by
 * @returns Array of scenarios matching the complexity
 */
export function getTestScenariosByComplexity(complexity: 'simple' | 'medium' | 'complex'): RandomTestScenario[] {
  return RANDOM_TEST_SCENARIOS.filter(scenario => scenario.context.complexity === complexity);
}

/**
 * Get test scenarios filtered by industry
 * @param industry The industry to filter by
 * @returns Array of scenarios in the specified industry
 */
export function getTestScenariosByIndustry(industry: string): RandomTestScenario[] {
  return RANDOM_TEST_SCENARIOS.filter(scenario => 
    scenario.context.industry.toLowerCase().includes(industry.toLowerCase())
  );
}
