'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';

export default function ButtonTestPage() {
  const [jsxCount, setJsxCount] = useState(0);
  const [createElementCount, setCreateElementCount] = useState(0);

  // Test handlers
  const handleJSXClick = () => {
    console.log('🎯 JSX Button clicked!', jsxCount);
    setJsxCount(prev => prev + 1);
  };

  const handleCreateElementClick = () => {
    console.log('🎯 React.createElement Button clicked!', createElementCount);
    setCreateElementCount(prev => prev + 1);
  };

  return (
    <div className="p-8 space-y-8">
      <h1 className="text-2xl font-bold">Button Test Comparison</h1>
      
      {/* JSX Button */}
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">JSX Button (should work)</h2>
        <Button onClick={handleJSXClick} className="bg-green-600 hover:bg-green-700">
          JSX Button - Clicked {jsxCount} times
        </Button>
      </div>
      
      {/* React.createElement Button */}
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">React.createElement Button (generated tool pattern)</h2>
        {React.createElement(Button, {
          onClick: handleCreateElementClick,
          className: 'bg-blue-600 hover:bg-blue-700',
          key: 'test-button'
        }, `React.createElement Button - Clicked ${createElementCount} times`)}
      </div>
      
      {/* Native HTML button for comparison */}
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Native HTML button (control)</h2>
        <button 
          onClick={() => console.log('🎯 Native button works!')}
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded"
        >
          Native HTML Button
        </button>
      </div>
      
      {/* Generated tool exact pattern test */}
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Exact Generated Tool Pattern</h2>
        {React.createElement(Button, {
          className: 'bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white font-semibold px-6 py-3 rounded-lg shadow-lg border border-blue-400 transition-all duration-200 hover:scale-105 hover:shadow-xl',
          onClick: () => {
            console.log('🎯 EXACT PATTERN TEST: Function executed!');
            alert('Generated tool pattern works!');
          },
          key: 'exact-pattern-test'
        }, 'Exact Pattern Test')}
      </div>
    </div>
  );
} 