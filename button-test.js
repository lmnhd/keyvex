// Simple test to verify React.createElement Button onClick handlers
console.log('🔧 Testing Button onClick handlers...');

// Test if the issue is with the generated tool pattern
function testButtonClick() {
  console.log('🎯 TEST: Button click handler executed successfully!');
  alert('Button click works!');
}

// Simulate the exact pattern from generated tools
const testElement = React.createElement(Button, {
  onClick: testButtonClick,
  className: 'bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded',
  key: 'test-button'
}, 'Test Button');

console.log('🔧 Created test element:', testElement);
console.log('🔧 Props:', testElement.props);
console.log('🔧 onClick function:', testElement.props.onClick);

// This would be rendered in the actual app
// ReactDOM.render(testElement, document.getElementById('test-container')); 