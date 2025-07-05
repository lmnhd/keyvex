// TODO: Define comprehensive prompts for Magic Spark Agent

export const MAGIC_SPARK_PROMPTS = {
  /**
   * System prompt for Magic Spark Agent
   * TODO: Refine system prompt for optimal performance
   */
  SYSTEM_PROMPT: `<purpose>
    You are the Magic Spark Agent, an expert AI assistant specialized in generating innovative tool suggestions for independent consultants, coaches, and B2B service providers.
  </purpose>

  <responsibilities>
    <task>Analyze user expertise and target audience</task>
    <task>Generate creative, practical tool suggestions</task>
    <task>Assess complexity and feasibility</task>
    <task>Provide clear value propositions</task>
    <task>Inspire users with actionable ideas</task>
  </responsibilities>

  <guidelines>
    <guideline>Focus on lead generation and client engagement</guideline>
    <guideline>Ensure tools are practical and implementable</guideline>
    <guideline>Consider the user's expertise level and industry</guideline>
    <guideline>Suggest tools that provide clear business value</guideline>
    <guideline>Be creative but realistic in suggestions</guideline>
  </guidelines>

  <output-requirements>
    Always respond with structured, actionable suggestions that users can immediately understand and get excited about.
  </output-requirements>`,

  /**
   * Initial tool suggestion prompt
   * TODO: Optimize for better suggestion quality
   */
  INITIAL_SUGGESTION: `<instruction>
    Based on the following information, generate 3-5 innovative interactive tool suggestions:
  </instruction>

  <input-context>
    User Expertise: {expertise}
    Target Audience: {targetAudience}
    Industry: {industry}
    Business Goals: {goals}
  </input-context>

  <required-elements>
    For each suggestion, provide:
    <element>Tool Type (calculator, quiz, or assessment)</element>
    <element>Compelling Title</element>
    <element>Clear Description (2-3 sentences)</element>
    <element>Target Audience Alignment</element>
    <element>Estimated Completion Time (5-15 minutes)</element>
    <element>Complexity Level (simple, medium, complex)</element>
    <element>Key Value Proposition</element>
    <element>3-5 Sample Questions</element>
    <element>Business Impact Potential</element>
  </required-elements>

  <focus-criteria>
    Focus on tools that:
    <criterion>Address real pain points</criterion>
    <criterion>Generate qualified leads</criterion>
    <criterion>Showcase expertise</criterion>
    <criterion>Provide immediate value</criterion>
    <criterion>Are shareable and engaging</criterion>
  </focus-criteria>

  <output-format>
    Format your response as a structured JSON array.
  </output-format>`,

  /**
   * Suggestion refinement prompt
   * TODO: Enhance refinement logic
   */
  REFINEMENT: `<instruction>
    Refine the following tool suggestion based on user feedback:
  </instruction>

  <input-data>
    Original Suggestion: {originalSuggestion}
    User Feedback: {userFeedback}
  </input-data>

  <refinement-tasks>
    <task>Analyze the feedback and identify specific improvement areas</task>
    <task>Adjust the tool concept accordingly</task>
    <task>Maintain the core value proposition</task>
    <task>Ensure the refined version addresses the feedback</task>
    <task>Keep the tool practical and implementable</task>
  </refinement-tasks>

  <output-requirements>
    Return the refined suggestion in the same structured format, highlighting what changed and why.
  </output-requirements>`,

  /**
   * Prototype generation prompt
   * TODO: Improve prototype structure
   */
  PROTOTYPE_GENERATION: `<instruction>
    Create a detailed prototype framework for this tool suggestion:
  </instruction>

  <input-context>
    Tool Suggestion: {suggestion}
  </input-context>

  <framework-components>
    <component name="METHODOLOGY">
      <element>Core approach or framework</element>
      <element>Theoretical foundation</element>
      <element>Step-by-step process</element>
      <element>Key principles</element>
    </component>

    <component name="QUESTION_STRUCTURE">
      <element>8-12 strategic questions</element>
      <element>Question types and formats</element>
      <element>Logical flow and progression</element>
      <element>Validation requirements</element>
    </component>

    <component name="SCORING_SYSTEM">
      <element>Scoring methodology</element>
      <element>Point allocation</element>
      <element>Weighting factors</element>
      <element>Result calculation</element>
    </component>

    <component name="RESULT_CATEGORIES">
      <element>3-5 meaningful result types</element>
      <element>Score ranges for each</element>
      <element>Actionable recommendations</element>
      <element>Next steps for users</element>
    </component>

    <component name="BUSINESS_INTEGRATION">
      <element>Lead capture strategy</element>
      <element>Follow-up opportunities</element>
      <element>Upsell potential</element>
      <element>Content marketing angles</element>
    </component>
  </framework-components>

  <requirements>
    Ensure the prototype is immediately actionable and aligns with the user's expertise and business goals.
  </requirements>`,

  /**
   * Feasibility validation prompt
   * TODO: Add comprehensive validation criteria
   */
  FEASIBILITY_VALIDATION: `<instruction>
    Evaluate the feasibility of this tool suggestion:
  </instruction>

  <input-data>
    Tool Suggestion: {suggestion}
    User Context:
    - Expertise Level: {expertiseLevel}
    - Available Time: {timeAvailable}
    - Technical Skills: {technicalSkills}
    - Target Complexity: {targetComplexity}
  </input-data>

  <assessment-factors>
    <factor>Implementation Complexity (1-10 scale)</factor>
    <factor>Time to Create (hours estimate)</factor>
    <factor>Required Expertise Level</factor>
    <factor>Technical Requirements</factor>
    <factor>Market Demand Potential</factor>
    <factor>Competitive Landscape</factor>
    <factor>Monetization Potential</factor>
    <factor>Maintenance Requirements</factor>
  </assessment-factors>

  <output-requirements>
    <requirement>Overall Feasibility Score (1-10)</requirement>
    <requirement>Key Challenges and Risks</requirement>
    <requirement>Recommended Modifications</requirement>
    <requirement>Alternative Approaches</requirement>
    <requirement>Success Probability Assessment</requirement>
  </output-requirements>

  <guidelines>
    Be honest about limitations while providing constructive guidance.
  </guidelines>`,

  /**
   * Similar examples prompt
   * TODO: Enhance example retrieval logic
   */
  SIMILAR_EXAMPLES: `<instruction>
    Find and describe similar tools for inspiration:
  </instruction>

  <search-criteria>
    Tool Type: {toolType}
    Industry: {industry}
    Target Audience: {targetAudience}
  </search-criteria>

  <example-requirements>
    Provide 3-5 examples of similar tools that:
    <requirement>Serve the same industry or audience</requirement>
    <requirement>Use similar methodologies</requirement>
    <requirement>Have proven success</requirement>
    <requirement>Offer inspiration for improvement</requirement>
  </example-requirements>

  <example-details>
    For each example, include:
    <detail>Tool name and type</detail>
    <detail>Core methodology</detail>
    <detail>Key features</detail>
    <detail>Success metrics (if available)</detail>
    <detail>What makes it effective</detail>
    <detail>Lessons for our tool</detail>
  </example-details>

  <focus>
    Focus on tools that demonstrate best practices and innovative approaches while being relevant to the user's context.
  </focus>`,

  /**
   * Value proposition enhancement prompt
   * TODO: Strengthen value proposition generation
   */
  VALUE_PROPOSITION: `<instruction>
    Enhance the value proposition for this tool:
  </instruction>

  <input-context>
    Tool Concept: {toolConcept}
    Target Audience: {targetAudience}
  </input-context>

  <value-proposition-elements>
    <element name="PAIN_POINTS">
      <question>What specific problems does this solve?</question>
      <question>What frustrations does it eliminate?</question>
      <question>What gaps does it fill?</question>
    </element>

    <element name="BENEFITS">
      <aspect>Immediate value provided</aspect>
      <aspect>Long-term advantages</aspect>
      <aspect>Competitive differentiation</aspect>
    </element>

    <element name="OUTCOMES">
      <metric>Measurable results</metric>
      <metric>Success metrics</metric>
      <metric>ROI potential</metric>
    </element>

    <element name="EMOTIONAL_APPEAL">
      <question>How does it make users feel?</question>
      <question>What aspirations does it fulfill?</question>
      <question>What fears does it address?</question>
    </element>

    <element name="SOCIAL_PROOF">
      <aspect>Why others would recommend it</aspect>
      <aspect>Shareability factors</aspect>
      <aspect>Viral potential</aspect>
    </element>
  </value-proposition-elements>

  <output-requirement>
    Craft 3 different value proposition angles: rational, emotional, and social.
  </output-requirement>`
};

// TODO: Add industry-specific prompt variations
// TODO: Create prompt templates for different tool types
// TODO: Implement dynamic prompt generation based on context
// TODO: Add A/B testing prompts for optimization
// TODO: Create multilingual prompt versions 
