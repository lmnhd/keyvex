// Test the TypeScript stripping logic
function stripTypeScriptSyntax(code) {
  console.log('🔧 TYPESCRIPT-STRIP: Testing TypeScript syntax removal...');
  let strippedCode = code;
  
  // Remove interface declarations entirely (comprehensive pattern)
  strippedCode = strippedCode.replace(/interface\s+\w+\s*\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g, '');
  
  // Remove type annotations from function parameters
  strippedCode = strippedCode.replace(/(\w+)\s*:\s*[^,)=]+/g, '$1');
  
  // Remove return type annotations 
  strippedCode = strippedCode.replace(/\):\s*[^{=]+\s*(?=\{|=>)/g, ')');
  
  // Remove React.FC type annotations specifically 
  strippedCode = strippedCode.replace(/:\s*React\.FC\s*<[^>]*>/g, '');
  strippedCode = strippedCode.replace(/:\s*FC\s*<[^>]*>/g, '');
  
  // Remove generic type parameters
  strippedCode = strippedCode.replace(/<[^<>]*(?:<[^<>]*>[^<>]*)*>/g, '');
  
  // Clean up
  strippedCode = strippedCode
    .replace(/;\s*;/g, ';')
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .replace(/  +/g, ' ')
    .replace(/^\s*;\s*$/gm, '')
    .trim();
  
  return strippedCode;
}

const testCode = `interface BloggingROICalculatorProps {}

const BloggingROICalculator: React.FC<BloggingROICalculatorProps> = () => {
  const [blogPosts, setBlogPosts] = useState<number>(0);
  const [errors, setErrors] = useState<{ blogPosts?: string; conversionRate?: string }>({});
  
  const handleInputChange = (field: 'blogPosts' | 'conversionRate', value: string) => {
    const numericValue = Number(value);
    switch(field) {
      case 'blogPosts':
        setBlogPosts(numericValue);
        break;
    }
  };
  
  return React.createElement('div', {}, 'test');
};

export default BloggingROICalculator;`;

console.log('ORIGINAL:');
console.log(testCode);
console.log('\n' + '='.repeat(80));
console.log('STRIPPED:');
const stripped = stripTypeScriptSyntax(testCode);
console.log(stripped);

// Test if the stripped code would execute in strict mode
console.log('\n' + '='.repeat(80));
console.log('EXECUTION TEST:');
try {
  const testFunction = new Function(`
    "use strict";
    const React = { createElement: () => null };
    const useState = () => [null, () => {}];
    
    try {
      ${stripped}
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  `);
  
  const result = testFunction();
  console.log('Execution result:', result);
} catch (error) {
  console.log('Function creation failed:', error.message);
} 