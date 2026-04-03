import type { Meta, StoryObj } from '@storybook/react';
import { Badge } from '../../badge';

const meta = {
  title: 'Data Display/Badge',
  component: Badge,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'secondary', 'destructive', 'outline'],
    },
  },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { children: 'Confirmed' },
};

export const Secondary: Story = {
  args: { variant: 'secondary', children: 'Pending' },
};

export const Destructive: Story = {
  args: { variant: 'destructive', children: 'Overdue' },
};

export const Outline: Story = {
  args: { variant: 'outline', children: 'Draft' },
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge>Confirmed</Badge>
      <Badge variant="secondary">Pending</Badge>
      <Badge variant="destructive">Overdue</Badge>
      <Badge variant="outline">Draft</Badge>
    </div>
  ),
};

export const StatusExample: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge>Vaccinated</Badge>
      <Badge variant="secondary">Check-up Due</Badge>
      <Badge variant="destructive">Urgent</Badge>
      <Badge variant="outline">Neutered</Badge>
    </div>
  ),
};
