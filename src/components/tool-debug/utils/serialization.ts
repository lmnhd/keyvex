export function safeSerialize(obj: any, maxDepth: number = 3): any {
  const seen = new WeakSet();
  
  function serialize(value: any, depth: number): any {
    // Prevent infinite recursion
    if (depth > maxDepth) return '[MAX_DEPTH_REACHED]';
    
    // Handle primitives
    if (value === null || typeof value !== 'object') {
      return value;
    }
    
    // Handle circular references
    if (seen.has(value)) {
      return '[CIRCULAR_REFERENCE]';
    }
    seen.add(value);
    
    // Handle DOM elements
    if (value instanceof Element) {
      return {
        type: 'DOM_ELEMENT',
        tagName: value.tagName?.toLowerCase(),
        id: value.id || undefined,
        className: value.className || undefined,
        textContent: value.textContent?.substring(0, 100) || undefined,
        attributes: Array.from(value.attributes || []).reduce((acc, attr) => {
          acc[attr.name] = attr.value;
          return acc;
        }, {} as Record<string, string>),
      };
    }
    
    // Handle HTML collections and node lists
    if (value instanceof HTMLCollection || value instanceof NodeList) {
      return Array.from(value).slice(0, 5).map((item, index) => ({
        index,
        ...serialize(item, depth + 1)
      }));
    }
    
    // Handle functions
    if (typeof value === 'function') {
      return {
        type: 'FUNCTION',
        name: value.name || 'anonymous',
        length: value.length,
      };
    }
    
    // Handle errors
    if (value instanceof Error) {
      return {
        type: 'ERROR',
        name: value.name,
        message: value.message,
        stack: value.stack?.substring(0, 500),
      };
    }
    
    // Handle arrays
    if (Array.isArray(value)) {
      return value.slice(0, 10).map(item => serialize(item, depth + 1));
    }
    
    // Handle React Fiber and other problematic objects
    if (value.constructor && value.constructor.name === 'FiberNode') {
      return {
        type: 'REACT_FIBER',
        elementType: value.elementType?.name || 'unknown',
        key: value.key,
        type: value.type,
      };
    }
    
    // Handle regular objects
    const result: any = {};
    const keys = Object.keys(value).slice(0, 20); // Limit object keys
    
    for (const key of keys) {
      // Skip problematic keys that are known to cause circular references
      if (key.startsWith('__react') || 
          key.startsWith('_') ||
          key === 'stateNode' ||
          key === 'return' ||
          key === 'child' ||
          key === 'sibling' ||
          key === 'parent') {
        continue;
      }
      
      try {
        result[key] = serialize(value[key], depth + 1);
      } catch (error) {
        result[key] = '[SERIALIZATION_ERROR]';
      }
    }
    
    return result;
  }
  
  return serialize(obj, 0);
}

export function sanitizeEventData(data: any): any {
  return safeSerialize(data, 2);
} 