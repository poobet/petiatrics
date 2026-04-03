import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { Checkbox } from '../../checkbox';
import { Label } from '../../label';

const meta = {
  title: 'Forms/Checkbox',
  component: Checkbox,
  tags: ['autodocs'],
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { defaultChecked: true },
};

export const Unchecked: Story = {
  args: { defaultChecked: false },
};

export const WithLabel: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <Checkbox id="consent" />
      <Label htmlFor="consent">Owner consent received</Label>
    </div>
  ),
};

export const Disabled: Story = {
  args: { disabled: true, defaultChecked: true },
};

export const CheckboxGroup: Story = {
  render: () => (
    <div className="space-y-2">
      {['Vaccination', 'Deworming', 'Flea Treatment', 'Dental Check'].map((item) => (
        <div key={item} className="flex items-center gap-2">
          <Checkbox id={item} />
          <Label htmlFor={item}>{item}</Label>
        </div>
      ))}
    </div>
  ),
};
