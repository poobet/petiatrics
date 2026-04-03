import type { Meta, StoryObj } from '@storybook/react';
import { Separator } from '../../separator';

const meta = {
  title: 'Data Display/Separator',
  component: Separator,
  tags: ['autodocs'],
} satisfies Meta<typeof Separator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Horizontal: Story = {
  render: () => (
    <div className="w-75 space-y-2">
      <p className="text-sm font-medium">Patient Info</p>
      <Separator />
      <p className="text-sm text-muted-foreground">Luna — Domestic Shorthair</p>
    </div>
  ),
};

export const Vertical: Story = {
  render: () => (
    <div className="flex h-5 items-center gap-4 text-sm">
      <span>Dashboard</span>
      <Separator orientation="vertical" />
      <span>Patients</span>
      <Separator orientation="vertical" />
      <span>Appointments</span>
    </div>
  ),
};
