import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { Slider } from '../../slider';
import { Label } from '../../label';

const meta = {
  title: 'Forms/Slider',
  component: Slider,
  tags: ['autodocs'],
} satisfies Meta<typeof Slider>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { defaultValue: [50], max: 100 },
  decorators: [(Story: React.ComponentType) => <div className="w-75"><Story /></div>],
};

export const WithLabel: Story = {
  render: () => (
    <div className="grid w-75 gap-2">
      <Label>Weight (kg)</Label>
      <Slider defaultValue={[4.5]} min={0} max={50} step={0.5} />
    </div>
  ),
};

export const Range: Story = {
  render: () => (
    <div className="grid w-75 gap-2">
      <Label>Age range (years)</Label>
      <Slider defaultValue={[2, 8]} min={0} max={20} />
    </div>
  ),
};

export const Disabled: Story = {
  args: { defaultValue: [30], max: 100, disabled: true },
  decorators: [(Story: React.ComponentType) => <div className="w-75"><Story /></div>],
};
