// User Behavior Learning System
// Tracks interactions, analyzes patterns, and builds user profiles for better AI responses

export interface UserInteraction {
  id: string;
  userId: string;
  sessionId: string;
  timestamp: number;
  
  // Interaction details
  interactionType: 'question_response' | 'tool_selection' | 'workflow_choice' | 'custom_input' | 'edit_previous' | 'tool_generation_result';
  questionId?: string;
  questionType?: string; // 'select', 'multiSelect', 'colorSelect', etc.
  userResponse: string;
  responseTime: number; // milliseconds
  
  // Context
  currentStep: number;
  totalSteps: number;
  workflowType: 'standard' | 'iterator_test' | 'ai_mode';
  isMultiPart: boolean;
  
  // User behavior indicators
  usedSuggestions: boolean;
  usedCustomInput: boolean;
  editedPrevious: boolean;
  switchedToChat: boolean;
  
  // Quality metrics
  confidence?: number; // How confident the user seemed (based on response time, edits)
  satisfaction?: number; // Derived from subsequent actions
}

export interface UserProfile {
  userId: string;
  createdAt: number;
  lastUpdated: number;
  totalInteractions: number;
  
  // Workflow preferences
  preferredInputTypes: string[]; // Ranked by frequency of use
  averageResponseTime: number;
  prefersStructuredQuestions: boolean; // vs freeform
  likelyToEditAnswers: boolean;
  prefersIteratorMode: boolean;
  
  // Decision patterns
  reliesOnSuggestions: number; // 0-1 score
  explorationTendency: number; // How often they try custom options
  patienceLevel: number; // Tolerance for multi-step processes
  
  // Content preferences
  preferredComplexity: 'simple' | 'medium' | 'complex';
  industryFocus?: string;
  commonTopics: string[];
  
  // Adaptive suggestions
  suggestedWorkflow: 'guided' | 'flexible' | 'expert';
  recommendedQuestionTypes: string[];
  optimalStepCount: number;
  
  // Learning metadata
  analysisVersion: string;
  confidenceScore: number; // How reliable this profile is
  
  // Evolution tracking (NEW)
  evolutionHistory: UserEvolution[];
  lastEvolutionCheck: number;
}

export interface BehaviorAnalysis {
  userId: string;
  analysisDate: number;
  interactionCount: number;
  analysisId: string; // NEW: Unique identifier for this analysis
  version: string; // NEW: Analysis algorithm version
  
  // Patterns discovered
  patterns: {
    responseSpeed: 'fast' | 'moderate' | 'deliberate';
    editingFrequency: 'low' | 'medium' | 'high';
    explorationLevel: 'conservative' | 'balanced' | 'experimental';
    workflowPreference: 'linear' | 'non-linear' | 'mixed';
  };
  
  // Recommendations for AI adaptation
  recommendations: {
    questionComplexity: 'reduce' | 'maintain' | 'increase';
    suggestionCount: number;
    enableQuickMode: boolean;
    showAdvancedOptions: boolean;
  };
  
  // Evolution comparison (NEW)
  evolution?: BehaviorEvolution;
  previousAnalysisId?: string;
}

// NEW: Evolution tracking interfaces
export interface BehaviorEvolution {
  responseSpeedTrend: 'faster' | 'slower' | 'stable';
  explorationTrend: 'more_experimental' | 'more_conservative' | 'stable';
  patienceTrend: 'more_patient' | 'less_patient' | 'stable';
  editingTrend: 'more_editing' | 'less_editing' | 'stable';
  workflowTrend: 'more_linear' | 'more_flexible' | 'stable';
  
  // Magnitude of changes (0-1)
  changeIntensity: {
    responseSpeed: number;
    exploration: number;
    patience: number;
    editing: number;
    workflow: number;
  };
  
  // Summary
  overallTrend: 'becoming_expert' | 'becoming_beginner' | 'stable' | 'inconsistent';
  confidenceInTrend: number; // 0-1
}

export interface UserEvolution {
  date: number;
  analysisId: string;
  previousAnalysisId?: string;
  evolution: BehaviorEvolution;
  keyChanges: string[]; // Human-readable change descriptions
  triggeringEvents?: string[]; // What might have caused the changes
}

