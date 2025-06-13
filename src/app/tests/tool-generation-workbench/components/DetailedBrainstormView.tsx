'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface BrainstormOutput {
  coreConcept?: string; // Handle potential typo by making it optional and checking both
  coreWConcept?: string; 
  keyCalculations: Array<{
    name: string;
    formula: string;
    description: string;
    variables: string[];
  }>;
  interactionFlow: Array<{
    step: number;
    title: string;
    description: string;
    userAction: string;
    engagementHook?: string;
  }>;
  valueProposition: string;
  leadCaptureStrategy?: {
    timing: string;
    method: string;
    incentive: string;
  };
  creativeEnhancements: string[];
  suggestedInputs: Array<{
    id: string;
    label: string;
    type: string;
    required: boolean;
    description: string;
  }>;
  calculationLogic: Array<{
    id: string;
    name: string;
    formula: string;
    dependencies: string[];
    outputFormat: string;
    engagementMoment?: string;
  }>;
  promptOptions: {
    includeComprehensiveColors: boolean;
    includeGorgeousStyling: boolean;
    includeAdvancedLayouts: boolean;
    styleComplexity: string;
    industryFocus?: string;
    toolComplexity: string;
  };
}

interface DetailedBrainstormViewProps {
  data: BrainstormOutput | null;
}

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h3 className="text-xl font-semibold mt-6 mb-3 text-gray-800 dark:text-gray-200">{children}</h3>
);

const SubSectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h4 className="text-lg font-medium mt-4 mb-2 text-gray-700 dark:text-gray-300">{children}</h4>
);

const PropertyDisplay: React.FC<{ label: string; value: any }> = ({ label, value }) => {
  if (typeof value === 'boolean') {
    return <p className="text-sm text-gray-600 dark:text-gray-400"><strong className="text-gray-700 dark:text-gray-300">{label}:</strong> {value ? 'Yes' : 'No'}</p>;
  }
  if (value === undefined || value === null || String(value).trim() === '') {
    return null; // Don't render if value is essentially empty
  }
  return <p className="text-sm text-gray-600 dark:text-gray-400"><strong className="text-gray-700 dark:text-gray-300">{label}:</strong> {String(value)}</p>;
};

