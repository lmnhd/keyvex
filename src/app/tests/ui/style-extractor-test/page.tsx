'use client';

import React, { useState } from 'react';
import { extractAndEnhanceStyles, validateStyleExtraction, previewStyleExtraction } from '@/lib/utils/style-extractor';

export default function StyleExtractorTest() {
  const [testComponentCode, setTestComponentCode] = useState(`'use client';
function TestComponent() {
  const [count, setCount] = React.useState(0);
  
  return React.createElement('div', {
    className: 'max-w-md mx-auto p-6 bg-white rounded-lg shadow-md'
  }, [
    React.createElement('h1', {
      className: 'text-2xl font-bold text-gray-800 mb-4'
    }, 'Test Component'),
    React.createElement('p', {
      className: 'text-gray-600 mb-4'
    }, 'Count: ' + count),
    React.createElement('button', {
      className: 'px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600',
      onClick: () => setCount(count + 1)
    }, 'Increment')
  ]);
}`);

  const [result, setResult] = useState(null);
  const [validation, setValidation] = useState(null);

  const runExtraction = () => {
    console.log('🧪 Running style extraction test...');
    
    const extractionResult = extractAndEnhanceStyles(testComponentCode, {
      preserveExistingDataStyleIds: true,
      generateDescriptiveIds: true,
      includeBasicElements: true,
      idPrefix: ''
    });
    
    const validationResult = validateStyleExtraction(extractionResult);
    
    setResult(extractionResult);
    setValidation(validationResult);
    
    console.log('🧪 Extraction Result:', extractionResult);
    console.log('🧪 Validation Result:', validationResult);
    console.log('🧪 Preview:', previewStyleExtraction(extractionResult));
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">🎨 Style Extractor Test</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Section */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-700">Input Component Code</h2>
          <textarea
            value={testComponentCode}
            onChange={(e) => setTestComponentCode(e.target.value)}
            className="w-full h-96 p-4 border border-gray-300 rounded-lg font-mono text-sm"
            placeholder="Enter React.createElement component code..."
          />
          <button
            onClick={runExtraction}
            className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            🔬 Run Style Extraction
          </button>
        </div>

        {/* Results Section */}
        <div className="space-y-6">
          {validation && (
            <div className="p-4 border rounded-lg">
              <h3 className="text-lg font-semibold mb-2">
                Validation: {validation.isValid ? '✅ Valid' : '❌ Issues Found'}
              </h3>
              {validation.issues.length > 0 && (
                <div className="mb-2">
                  <h4 className="font-medium text-red-600">Issues:</h4>
                  <ul className="list-disc list-inside text-sm text-red-600">
                    {validation.issues.map((issue, index) => (
                      <li key={index}>{issue}</li>
                    ))}
                  </ul>
                </div>
              )}
              {validation.warnings.length > 0 && (
                <div>
                  <h4 className="font-medium text-yellow-600">Warnings:</h4>
                  <ul className="list-disc list-inside text-sm text-yellow-600">
                    {validation.warnings.map((warning, index) => (
                      <li key={index}>{warning}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {result && (
            <div className="space-y-4">
              <div className="p-4 border rounded-lg">
                <h3 className="text-lg font-semibold mb-2">📊 Extraction Summary</h3>
                <div className="text-sm space-y-1">
                  <p><strong>Total Elements:</strong> {result.totalElements}</p>
                  <p><strong>Enhanced Elements:</strong> {result.totalStylesExtracted}</p>
                  <p><strong>Style Map Entries:</strong> {Object.keys(result.initialStyleMap).length}</p>
                </div>
              </div>

              <div className="p-4 border rounded-lg">
                <h3 className="text-lg font-semibold mb-2">🗺️ Generated Style Map</h3>
                <pre className="text-xs bg-gray-100 p-3 rounded overflow-auto max-h-40">
                  {JSON.stringify(result.initialStyleMap, null, 2)}
                </pre>
              </div>

              <div className="p-4 border rounded-lg">
                <h3 className="text-lg font-semibold mb-2">🔧 Enhanced Component Code</h3>
                <textarea
                  value={result.modifiedComponentCode}
                  readOnly
                  title="Enhanced component code output"
                  className="w-full h-64 p-3 bg-gray-50 border rounded font-mono text-xs"
                />
              </div>

              <div className="p-4 border rounded-lg">
                <h3 className="text-lg font-semibold mb-2">📋 Enhanced Elements</h3>
                <div className="space-y-2 max-h-40 overflow-auto">
                  {result.extractedStyles.map((style, index) => (
                    <div key={index} className="text-sm border-l-2 border-blue-200 pl-3">
                      <div className="font-medium">{style.elementType} → {style.generatedId}</div>
                      <div className="text-gray-600">{style.contextHint}</div>
                      <div className="text-xs text-gray-500">{style.originalClassName}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {result && (
        <div className="mt-8 p-4 bg-gray-50 rounded-lg">
          <h3 className="text-lg font-semibold mb-2">📋 Complete Preview</h3>
          <pre className="text-xs whitespace-pre-wrap">
            {previewStyleExtraction(result)}
          </pre>
        </div>
      )}
    </div>
  );
} 