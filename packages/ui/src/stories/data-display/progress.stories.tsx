import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { Progress } from '../../progress';

const meta = {
  title: 'Data Display/Progress',
  component: Progress,
  tags: ['autodocs'],
  argTypes: {
    value: { control: { type: 'range', min: 0, max: 100 } },
  },
} satisfies Meta<typeof Progress>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { value: 60 },
  decorators: [(Story: React.ComponentType) => <div className="w-75"><Story /></div>],
};

export const Empty: Story = {
  args: { value: 0 },
  decorators: [(Story: React.ComponentType) => <div className="w-75"><Story /></div>],
};

export const Full: Story = {
  args: { value: 100 },
  decorators: [(Story: React.ComponentType) => <div className="w-75"><Story /></div>],
};

export const WithLabel: Story = {
  render: () => (
    <div className="w-75 space-y-1">
      <div className="flex justify-between text-sm">
        <span>Vaccination progress</span>
        <span className="text-muted-foreground">3 / 5</span>
      </div>
      <Progress value={60} />
    </div>
  ),
};
