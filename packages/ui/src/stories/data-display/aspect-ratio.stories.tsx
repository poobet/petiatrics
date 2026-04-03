import type { Meta, StoryObj } from '@storybook/react';
import { AspectRatio } from '../../aspect-ratio';

const meta = {
  title: 'Data Display/AspectRatio',
  component: AspectRatio,
  tags: ['autodocs'],
  argTypes: {
    ratio: { control: 'number', description: 'Width / Height ratio' },
  },
} satisfies Meta<typeof AspectRatio>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SixteenByNine: Story = {
  args: { ratio: 16 / 9 },
  render: (args) => (
    <div className="w-72">
      <AspectRatio {...args} className="bg-muted rounded overflow-hidden">
        <img
          src="https://placehold.co/640x360/4f7df3/ffffff?text=16:9"
          alt="16:9 placeholder"
          className="h-full w-full object-cover"
        />
      </AspectRatio>
    </div>
  ),
};

export const Square: Story = {
  args: { ratio: 1 },
  render: (args) => (
    <div className="w-48">
      <AspectRatio {...args} className="bg-muted rounded overflow-hidden">
        <img
          src="https://placehold.co/400x400/4f7df3/ffffff?text=1:1"
          alt="Square placeholder"
          className="h-full w-full object-cover"
        />
      </AspectRatio>
    </div>
  ),
};

export const FourByThree: Story = {
  args: { ratio: 4 / 3 },
  render: (args) => (
    <div className="w-64">
      <AspectRatio {...args} className="bg-secondary rounded overflow-hidden flex items-center justify-center">
        <span className="text-muted-foreground text-sm">Pet X-ray preview</span>
      </AspectRatio>
    </div>
  ),
};