export const DetailedBrainstormView: React.FC<DetailedBrainstormViewProps> = ({ data }) => {
  if (!data) {
    return null;
  }

  const coreConcept = data.coreConcept || data.coreWConcept;

  return (
    <Card className="w-full mt-6 shadow-lg border-gray-200 dark:border-gray-700">
      <CardHeader className="bg-gray-50 dark:bg-gray-800/50">
        <CardTitle className="text-2xl font-bold text-gray-900 dark:text-gray-100">Generated Brainstorm Details</CardTitle>
        <CardDescription className="text-gray-600 dark:text-gray-400">Below is the detailed output from the AI brainstorming session.</CardDescription>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        
        {coreConcept && (
          <section>
            <SectionTitle>Core Concept</SectionTitle>
            <p className="text-lg italic text-gray-700 dark:text-gray-300">
              \" {coreConcept} \"
            </p>
          </section>
        )}
        
        <Separator className="my-6" />

        <section>
          <SectionTitle>Value Proposition</SectionTitle>
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{data.valueProposition}</p>
        </section>

        <Separator className="my-6" />

        <section>
          <SectionTitle>Key Calculations</SectionTitle>
          {data.keyCalculations && data.keyCalculations.length > 0 ? (
            <Accordion type="single" collapsible className="w-full">
              {data.keyCalculations.map((calc, index) => (
                <AccordionItem value={`calc-${index}`} key={index} className="border-b dark:border-gray-700">
                  <AccordionTrigger className="text-md font-medium text-gray-800 dark:text-gray-200 hover:no-underline">
                    {calc.name}
                  </AccordionTrigger>
                  <AccordionContent className="pt-2 pb-4 space-y-2 bg-gray-50 dark:bg-gray-800/30 p-4 rounded-md">
                    <PropertyDisplay label="Description" value={calc.description} />
                    <PropertyDisplay label="Formula" value={calc.formula} />
                    <PropertyDisplay label="Variables" value={calc.variables.join(', ')} />
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">No key calculations provided.</p>
          )}
        </section>
        
        <Separator className="my-6" />

        <section>
          <SectionTitle>Interaction Flow</SectionTitle>
          {data.interactionFlow && data.interactionFlow.length > 0 ? (
            <div className="space-y-4">
              {data.interactionFlow.map((flowStep, index) => (
                <Card key={index} className="bg-white dark:bg-gray-800/50 shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-md font-semibold text-gray-800 dark:text-gray-200">Step {flowStep.step}: {flowStep.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm space-y-1">
                    <PropertyDisplay label="Description" value={flowStep.description} />
                    <PropertyDisplay label="User Action" value={flowStep.userAction} />
                    {flowStep.engagementHook && <PropertyDisplay label="Engagement Hook" value={flowStep.engagementHook} />}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">No interaction flow steps provided.</p>
          )}
        </section>

        <Separator className="my-6" />
        
        <section>
          <SectionTitle>Suggested Inputs</SectionTitle>
          {data.suggestedInputs && data.suggestedInputs.length > 0 ? (
            <Table className="border dark:border-gray-700">
              <TableHeader className="bg-gray-50 dark:bg-gray-800/50">
                <TableRow>
                  <TableHead className="text-gray-700 dark:text-gray-300">Label (ID)</TableHead>
                  <TableHead className="text-gray-700 dark:text-gray-300">Type</TableHead>
                  <TableHead className="text-gray-700 dark:text-gray-300">Required</TableHead>
                  <TableHead className="text-gray-700 dark:text-gray-300">Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.suggestedInputs.map((input) => (
                  <TableRow key={input.id} className="dark:border-gray-700">
                    <TableCell className="font-medium text-gray-800 dark:text-gray-200">{input.label} <Badge variant="outline" className="ml-1 text-xs">{input.id}</Badge></TableCell>
                    <TableCell className="text-gray-600 dark:text-gray-400">{input.type}</TableCell>
                    <TableCell className="text-gray-600 dark:text-gray-400">{input.required ? 'Yes' : 'No'}</TableCell>
                    <TableCell className="text-gray-600 dark:text-gray-400">{input.description}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">No suggested inputs provided.</p>
          )}
        </section>

        <Separator className="my-6" />

        <section>
          <SectionTitle>Calculation Logic</SectionTitle>
          {data.calculationLogic && data.calculationLogic.length > 0 ? (
            <Accordion type="single" collapsible className="w-full">
              {data.calculationLogic.map((logic, index) => (
                <AccordionItem value={`logic-${index}`} key={index} className="border-b dark:border-gray-700">
                  <AccordionTrigger className="text-md font-medium text-gray-800 dark:text-gray-200 hover:no-underline">
                    {logic.name} <Badge variant="outline" className="ml-2 text-xs">{logic.id}</Badge>
                  </AccordionTrigger>
                  <AccordionContent className="pt-2 pb-4 space-y-2 bg-gray-50 dark:bg-gray-800/30 p-4 rounded-md">
                    <PropertyDisplay label="Formula" value={logic.formula} />
                    <PropertyDisplay label="Dependencies" value={logic.dependencies.join(', ')} />
                    <PropertyDisplay label="Output Format" value={logic.outputFormat} />
                    {logic.engagementMoment && <PropertyDisplay label="Engagement Moment" value={logic.engagementMoment} />}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">No calculation logic provided.</p>
          )}
        </section>

        <Separator className="my-6" />

        <section>
          <SectionTitle>Lead Capture Strategy</SectionTitle>
          {data.leadCaptureStrategy ? (
          <Card className="bg-white dark:bg-gray-800/50 shadow-sm">
            <CardContent className="pt-6 space-y-1">
              <PropertyDisplay label="Timing" value={data.leadCaptureStrategy.timing} />
              <PropertyDisplay label="Method" value={data.leadCaptureStrategy.method} />
              <PropertyDisplay label="Incentive" value={data.leadCaptureStrategy.incentive} />
            </CardContent>
          </Card>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">No lead capture strategy provided.</p>
          )}
        </section>

        <Separator className="my-6" />

        <section>
          <SectionTitle>Creative Enhancements</SectionTitle>
          {data.creativeEnhancements && data.creativeEnhancements.length > 0 ? (
            <ul className="list-disc list-inside space-y-1 text-sm text-gray-600 dark:text-gray-400">
              {data.creativeEnhancements.map((enhancement, index) => (
                <li key={index}>{enhancement}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">No creative enhancements suggested.</p>
          )}
        </section>

        <Separator className="my-6" />

        <section>
          <SectionTitle>AI Prompt Options (for Tool Generation)</SectionTitle>
          <Card className="bg-white dark:bg-gray-800/50 shadow-sm">
            <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2">
              <PropertyDisplay label="Include Comprehensive Colors" value={data.promptOptions.includeComprehensiveColors} />
              <PropertyDisplay label="Include Gorgeous Styling" value={data.promptOptions.includeGorgeousStyling} />
              <PropertyDisplay label="Include Advanced Layouts" value={data.promptOptions.includeAdvancedLayouts} />
              <PropertyDisplay label="Style Complexity" value={data.promptOptions.styleComplexity} />
              {data.promptOptions.industryFocus && <PropertyDisplay label="Industry Focus" value={data.promptOptions.industryFocus} />}
              <PropertyDisplay label="Tool Complexity" value={data.promptOptions.toolComplexity} />
            </CardContent>
          </Card>
        </section>

      </CardContent>
    </Card>
  );
}; 