import type { Meta, StoryObj } from '@storybook/react';
import { Button } from '../../button';
import { Mail, Loader2, ChevronRight, Plus, Trash2 } from 'lucide-react';

const meta = {
  title: 'Actions/Button',
  component: Button,
  tags: ['autodocs'],
  args: { children: 'Button' },
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'],
    },
    size: {
      control: 'select',
      options: ['default', 'sm', 'lg', 'icon'],
    },
    disabled: { control: 'boolean' },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { children: 'Save Changes' },
};

export const Destructive: Story = {
  args: { variant: 'destructive', children: 'Delete Patient' },
};

export const Outline: Story = {
  args: { variant: 'outline', children: 'Cancel' },
};

export const Secondary: Story = {
  args: { variant: 'secondary', children: 'View Details' },
};

export const Ghost: Story = {
  args: { variant: 'ghost', children: 'Ghost Action' },
};

export const Link: Story = {
  args: { variant: 'link', children: 'View Policy' },
};

export const Small: Story = {
  args: { size: 'sm', children: 'Small' },
};

export const Large: Story = {
  args: { size: 'lg', children: 'Large' },
};

export const Icon: Story = {
  args: { size: 'icon', children: <Plus className="size-4" /> },
};

export const WithIcon: Story = {
  args: { children: <><Mail className="size-4" /> Send Reminder</> },
};

export const Loading: Story = {
  args: {
    disabled: true,
    children: <><Loader2 className="size-4 animate-spin" /> Saving…</>,
  },
};

export const Disabled: Story = {
  args: { disabled: true, children: 'Disabled' },
};

/** All variants side by side */
export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      <Button>Default</Button>
      <Button variant="destructive"><Trash2 className="size-4" /> Destructive</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="link">Link</Button>
    </div>
  ),
};

/** All sizes side by side */
export const AllSizes: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <Button size="sm">Small</Button>
      <Button size="default">Default</Button>
      <Button size="lg">Large</Button>
      <Button size="icon"><ChevronRight className="size-4" /></Button>
    </div>
  ),
};
