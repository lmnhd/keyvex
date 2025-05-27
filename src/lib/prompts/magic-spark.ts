// TODO: Define comprehensive prompts for Magic Spark Agent

export const MAGIC_SPARK_PROMPTS = {
  /**
   * System prompt for Magic Spark Agent
   * TODO: Refine system prompt for optimal performance
   */
  SYSTEM_PROMPT: `You are the Magic Spark Agent, an expert AI assistant specialized in generating innovative tool suggestions for independent consultants, coaches, and B2B service providers.

Your role is to:
1. Analyze user expertise and target audience
2. Generate creative, practical tool suggestions
3. Assess complexity and feasibility
4. Provide clear value propositions
5. Inspire users with actionable ideas

Guidelines:
- Focus on lead generation and client engagement
- Ensure tools are practical and implementable
- Consider the user's expertise level and industry
- Suggest tools that provide clear business value
- Be creative but realistic in suggestions

Always respond with structured, actionable suggestions that users can immediately understand and get excited about.`,

  /**
   * Initial tool suggestion prompt
   * TODO: Optimize for better suggestion quality
   */
  INITIAL_SUGGESTION: `Based on the following information, generate 3-5 innovative interactive tool suggestions:

User Expertise: {expertise}
Target Audience: {targetAudience}
Industry: {industry}
Business Goals: {goals}

For each suggestion, provide:
1. Tool Type (calculator, quiz, or assessment)
2. Compelling Title
3. Clear Description (2-3 sentences)
4. Target Audience Alignment
5. Estimated Completion Time (5-15 minutes)
6. Complexity Level (simple, medium, complex)
7. Key Value Proposition
8. 3-5 Sample Questions
9. Business Impact Potential

Focus on tools that:
- Address real pain points
- Generate qualified leads
- Showcase expertise
- Provide immediate value
- Are shareable and engaging

Format your response as a structured JSON array.`,

  /**
   * Suggestion refinement prompt
   * TODO: Enhance refinement logic
   */
  REFINEMENT: `Refine the following tool suggestion based on user feedback:

Original Suggestion:
{originalSuggestion}

User Feedback:
{userFeedback}

Please:
1. Analyze the feedback and identify specific improvement areas
2. Adjust the tool concept accordingly
3. Maintain the core value proposition
4. Ensure the refined version addresses the feedback
5. Keep the tool practical and implementable

Return the refined suggestion in the same structured format, highlighting what changed and why.`,

  /**
   * Prototype generation prompt
   * TODO: Improve prototype structure
   */
  PROTOTYPE_GENERATION: `Create a detailed prototype framework for this tool suggestion:

Tool Suggestion:
{suggestion}

Generate a comprehensive framework including:

1. METHODOLOGY:
   - Core approach or framework
   - Theoretical foundation
   - Step-by-step process
   - Key principles

2. QUESTION STRUCTURE:
   - 8-12 strategic questions
   - Question types and formats
   - Logical flow and progression
   - Validation requirements

3. SCORING SYSTEM:
   - Scoring methodology
   - Point allocation
   - Weighting factors
   - Result calculation

4. RESULT CATEGORIES:
   - 3-5 meaningful result types
   - Score ranges for each
   - Actionable recommendations
   - Next steps for users

5. BUSINESS INTEGRATION:
   - Lead capture strategy
   - Follow-up opportunities
   - Upsell potential
   - Content marketing angles

Ensure the prototype is immediately actionable and aligns with the user's expertise and business goals.`,

  /**
   * Feasibility validation prompt
   * TODO: Add comprehensive validation criteria
   */
  FEASIBILITY_VALIDATION: `Evaluate the feasibility of this tool suggestion:

Tool Suggestion:
{suggestion}

User Context:
- Expertise Level: {expertiseLevel}
- Available Time: {timeAvailable}
- Technical Skills: {technicalSkills}
- Target Complexity: {targetComplexity}

Assess the following factors:
1. Implementation Complexity (1-10 scale)
2. Time to Create (hours estimate)
3. Required Expertise Level
4. Technical Requirements
5. Market Demand Potential
6. Competitive Landscape
7. Monetization Potential
8. Maintenance Requirements

Provide:
- Overall Feasibility Score (1-10)
- Key Challenges and Risks
- Recommended Modifications
- Alternative Approaches
- Success Probability Assessment

Be honest about limitations while providing constructive guidance.`,

  /**
   * Similar examples prompt
   * TODO: Enhance example retrieval logic
   */
  SIMILAR_EXAMPLES: `Find and describe similar tools for inspiration:

Tool Type: {toolType}
Industry: {industry}
Target Audience: {targetAudience}

Provide 3-5 examples of similar tools that:
1. Serve the same industry or audience
2. Use similar methodologies
3. Have proven success
4. Offer inspiration for improvement

For each example, include:
- Tool name and type
- Core methodology
- Key features
- Success metrics (if available)
- What makes it effective
- Lessons for our tool

Focus on tools that demonstrate best practices and innovative approaches while being relevant to the user's context.`,

  /**
   * Value proposition enhancement prompt
   * TODO: Strengthen value proposition generation
   */
  VALUE_PROPOSITION: `Enhance the value proposition for this tool:

Tool Concept:
{toolConcept}

Target Audience:
{targetAudience}

Create compelling value propositions that address:

1. PAIN POINTS:
   - What specific problems does this solve?
   - What frustrations does it eliminate?
   - What gaps does it fill?

2. BENEFITS:
   - Immediate value provided
   - Long-term advantages
   - Competitive differentiation

3. OUTCOMES:
   - Measurable results
   - Success metrics
   - ROI potential

4. EMOTIONAL APPEAL:
   - How does it make users feel?
   - What aspirations does it fulfill?
   - What fears does it address?

5. SOCIAL PROOF:
   - Why others would recommend it
   - Shareability factors
   - Viral potential

Craft 3 different value proposition angles: rational, emotional, and social.`
};

// TODO: Add industry-specific prompt variations
// TODO: Create prompt templates for different tool types
// TODO: Implement dynamic prompt generation based on context
// TODO: Add A/B testing prompts for optimization
// TODO: Create multilingual prompt versions 