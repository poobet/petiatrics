import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import type { StorybookConfig } from '@storybook/react-vite';
import tailwindcss from '@tailwindcss/vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  addons: [getAbsolutePath("@storybook/addon-docs")],

  framework: {
    name: getAbsolutePath("@storybook/react-vite"),
    options: {},
  },

  async viteFinal(config) {
    // Deduplicate React to prevent multiple instances (fixes hooks errors
    // when importing components from documents/display via react-router)
    config.resolve = config.resolve || {};
    config.resolve.dedupe = [
      ...(config.resolve.dedupe || []),
      'react', 'react-dom', 'react-router',
    ];

    // Suppress known harmless Rollup warnings:
    // - "use client" directives from React component libraries (Radix, shadcn, etc.)
    // - sourcemap resolution warnings from transformed files
    config.build = config.build || {};
    config.build.chunkSizeWarningLimit = 1200;
    config.build.rollupOptions = config.build.rollupOptions || {};
    const existingOnwarn = config.build.rollupOptions.onwarn;
    config.build.rollupOptions.onwarn = (warning, defaultHandler) => {
      // Ignore "use client" module-level directive warnings
      if (warning.code === 'MODULE_LEVEL_DIRECTIVE' && warning.message.includes('"use client"')) {
        return;
      }
      // Ignore sourcemap resolution warnings from injected code
      if (warning.code === 'SOURCEMAP_ERROR') {
        return;
      }
      if (existingOnwarn) {
        existingOnwarn(warning, defaultHandler);
      } else {
        defaultHandler(warning);
      }
    };

    config.plugins = config.plugins || [];
    // Add @tailwindcss/vite so that `@import 'tailwindcss'` in preview CSS
    // is processed correctly and all utility classes are generated.
    config.plugins.unshift(tailwindcss());
    // In dev mode, files from documents/display (outside packages/ui) may
    // not get their JSX transformed by the React Vite plugin.
    // Inject `import React` only for files that don't already have it.
    config.plugins.push({
      name: 'inject-react-for-display',
      apply: 'serve',
      transform(code, id) {
        if (
          id.includes('documents') &&
          id.includes('display') &&
          /\.[jt]sx$/.test(id) &&
          !/import\s+(\*\s+as\s+)?React[\s,{]/m.test(code)
        ) {
          return { code: `import React from 'react';\n${code}`, map: null };
        }
      },
    });
    return config;
  },
};

export default config;

function getAbsolutePath(value: string): any {
  return dirname(fileURLToPath(import.meta.resolve(`${value}/package.json`)));
}
