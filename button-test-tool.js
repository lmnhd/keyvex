'use client';

// Simple test tool to verify Button onClick handlers work with Component Assembler fix
const ButtonTestTool = () => {
  const [message, setMessage] = React.useState('No button clicked yet');
  const [clickCount, setClickCount] = React.useState(0);

  const handleTestClick = () => {
    console.log('🎯 TEST: Button click handler executed successfully!');
    setClickCount(prev => prev + 1);
    setMessage(`Button clicked ${clickCount + 1} times - Handler is working!`);
  };

  const handleResetClick = () => {
    console.log('🎯 TEST: Reset button handler executed!');
    setClickCount(0);
    setMessage('Reset complete - Ready for testing');
  };

  return React.createElement('main', {
    className: 'bg-gradient-to-br from-slate-800 via-slate-900 to-gray-900 min-h-screen p-8',
    'data-tool-container': 'true',
    key: 'main-container'
  }, [
    React.createElement('div', {
      className: 'max-w-md mx-auto bg-white rounded-lg p-6 shadow-lg',
      key: 'test-container'
    }, [
      React.createElement('h1', {
        className: 'text-2xl font-bold mb-4 text-gray-900',
        key: 'title'
      }, 'Button Test Tool'),
      
      React.createElement('p', {
        className: 'text-gray-700 mb-4',
        key: 'status'
      }, message),
      
      React.createElement('p', {
        className: 'text-sm text-gray-600 mb-6',
        key: 'counter'
      }, `Click count: ${clickCount}`),
      
      React.createElement('div', {
        className: 'space-y-3',
        key: 'button-container'
      }, [
        React.createElement(Button, {
          onClick: handleTestClick,
          className: 'w-full bg-blue-600 hover:bg-blue-700 text-white',
          key: 'test-button'
        }, 'Test Button Click'),
        
        React.createElement(Button, {
          onClick: handleResetClick,
          className: 'w-full bg-gray-600 hover:bg-gray-700 text-white',
          key: 'reset-button'
        }, 'Reset Counter')
      ])
    ])
  ]);
};

// For testing in browser console:
window.ButtonTestTool = ButtonTestTool; 