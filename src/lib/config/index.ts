// Configuration exports for easy importing
import toolQualityChecklist from './tool-quality-checklist.json';

export { toolQualityChecklist };

// Type definitions for the quality checklist
export interface ChecklistItem {
  id: string;
  category: string;
  title: string;
  description: string;
  weight: number;
  criticalThresholds: {
    passing: number;
    excellent: number;
  };
  evaluationCriteria: string[];
}

export interface QualityChecklist {
  version: string;
  lastUpdated: string;
  description: string;
  checklistItems: ChecklistItem[];
  scoringSystem: {
    scale: string;
    passingThreshold: number;
    excellenceThreshold: number;
    weights: Record<string, number>;
  };
  iterationGuidelines: {
    maxIterations: number;
    improvementThreshold: number;
    requiresResearch: string[];
  };
  qualityIndicators: Record<string, {
    minScore: number;
    description: string;
  }>;
}

export const getQualityChecklist = (): QualityChecklist => toolQualityChecklist as QualityChecklist;
