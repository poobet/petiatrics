import type { Meta, StoryObj } from '@storybook/react';
import { Textarea } from '../../textarea';
import { Label } from '../../label';

const meta = {
  title: 'Forms/Textarea',
  component: Textarea,
  tags: ['autodocs'],
  argTypes: {
    disabled: { control: 'boolean' },
    placeholder: { control: 'text' },
  },
} satisfies Meta<typeof Textarea>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { placeholder: 'Clinical notes…' },
};

export const WithLabel: Story = {
  render: () => (
    <div className="grid w-100 gap-1.5">
      <Label htmlFor="notes">Visit Notes</Label>
      <Textarea id="notes" placeholder="Describe the patient's condition…" />
    </div>
  ),
};

export const Disabled: Story = {
  args: { disabled: true, placeholder: 'Disabled', value: 'Read only notes' },
};
