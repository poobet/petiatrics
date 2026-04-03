import type { Meta, StoryObj } from '@storybook/react';
import { Input } from '../../input';
import { Label } from '../../label';
import { Search } from 'lucide-react';

const meta = {
  title: 'Forms/Input',
  component: Input,
  tags: ['autodocs'],
  argTypes: {
    type: { control: 'select', options: ['text', 'email', 'password', 'number', 'tel', 'url', 'search'] },
    disabled: { control: 'boolean' },
    placeholder: { control: 'text' },
  },
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { placeholder: 'Patient name…' },
};

export const WithLabel: Story = {
  render: () => (
    <div className="grid w-75 gap-1.5">
      <Label htmlFor="owner-email">Owner Email</Label>
      <Input id="owner-email" type="email" placeholder="owner@example.com" />
    </div>
  ),
};

export const Password: Story = {
  args: { type: 'password', placeholder: 'Enter password' },
};

export const Number: Story = {
  args: { type: 'number', placeholder: 'Weight (kg)' },
};

export const Disabled: Story = {
  args: { disabled: true, placeholder: 'Disabled input', value: 'Read only value' },
};

export const File: Story = {
  args: { type: 'file' },
};
