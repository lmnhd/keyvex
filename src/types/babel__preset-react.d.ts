// Ambient module declaration for '@babel/preset-react'.
// Copied from babel__preset-react.ts but converted to .d.ts so the TS server
// picks it up for module resolution without emitting JS.

declare module '@babel/preset-react' {
  import type { PluginItem } from '@babel/core';

  export interface BabelPresetReactOptions {
  runtime?: 'automatic' | 'classic';
  development?: boolean;
  importSource?: string;
  pragma?: string;
  pragmaFrag?: string;
  throwIfNamespace?: boolean;
}

declare const presetReact: (
  api: unknown,
  options?: BabelPresetReactOptions
) => PluginItem;

  export default presetReact;
}

