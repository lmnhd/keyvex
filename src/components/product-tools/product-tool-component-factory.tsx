'use client';

import React, { useContext } from 'react';
import { ComponentDefinition as ProductToolComponentDefinition } from '@/lib/types/product-tool';
import { ComponentDefinition as ToolComponentDefinition } from '@/lib/types/tool-definition';
import { DynamicComponentFactory, DynamicComponentProvider } from '@/components/tool-creator/dynamic-component-factory';
import { ProductToolContext } from './product-tool-renderer';

// ============================================================================
// TYPE ADAPTER
// ============================================================================

function adaptComponentDefinition(
  productToolComponent: ProductToolComponentDefinition
): ToolComponentDefinition {
  // Handle calculation-display components specially
  if (productToolComponent.type === 'calculation-display') {
    return {
      ...productToolComponent,
      props: {
        ...(productToolComponent.props || {}),
        // Ensure dependencies are available from props
        dependencies: productToolComponent.props?.dependencies || []
      }
    } as unknown as ToolComponentDefinition;
  }
  
  // For other components, the types are mostly compatible
  return productToolComponent as unknown as ToolComponentDefinition;
}

// ============================================================================
// PRODUCT TOOL COMPONENT FACTORY
// ============================================================================

interface ProductToolComponentFactoryProps {
  definition: ProductToolComponentDefinition;
}

export default function ProductToolComponentFactory({ 
  definition 
}: ProductToolComponentFactoryProps) {
  const context = useContext(ProductToolContext);
  
  if (!context) {
    throw new Error('ProductToolComponentFactory must be used within ProductToolContext');
  }
  
  const { values, setValue } = context;
  
  const handleValuesChange = (newValues: Record<string, any>) => {
    // Sync any changed values back to the ProductTool context
    Object.entries(newValues).forEach(([componentId, value]) => {
      if (values[componentId] !== value) {
        setValue(componentId, value);
      }
    });
  };
  
  const handleValueChange = (componentId: string, value: any) => {
    setValue(componentId, value);
  };
  
  const handleCalculationTrigger = (componentId: string) => {
    // Trigger recalculations - this will be handled by the renderer
    console.log('Calculation triggered for component:', componentId);
  };
  
  // Adapt the component definition to the expected type
  const adaptedDefinition = adaptComponentDefinition(definition);
  
  return (
    <DynamicComponentProvider 
      initialValues={values}
      onValuesChange={handleValuesChange}
    >
      <DynamicComponentFactory
        definition={adaptedDefinition}
        values={values}
        onValueChange={handleValueChange}
        onCalculationTrigger={handleCalculationTrigger}
      />
    </DynamicComponentProvider>
  );
} 