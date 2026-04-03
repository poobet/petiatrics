import type { Meta, StoryObj } from '@storybook/react';
import { ScrollArea, ScrollBar } from '../../scroll-area';
import { Separator } from '../../separator';

const meta = {
  title: 'Data Display/ScrollArea',
  component: ScrollArea,
  tags: ['autodocs'],
} satisfies Meta<typeof ScrollArea>;

export default meta;
type Story = StoryObj<typeof meta>;

const patients = Array.from({ length: 20 }, (_, i) => `Patient ${i + 1}`);

export const Vertical: Story = {
  render: () => (
    <ScrollArea className="h-50 w-62.5 rounded-md border p-4">
      <h4 className="mb-4 text-sm font-medium">Recent Patients</h4>
      {patients.map((p) => (
        <div key={p}>
          <div className="text-sm">{p}</div>
          <Separator className="my-2" />
        </div>
      ))}
    </ScrollArea>
  ),
};

export const Horizontal: Story = {
  render: () => (
    <ScrollArea className="w-100 whitespace-nowrap rounded-md border">
      <div className="flex gap-4 p-4">
        {Array.from({ length: 12 }, (_, i) => (
          <div key={i} className="flex size-20 shrink-0 items-center justify-center rounded-md border bg-muted text-sm">
            Slot {i + 1}
          </div>
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  ),
};
