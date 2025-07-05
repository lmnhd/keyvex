export interface BabelLoadStatus {
    isLoaded: boolean;
    isLoading: boolean;
    error?: string;
  }
  
  export function isBabelLoaded(): boolean {
    return typeof window !== 'undefined' && 
           typeof window.Babel === 'object' && 
           typeof window.Babel.transform === 'function';
  }
  
  export function getBabelLoadStatus(): BabelLoadStatus {
    if (typeof window === 'undefined') {
      return {
        isLoaded: false,
        isLoading: false,
        error: 'Window object not available (server-side rendering)'
      };
    }
  
    if (isBabelLoaded()) {
      return {
        isLoaded: true,
        isLoading: false
      };
    }
  
    const babelScript = document.querySelector('script[src*="babel"]');
    const isLoading = babelScript !== null && !isBabelLoaded();
  
    return {
      isLoaded: false,
      isLoading,
      error: isLoading ? undefined : 'Babel Standalone not found'
    };
  }
  
  export function ensureBabelLoaded(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      if (isBabelLoaded()) {
        resolve(true);
        return;
      }
  
      if (typeof window === 'undefined') {
        reject(new Error('Cannot load Babel on server-side'));
        return;
      }
  
      const existingScript = document.querySelector('script[src*="babel"]');
      if (existingScript) {
        existingScript.addEventListener('load', () => {
          if (isBabelLoaded()) {
            resolve(true);
          } else {
            reject(new Error('Babel script loaded but Babel object not available'));
          }
        });
        existingScript.addEventListener('error', () => {
          reject(new Error('Failed to load existing Babel script'));
        });
        return;
      }
  
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/@babel/standalone/babel.min.js';
      script.async = true;
      
      script.onload = () => {
        setTimeout(() => {
          if (isBabelLoaded()) {
            resolve(true);
          } else {
            reject(new Error('Babel loaded but not properly initialized'));
          }
        }, 100);
      };
      
      script.onerror = () => {
        reject(new Error('Failed to load Babel Standalone from CDN'));
      };
      
      document.head.appendChild(script);
    });
  }
