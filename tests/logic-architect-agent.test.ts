import { LogicArchitectAgent } from "../src/lib/ai/agents/logic-architect";
/// <reference types="jest" />
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import type { z } from "zod";

// Runtime import to avoid circular deps in ts-jest transpilation stage
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { BrainstormDataSchema } = require("../src/app/tests/tool-generation-workbench/types/unified-brainstorm-types");

describe("LogicArchitectAgent – brainstorm generation & validation", () => {
  // Increase timeout because real model calls can be slow
  jest.setTimeout(60_000);

  const hasProviderKey =
    !!process.env.OPENAI_API_KEY || !!process.env.ANTHROPIC_API_KEY;

  (hasProviderKey ? it : it.skip)(
    "generates brainstorm that passes BrainstormDataSchema",
    async () => {
      const agent = new LogicArchitectAgent("auto");

      const brainstorm = await agent.brainstormToolLogic(
        "calculator",
        "growth marketers",
        "business",
        "Help SaaS companies optimise CAC and LTV using interactive calculator tool.",
        {}
      );

      // Should parse without throwing
      expect(() => BrainstormDataSchema.parse(brainstorm)).not.toThrow();
    }
  );

  it("fails validation when required fields are missing", () => {
    // Create an invalid brainstorm by omitting coreConcept
    const invalidBrainstorm: Record<string, unknown> = {
      // coreConcept missing
      keyCalculations: [],
      interactionFlow: [],
      valueProposition: "",
      leadCaptureStrategy: { timing: "", method: "", incentive: "" },
      creativeEnhancements: [],
      suggestedInputs: [],
      calculationLogic: [],
      promptOptions: {
        includeComprehensiveColors: true,
        includeGorgeousStyling: true,
        includeAdvancedLayouts: false,
        styleComplexity: "basic",
        toolComplexity: "simple",
      },
    };

    expect(() => BrainstormDataSchema.parse(invalidBrainstorm)).toThrow();
  });
});
