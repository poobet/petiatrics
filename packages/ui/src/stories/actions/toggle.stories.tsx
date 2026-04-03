import type { Meta, StoryObj } from '@storybook/react';
import { Toggle } from '../../toggle';
import { Bold, Italic, Underline } from 'lucide-react';

const meta = {
  title: 'Actions/Toggle',
  component: Toggle,
  tags: ['autodocs'],
  argTypes: {
    variant: { control: 'select', options: ['default', 'outline'] },
    size: { control: 'select', options: ['default', 'sm', 'lg'] },
  },
} satisfies Meta<typeof Toggle>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { children: <Bold className="size-4" /> },
};

export const Outline: Story = {
  args: { variant: 'outline', children: <Italic className="size-4" /> },
};

export const WithText: Story = {
  args: { children: <><Bold className="size-4" /> Bold</> },
};

export const Small: Story = {
  args: { size: 'sm', children: <Underline className="size-4" /> },
};

export const Large: Story = {
  args: { size: 'lg', children: <Bold className="size-4" /> },
};

export const Disabled: Story = {
  args: { disabled: true, children: <Bold className="size-4" /> },
};
