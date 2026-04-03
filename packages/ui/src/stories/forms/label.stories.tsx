import type { Meta, StoryObj } from '@storybook/react';
import { Label } from '../../label';
import { Input } from '../../input';

const meta = {
  title: 'Forms/Label',
  component: Label,
  tags: ['autodocs'],
} satisfies Meta<typeof Label>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { children: 'Patient Name' },
};

export const WithInput: Story = {
  render: () => (
    <div className="grid w-75 gap-1.5">
      <Label htmlFor="patient">Patient Name</Label>
      <Input id="patient" placeholder="e.g. Luna" />
    </div>
  ),
};