// NEW: Analysis history storage
export interface AnalysisHistoryEntry {
  analysisId: string;
  userId: string;
  timestamp: number;
  version: string;
  analysis: BehaviorAnalysis;
  interactionCountAtTime: number;
  sessionCountAtTime: number;
}

export class UserBehaviorTracker {
  private interactions: UserInteraction[] = [];
  private currentSession: string;
  private userId: string;
  private sessionStartTime: number;
  
  // Configuration
  private readonly ANALYSIS_THRESHOLD = 10; // Analyze after N interactions
  private readonly MIN_PROFILE_INTERACTIONS = 5; // Minimum for reliable profile
  private readonly EVOLUTION_CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
  private readonly ANALYSIS_VERSION = '1.1.0'; // NEW: Version tracking
  
  constructor(userId: string) {
    this.userId = userId;
    this.currentSession = this.generateSessionId();
    this.sessionStartTime = Date.now();
  }
  
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Track a user interaction
   */
  trackInteraction(interaction: Omit<UserInteraction, 'id' | 'userId' | 'sessionId' | 'timestamp'>): void {
    const fullInteraction: UserInteraction = {
      id: `interaction_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      userId: this.userId,
      sessionId: this.currentSession,
      timestamp: Date.now(),
      ...interaction
    };
    
    this.interactions.push(fullInteraction);
    
    // Store in localStorage for persistence (in real app, send to database)
    this.persistInteraction(fullInteraction);
    
    // Check if we should analyze
    if (this.interactions.length % this.ANALYSIS_THRESHOLD === 0) {
      this.triggerAnalysis();
    }
  }
  
  /**
   * Track question response with timing
   */
  trackQuestionResponse(params: {
    questionId: string;
    questionType: string;
    userResponse: string;
    responseStartTime: number;
    currentStep: number;
    totalSteps: number;
    workflowType: 'standard' | 'iterator_test' | 'ai_mode';
    isMultiPart: boolean;
    usedSuggestions: boolean;
    usedCustomInput: boolean;
  }): void {
    const responseTime = Date.now() - params.responseStartTime;
    
    this.trackInteraction({
      interactionType: 'question_response',
      questionId: params.questionId,
      questionType: params.questionType,
      userResponse: params.userResponse,
      responseTime,
      currentStep: params.currentStep,
      totalSteps: params.totalSteps,
      workflowType: params.workflowType,
      isMultiPart: params.isMultiPart,
      usedSuggestions: params.usedSuggestions,
      usedCustomInput: params.usedCustomInput,
      editedPrevious: false,
      switchedToChat: false,
      confidence: this.calculateConfidence(responseTime, params.usedCustomInput)
    });
  }
  
  /**
   * Track when user edits a previous answer
   */
  trackEdit(questionId: string, newValue: string): void {
    this.trackInteraction({
      interactionType: 'edit_previous',
      questionId,
      userResponse: newValue,
      responseTime: 0,
      currentStep: 0,
      totalSteps: 0,
      workflowType: 'standard',
      isMultiPart: false,
      usedSuggestions: false,
      usedCustomInput: false,
      editedPrevious: true,
      switchedToChat: false
    });
  }
  
  /**
   * Track when user switches to chat mode
   */
  trackChatMode(): void {
    this.trackInteraction({
      interactionType: 'workflow_choice',
      userResponse: 'switched_to_chat',
      responseTime: 0,
      currentStep: 0,
      totalSteps: 0,
      workflowType: 'ai_mode',
      isMultiPart: false,
      usedSuggestions: false,
      usedCustomInput: false,
      editedPrevious: false,
      switchedToChat: true
    });
  }
  
  /**
   * NEW: Track the result of a tool generation attempt
   */
  trackToolGeneration(params: {
    toolDefinitionId: string;
    toolName: string;
    toolType: string;
    context: any; // The context/prompt used for generation
    success: boolean;
    error?: string; // Error message if not successful
    componentCode?: string; // Optional: the generated code if successful
    duration?: number; // Optional: time taken for generation
  }): void {
    this.trackInteraction({
      interactionType: 'tool_generation_result',
      userResponse: params.success ? 'success' : 'failure', // Or more detailed status
      responseTime: params.duration || 0, // Use generation duration if available
      // Add specific fields for tool generation if needed in UserInteraction,
      // or store them in a generic 'details' object.
      // For now, we'll rely on the basic fields and log context.
      // Consider adding 'details: params' if more data needs to be stored directly.
      // For simplicity here, critical info like success/error is mapped.
      // The 'context' and other params might be logged server-side or via a different mechanism
      // if not directly fitting into UserInteraction structure without major changes.
      // Let's put stringified details for now if we need more than success/failure status.
      // For example:
      // userResponse: JSON.stringify({ success: params.success, toolName: params.toolName, error: params.error }),
      currentStep: 0, // Not applicable or could be set based on workflow context
      totalSteps: 0, // Not applicable
      workflowType: 'ai_mode', // Assuming tool generation is an AI-driven workflow
      isMultiPart: false,
      usedSuggestions: false,
      usedCustomInput: false,
      editedPrevious: false,
      switchedToChat: false,
    });
    // Log extended details separately if needed, e.g., to a dedicated analytics stream
    console.log('Tool Generation Tracked:', params);
  }
  
  private calculateConfidence(responseTime: number, usedCustomInput: boolean): number {
    // Quick responses with suggestions = high confidence
    // Slow responses with custom input = lower confidence (more deliberation)
    let confidence = 0.5; // baseline
    
    if (responseTime < 3000) confidence += 0.3; // Fast response
    else if (responseTime > 10000) confidence -= 0.2; // Very slow response
    
    if (usedCustomInput) confidence -= 0.1; // Custom input shows less certainty
    
    return Math.max(0, Math.min(1, confidence));
  }
  
  private persistInteraction(interaction: UserInteraction): void {
    // In a real app, this would go to your database
    // For now, use localStorage with a rolling buffer
    const stored = localStorage.getItem(`user_interactions_${this.userId}`) || '[]';
    const interactions = JSON.parse(stored);
    
    interactions.push(interaction);
    
    // Keep only last 100 interactions to prevent localStorage bloat
    if (interactions.length > 100) {
      interactions.splice(0, interactions.length - 100);
    }
    
    localStorage.setItem(`user_interactions_${this.userId}`, JSON.stringify(interactions));
  }
  
  // NEW: Store analysis history
  private persistAnalysisHistory(analysis: BehaviorAnalysis): void {
    const historyEntry: AnalysisHistoryEntry = {
      analysisId: analysis.analysisId,
      userId: this.userId,
      timestamp: analysis.analysisDate,
      version: analysis.version,
      analysis,
      interactionCountAtTime: this.getAllUserInteractions().length,
      sessionCountAtTime: this.getSessionCount()
    };
    
    const stored = localStorage.getItem(`analysis_history_${this.userId}`) || '[]';
    const history: AnalysisHistoryEntry[] = JSON.parse(stored);
    
    history.push(historyEntry);
    
    // Keep last 50 analyses
    if (history.length > 50) {
      history.splice(0, history.length - 50);
    }
    
    localStorage.setItem(`analysis_history_${this.userId}`, JSON.stringify(history));
  }
  
  // NEW: Get analysis history
  getAnalysisHistory(): AnalysisHistoryEntry[] {
    const stored = localStorage.getItem(`analysis_history_${this.userId}`) || '[]';
    return JSON.parse(stored);
  }
  
  // NEW: Get latest analysis for comparison
  private getLatestAnalysis(): BehaviorAnalysis | null {
    const history = this.getAnalysisHistory();
    return history.length > 0 ? history[history.length - 1].analysis : null;
  }
  
  private getSessionCount(): number {
    const interactions = this.getAllUserInteractions();
    const uniqueSessions = new Set(interactions.map(i => i.sessionId));
    return uniqueSessions.size;
  }
  
  private async triggerAnalysis(): Promise<void> {
    console.log('🧠 Triggering user behavior analysis...');
    
    try {
      const analysis = await this.analyzeUserBehavior();
      
      // Store in analysis history
      this.persistAnalysisHistory(analysis);
      
      // Update user profile with evolution data
      const profile = await this.updateUserProfile(analysis);
      
      console.log('📊 User behavior analysis complete:', analysis);
      console.log('👤 Updated user profile:', profile);
      
      // In real app, send to your analytics/ML service
      // await this.sendToAnalyticsService(analysis, profile);
      
    } catch (error) {
      console.error('❌ Behavior analysis failed:', error);
    }
  }
  
  /**
   * Analyze user behavior patterns with evolution tracking
   */
  private async analyzeUserBehavior(): Promise<BehaviorAnalysis> {
    const recentInteractions = this.interactions.slice(-this.ANALYSIS_THRESHOLD);
    const analysisId = `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    
    // Analyze response speed
    const responseTimes = recentInteractions
      .filter(i => i.interactionType === 'question_response')
      .map(i => i.responseTime);
    const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    
    // Analyze editing frequency
    const editCount = recentInteractions.filter(i => i.editedPrevious).length;
    const editingFrequency = editCount / recentInteractions.length;
    
    // Analyze exploration (custom inputs)
    const customInputCount = recentInteractions.filter(i => i.usedCustomInput).length;
    const explorationLevel = customInputCount / recentInteractions.length;
    
    // Analyze workflow linearity
    const workflowJumps = recentInteractions.filter(i => i.switchedToChat || i.editedPrevious).length;
    const workflowLinearity = 1 - (workflowJumps / recentInteractions.length);
    
    // NEW: Get previous analysis for comparison
    const previousAnalysis = this.getLatestAnalysis();
    let evolution: BehaviorEvolution | undefined;
    
    if (previousAnalysis) {
      evolution = this.calculateEvolution(previousAnalysis, {
        responseSpeed: avgResponseTime < 5000 ? 'fast' : avgResponseTime < 15000 ? 'moderate' : 'deliberate',
        editingFrequency: editingFrequency < 0.1 ? 'low' : editingFrequency < 0.3 ? 'medium' : 'high',
        explorationLevel: explorationLevel < 0.2 ? 'conservative' : explorationLevel < 0.5 ? 'balanced' : 'experimental',
        workflowPreference: workflowLinearity > 0.8 ? 'linear' : workflowLinearity > 0.5 ? 'mixed' : 'non-linear'
      });
    }
    
    return {
      userId: this.userId,
      analysisDate: Date.now(),
      interactionCount: recentInteractions.length,
      analysisId,
      version: this.ANALYSIS_VERSION,
      patterns: {
        responseSpeed: avgResponseTime < 5000 ? 'fast' : avgResponseTime < 15000 ? 'moderate' : 'deliberate',
        editingFrequency: editingFrequency < 0.1 ? 'low' : editingFrequency < 0.3 ? 'medium' : 'high',
        explorationLevel: explorationLevel < 0.2 ? 'conservative' : explorationLevel < 0.5 ? 'balanced' : 'experimental',
        workflowPreference: workflowLinearity > 0.8 ? 'linear' : workflowLinearity > 0.5 ? 'mixed' : 'non-linear'
      },
      recommendations: {
        questionComplexity: explorationLevel > 0.4 ? 'increase' : explorationLevel < 0.2 ? 'reduce' : 'maintain',
        suggestionCount: explorationLevel < 0.3 ? 6 : 4, // More suggestions for conservative users
        enableQuickMode: avgResponseTime < 3000 && editingFrequency < 0.1,
        showAdvancedOptions: explorationLevel > 0.5
      },
      evolution,
      previousAnalysisId: previousAnalysis?.analysisId
    };
  }
  
  // NEW: Calculate behavior evolution
  private calculateEvolution(previousAnalysis: BehaviorAnalysis, currentPatterns: any): BehaviorEvolution {
    const prev = previousAnalysis.patterns;
    const curr = currentPatterns;
    
    // Calculate trends
    const responseSpeedTrend = this.calculateTrend(prev.responseSpeed, curr.responseSpeed, ['fast', 'moderate', 'deliberate']);
    const explorationTrend = this.calculateTrend(prev.explorationLevel, curr.explorationLevel, ['conservative', 'balanced', 'experimental']);
    const editingTrend = this.calculateTrend(prev.editingFrequency, curr.editingFrequency, ['low', 'medium', 'high']);
    const workflowTrend = this.calculateWorkflowTrend(prev.workflowPreference, curr.workflowPreference);
    
    // Calculate change intensities (simplified)
    const changeIntensity = {
      responseSpeed: responseSpeedTrend === 'stable' ? 0 : 0.5,
      exploration: explorationTrend === 'stable' ? 0 : 0.5,
      patience: 0.3, // Placeholder - would be calculated from actual patience metrics
      editing: editingTrend === 'stable' ? 0 : 0.5,
      workflow: workflowTrend === 'stable' ? 0 : 0.5
    };
    
    // Determine overall trend
    const totalChange = Object.values(changeIntensity).reduce((a, b) => a + b, 0);
    let overallTrend: 'becoming_expert' | 'becoming_beginner' | 'stable' | 'inconsistent';
    
    if (totalChange < 0.5) {
      overallTrend = 'stable';
    } else if (explorationTrend === 'more_experimental' && responseSpeedTrend === 'faster') {
      overallTrend = 'becoming_expert';
    } else if (explorationTrend === 'more_conservative' && editingTrend === 'more_editing') {
      overallTrend = 'becoming_beginner';
    } else {
      overallTrend = 'inconsistent';
    }
    
    return {
      responseSpeedTrend: responseSpeedTrend as any,
      explorationTrend: explorationTrend as any,
      patienceTrend: 'stable', // Simplified for now
      editingTrend: editingTrend as any,
      workflowTrend: workflowTrend as any,
      changeIntensity,
      overallTrend,
      confidenceInTrend: Math.min(1, this.getAllUserInteractions().length / 50) // More data = more confidence
    };
  }
  
  private calculateTrend(previous: string, current: string, scale: string[]): string {
    const prevIndex = scale.indexOf(previous);
    const currIndex = scale.indexOf(current);
    
    if (currIndex > prevIndex) return scale.length === 3 ? 'more_' + scale[scale.length - 1].replace('deliberate', 'experimental') : 'increasing';
    if (currIndex < prevIndex) return scale.length === 3 ? 'more_' + scale[0] : 'decreasing';
    return 'stable';
  }
  
  private calculateWorkflowTrend(previous: string, current: string): string {
    if (previous === 'linear' && current !== 'linear') return 'more_flexible';
    if (previous !== 'linear' && current === 'linear') return 'more_linear';
    return 'stable';
  }
  
  /**
   * Update or create user profile with evolution tracking
   */
  private async updateUserProfile(analysis: BehaviorAnalysis): Promise<UserProfile> {
    // Get existing profile or create new one
    const existingProfile = this.getStoredProfile();
    const allInteractions = this.getAllUserInteractions();
    
    // NEW: Check if we need to record evolution
    let evolutionHistory = existingProfile?.evolutionHistory || [];
    const shouldRecordEvolution = !existingProfile?.lastEvolutionCheck || 
      (Date.now() - existingProfile.lastEvolutionCheck) > this.EVOLUTION_CHECK_INTERVAL;
    
    if (shouldRecordEvolution && analysis.evolution) {
      const evolutionEntry: UserEvolution = {
        date: Date.now(),
        analysisId: analysis.analysisId,
        previousAnalysisId: analysis.previousAnalysisId,
        evolution: analysis.evolution,
        keyChanges: this.generateKeyChanges(analysis.evolution),
        triggeringEvents: this.identifyTriggeringEvents(allInteractions)
      };
      
      evolutionHistory.push(evolutionEntry);
      
      // Keep last 20 evolution entries
      if (evolutionHistory.length > 20) {
        evolutionHistory = evolutionHistory.slice(-20);
      }
    }
    
    const profile: UserProfile = {
      userId: this.userId,
      createdAt: existingProfile?.createdAt || Date.now(),
      lastUpdated: Date.now(),
      totalInteractions: allInteractions.length,
      
      // Calculate preferences from all interactions
      preferredInputTypes: this.calculatePreferredInputTypes(allInteractions),
      averageResponseTime: this.calculateAverageResponseTime(allInteractions),
      prefersStructuredQuestions: this.calculateStructuredPreference(allInteractions),
      likelyToEditAnswers: analysis.patterns.editingFrequency !== 'low',
      prefersIteratorMode: this.calculateIteratorPreference(allInteractions),
      
      reliesOnSuggestions: this.calculateSuggestionReliance(allInteractions),
      explorationTendency: this.calculateExplorationTendency(allInteractions),
      patienceLevel: this.calculatePatienceLevel(allInteractions),
      
      preferredComplexity: this.determineComplexityPreference(analysis),
      commonTopics: this.extractCommonTopics(allInteractions),
      
      suggestedWorkflow: this.recommendWorkflow(analysis),
      recommendedQuestionTypes: this.recommendQuestionTypes(analysis),
      optimalStepCount: this.calculateOptimalStepCount(allInteractions),
      
      analysisVersion: this.ANALYSIS_VERSION,
      confidenceScore: Math.min(1, allInteractions.length / 20), // Higher confidence with more data
      
      // NEW: Evolution tracking
      evolutionHistory,
      lastEvolutionCheck: shouldRecordEvolution ? Date.now() : (existingProfile?.lastEvolutionCheck || Date.now())
    };
    
    // Store updated profile
    localStorage.setItem(`user_profile_${this.userId}`, JSON.stringify(profile));
    
    return profile;
  }
  
  // NEW: Generate human-readable key changes
  private generateKeyChanges(evolution: BehaviorEvolution): string[] {
    const changes: string[] = [];
    
    if (evolution.responseSpeedTrend !== 'stable') {
      changes.push(`Response speed became ${evolution.responseSpeedTrend === 'faster' ? 'faster' : 'slower'}`);
    }
    
    if (evolution.explorationTrend !== 'stable') {
      changes.push(`Became ${evolution.explorationTrend.replace('more_', '')} with features`);
    }
    
    if (evolution.editingTrend !== 'stable') {
      changes.push(`${evolution.editingTrend === 'more_editing' ? 'Increased' : 'Decreased'} answer editing`);
    }
    
    if (evolution.workflowTrend !== 'stable') {
      changes.push(`Workflow preference became ${evolution.workflowTrend.replace('more_', '')}`);
    }
    
    return changes;
  }
  
  // NEW: Identify what might have triggered behavior changes
  private identifyTriggeringEvents(interactions: UserInteraction[]): string[] {
    const recentEvents: string[] = [];
    const recent = interactions.slice(-20); // Last 20 interactions
    
    // Look for patterns that might explain changes
    const multiPartCount = recent.filter(i => i.isMultiPart).length;
    const chatSwitches = recent.filter(i => i.switchedToChat).length;
    const editCount = recent.filter(i => i.editedPrevious).length;
    
    if (multiPartCount > 5) recentEvents.push('Heavy use of multi-part questions');
    if (chatSwitches > 2) recentEvents.push('Multiple switches to chat mode');
    if (editCount > 3) recentEvents.push('Frequent answer editing');
    
    return recentEvents;
  }
  
  private getStoredProfile(): UserProfile | null {
    const stored = localStorage.getItem(`user_profile_${this.userId}`);
    return stored ? JSON.parse(stored) : null;
  }
  
  private getAllUserInteractions(): UserInteraction[] {
    const stored = localStorage.getItem(`user_interactions_${this.userId}`) || '[]';
    return JSON.parse(stored);
  }
  
  // Helper methods for profile calculations
  private calculatePreferredInputTypes(interactions: UserInteraction[]): string[] {
    const typeCounts: Record<string, number> = {};
    
    interactions
      .filter(i => i.questionType)
      .forEach(i => {
        typeCounts[i.questionType!] = (typeCounts[i.questionType!] || 0) + 1;
      });
    
    return Object.entries(typeCounts)
      .sort(([,a], [,b]) => b - a)
      .map(([type]) => type);
  }
  
  private calculateAverageResponseTime(interactions: UserInteraction[]): number {
    const responseTimes = interactions
      .filter(i => i.interactionType === 'question_response')
      .map(i => i.responseTime);
    
    return responseTimes.length > 0 
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length 
      : 5000;
  }
  
  private calculateStructuredPreference(interactions: UserInteraction[]): boolean {
    const chatSwitches = interactions.filter(i => i.switchedToChat).length;
    return chatSwitches / interactions.length < 0.3; // Less than 30% chat switches = prefers structure
  }
  
  private calculateIteratorPreference(interactions: UserInteraction[]): boolean {
    const iteratorInteractions = interactions.filter(i => i.workflowType === 'iterator_test').length;
    return iteratorInteractions / interactions.length > 0.5;
  }
  
  private calculateSuggestionReliance(interactions: UserInteraction[]): number {
    const questionResponses = interactions.filter(i => i.interactionType === 'question_response');
    if (questionResponses.length === 0) return 0.5;
    
    const suggestionUses = questionResponses.filter(i => i.usedSuggestions).length;
    return suggestionUses / questionResponses.length;
  }
  
  private calculateExplorationTendency(interactions: UserInteraction[]): number {
    const questionResponses = interactions.filter(i => i.interactionType === 'question_response');
    if (questionResponses.length === 0) return 0.5;
    
    const customInputUses = questionResponses.filter(i => i.usedCustomInput).length;
    return customInputUses / questionResponses.length;
  }
  
  private calculatePatienceLevel(interactions: UserInteraction[]): number {
    const multiPartInteractions = interactions.filter(i => i.isMultiPart).length;
    const chatSwitches = interactions.filter(i => i.switchedToChat).length;
    
    // High patience = comfortable with multi-part, low chat switches
    const patienceScore = (multiPartInteractions / interactions.length) - (chatSwitches / interactions.length);
    return Math.max(0, Math.min(1, patienceScore + 0.5));
  }
  
  private determineComplexityPreference(analysis: BehaviorAnalysis): 'simple' | 'medium' | 'complex' {
    if (analysis.patterns.explorationLevel === 'experimental' && analysis.patterns.responseSpeed !== 'fast') {
      return 'complex';
    }
    if (analysis.patterns.explorationLevel === 'conservative' && analysis.patterns.responseSpeed === 'fast') {
      return 'simple';
    }
    return 'medium';
  }
  
  private extractCommonTopics(interactions: UserInteraction[]): string[] {
    // This would analyze the userResponse content for common themes
    // For now, return empty array - in real implementation, use NLP
    return [];
  }
  
  private recommendWorkflow(analysis: BehaviorAnalysis): 'guided' | 'flexible' | 'expert' {
    if (analysis.patterns.explorationLevel === 'experimental' && analysis.patterns.editingFrequency === 'low') {
      return 'expert';
    }
    if (analysis.patterns.workflowPreference === 'linear' && analysis.patterns.explorationLevel === 'conservative') {
      return 'guided';
    }
    return 'flexible';
  }
  
  private recommendQuestionTypes(analysis: BehaviorAnalysis): string[] {
    const recommendations: string[] = [];
    
    if (analysis.patterns.responseSpeed === 'fast') {
      recommendations.push('select', 'yesNoMaybe', 'multiSelect');
    }
    
    if (analysis.patterns.explorationLevel === 'experimental') {
      recommendations.push('textarea', 'colorSelect');
    }
    
    if (analysis.patterns.workflowPreference === 'linear') {
      recommendations.push('multiPart');
    }
    
    return recommendations.length > 0 ? recommendations : ['select', 'textarea'];
  }
  
  private calculateOptimalStepCount(interactions: UserInteraction[]): number {
    // Analyze completion rates vs step counts
    // For now, use reasonable defaults based on patience
    const patienceLevel = this.calculatePatienceLevel(interactions);
    
    if (patienceLevel > 0.7) return 8; // High patience = more steps OK
    if (patienceLevel < 0.3) return 4; // Low patience = fewer steps
    return 6; // Medium patience = medium steps
  }
  
  /**
   * Get current user profile for AI adaptation
   */
  getUserProfile(): UserProfile | null {
    return this.getStoredProfile();
  }
  
  /**
   * Get adaptive suggestions based on user profile
   */
  getAdaptiveSuggestions(): {
    preferQuickMode: boolean;
    showAdvancedOptions: boolean;
    suggestedQuestionTypes: string[];
    recommendedComplexity: string;
    optimalStepCount: number;
  } {
    const profile = this.getUserProfile();
    
    if (!profile || profile.confidenceScore < 0.3) {
      // Default suggestions for new/unknown users
      return {
        preferQuickMode: false,
        showAdvancedOptions: false,
        suggestedQuestionTypes: ['select', 'textarea'],
        recommendedComplexity: 'medium',
        optimalStepCount: 6
      };
    }
    
    return {
      preferQuickMode: profile.averageResponseTime < 5000 && !profile.likelyToEditAnswers,
      showAdvancedOptions: profile.explorationTendency > 0.5,
      suggestedQuestionTypes: profile.recommendedQuestionTypes,
      recommendedComplexity: profile.preferredComplexity,
      optimalStepCount: profile.optimalStepCount
    };
  }
}

// Singleton instance for the current user session
let behaviorTrackerInstance: UserBehaviorTracker | null = null;

export function initBehaviorTracker(userId: string): UserBehaviorTracker {
  behaviorTrackerInstance = new UserBehaviorTracker(userId);
  return behaviorTrackerInstance;
}

export function getBehaviorTracker(): UserBehaviorTracker | null {
  return behaviorTrackerInstance;
}

// TODO: Integration with database/analytics service
// TODO: Add machine learning model integration
// TODO: Add A/B testing for recommendation accuracy
// TODO: Add privacy controls and data retention policies
// TODO: Add cross-session analysis
// TODO: Add collaborative filtering (learn from similar users)

// Production DynamoDB integration methods (to replace localStorage)
// Uncomment and configure these for production use

/*
import { DynamoDBClient, PutItemCommand, QueryCommand, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';

export class ProductionBehaviorTracker extends UserBehaviorTracker {
  private dynamoClient: DynamoDBClient;
  private readonly TABLE_NAME = 'user-behavior-tracking';
  
  constructor(userId: string) {
    super(userId);
    this.dynamoClient = new DynamoDBClient({
      region: process.env.AWS_REGION || 'us-east-1'
    });
  }
  
  // Production storage methods
  async persistInteractionToDB(interaction: UserInteraction): Promise<void> {
    const params = {
      TableName: this.TABLE_NAME,
      Item: marshall({
        PK: `USER#${this.userId}`,
        SK: `INTERACTION#${interaction.timestamp}#${interaction.id}`,
        GSI1PK: `INTERACTION#${interaction.interactionType}`,
        GSI1SK: interaction.timestamp,
        ...interaction,
        TTL: Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60) // 90 days retention
      })
    };
    
    await this.dynamoClient.send(new PutItemCommand(params));
  }
  
  async persistUserProfileToDB(profile: UserProfile): Promise<void> {
    const params = {
      TableName: this.TABLE_NAME,
      Item: marshall({
        PK: `USER#${this.userId}`,
        SK: 'PROFILE#CURRENT',
        ...profile,
        updatedAt: Date.now()
      })
    };
    
    await this.dynamoClient.send(new PutItemCommand(params));
  }
  
  async persistAnalysisHistoryToDB(analysis: AnalysisHistoryEntry): Promise<void> {
    const params = {
      TableName: this.TABLE_NAME,
      Item: marshall({
        PK: `USER#${this.userId}`,
        SK: `ANALYSIS#${analysis.timestamp}#${analysis.analysisId}`,
        GSI1PK: `ANALYSIS#${analysis.version}`,
        GSI1SK: analysis.timestamp,
        ...analysis
      })
    };
    
    await this.dynamoClient.send(new PutItemCommand(params));
  }
  
  async getUserInteractionsFromDB(limit = 100): Promise<UserInteraction[]> {
    const params = {
      TableName: this.TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: marshall({
        ':pk': `USER#${this.userId}`,
        ':sk': 'INTERACTION#'
      }),
      ScanIndexForward: false, // Latest first
      Limit: limit
    };
    
    const result = await this.dynamoClient.send(new QueryCommand(params));
    return result.Items?.map(item => unmarshall(item) as UserInteraction) || [];
  }
  
  async getUserProfileFromDB(): Promise<UserProfile | null> {
    const params = {
      TableName: this.TABLE_NAME,
      Key: marshall({
        PK: `USER#${this.userId}`,
        SK: 'PROFILE#CURRENT'
      })
    };
    
    const result = await this.dynamoClient.send(new GetItemCommand(params));
    return result.Item ? unmarshall(result.Item) as UserProfile : null;
  }
  
  async getAnalysisHistoryFromDB(limit = 50): Promise<AnalysisHistoryEntry[]> {
    const params = {
      TableName: this.TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: marshall({
        ':pk': `USER#${this.userId}`,
        ':sk': 'ANALYSIS#'
      }),
      ScanIndexForward: false, // Latest first
      Limit: limit
    };
    
    const result = await this.dynamoClient.send(new QueryCommand(params));
    return result.Items?.map(item => unmarshall(item) as AnalysisHistoryEntry) || [];
  }
}
*/

// TODO: Replace localStorage methods with DynamoDB in production
// TODO: Add proper error handling and retry logic for DynamoDB operations
// TODO: Implement data encryption for sensitive behavioral data
// TODO: Add batch operations for bulk data processing
// TODO: Configure DynamoDB streams for real-time analytics 