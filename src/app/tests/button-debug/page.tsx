'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';

export default function ButtonDebugPage() {
  const [jsxCount, setJsxCount] = useState(0);
  const [createElementCount, setCreateElementCount] = useState(0);
  const [nativeCount, setNativeCount] = useState(0);

  // Test handlers
  const handleJSXClick = () => {
    console.log('🎯 JSX Button clicked!', jsxCount);
    setJsxCount(prev => prev + 1);
  };

  const handleCreateElementClick = () => {
    console.log('🎯 React.createElement Button clicked!', createElementCount);
    setCreateElementCount(prev => prev + 1);
  };

  const handleNativeClick = () => {
    console.log('🎯 Native button clicked!', nativeCount);
    setNativeCount(prev => prev + 1);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <h1 className="text-2xl font-bold mb-6">Button Debug Test</h1>
          <p className="text-gray-600 mb-6">
            Testing different ways to create Button components with onClick handlers.
            Check the console for click events.
          </p>

          <div className="space-y-6">
            {/* JSX Button */}
            <div className="border p-4 rounded">
              <h3 className="font-semibold mb-2">1. JSX Button (Normal Way)</h3>
              <p className="text-sm text-gray-600 mb-3">Click count: {jsxCount}</p>
              <Button onClick={handleJSXClick} className="bg-green-600 hover:bg-green-700">
                JSX Button - Click Me!
              </Button>
            </div>

            {/* React.createElement Button */}
            <div className="border p-4 rounded">
              <h3 className="font-semibold mb-2">2. React.createElement Button (Generated Tool Way)</h3>
              <p className="text-sm text-gray-600 mb-3">Click count: {createElementCount}</p>
              {React.createElement(Button, {
                onClick: handleCreateElementClick,
                className: "bg-blue-600 hover:bg-blue-700",
                key: 'test-button'
              }, 'React.createElement Button - Click Me!')}
            </div>

            {/* Native HTML Button */}
            <div className="border p-4 rounded">
              <h3 className="font-semibold mb-2">3. Native HTML Button (Control)</h3>
              <p className="text-sm text-gray-600 mb-3">Click count: {nativeCount}</p>
              <button 
                onClick={handleNativeClick}
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded"
              >
                Native Button - Click Me!
              </button>
            </div>

            {/* Advanced React.createElement Test */}
            <div className="border p-4 rounded">
              <h3 className="font-semibold mb-2">4. Advanced React.createElement Test</h3>
              <p className="text-sm text-gray-600 mb-3">Testing the exact pattern from generated tools</p>
              {React.createElement('div', {
                className: 'space-y-2',
                key: 'container'
              }, [
                React.createElement('p', {
                  key: 'description',
                  className: 'text-sm text-gray-600'
                }, 'This mimics the exact structure of generated tools:'),
                React.createElement(Button, {
                  onClick: () => {
                    console.log('🎯 Advanced React.createElement Button clicked!');
                    alert('Advanced button works!');
                  },
                  className: 'bg-red-600 hover:bg-red-700',
                  key: 'advanced-button'
                }, 'Advanced React.createElement - Click Me!')
              ])}
            </div>
          </div>

          <div className="mt-8 p-4 bg-gray-100 rounded">
            <h3 className="font-semibold mb-2">Debug Information</h3>
            <ul className="text-sm space-y-1">
              <li>JSX Button clicks: {jsxCount}</li>
              <li>React.createElement Button clicks: {createElementCount}</li>
              <li>Native button clicks: {nativeCount}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
} 
