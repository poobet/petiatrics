import type { Preview } from '@storybook/react';
// Display project styles: Tailwind v4 + tw-animate-css + @theme inline bridge + CSS variables
import '../../../documents/display/src/styles/tailwind.css';
import '../../../documents/display/src/styles/theme.css';

const preview: Preview = {
  parameters: {
    layout: 'centered',
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;
