import type { Meta, StoryObj } from '@storybook/react';
import { Button } from '../../button';
import { Popover, PopoverContent, PopoverTrigger } from '../../popover';

const meta = {
  title: 'Overlays/Popover',
  component: Popover,
  tags: ['autodocs'],
} satisfies Meta<typeof Popover>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline">Open Popover</Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="grid gap-2">
          <h4 className="font-medium text-sm">Quick Info</h4>
          <p className="text-sm text-muted-foreground">
            Luna — 3-year-old Domestic Shorthair. Last visit: Mar 15, 2026.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  ),
};
