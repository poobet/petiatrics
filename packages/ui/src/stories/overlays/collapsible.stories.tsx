import type { Meta, StoryObj } from '@storybook/react';
import { Button } from '../../button';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '../../collapsible';
import { ChevronsUpDown } from 'lucide-react';

const meta = {
  title: 'Overlays/Collapsible',
  component: Collapsible,
  tags: ['autodocs'],
} satisfies Meta<typeof Collapsible>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Collapsible className="w-87.5 space-y-2">
      <div className="flex items-center justify-between rounded-md border px-4 py-2">
        <h4 className="text-sm font-semibold">Vaccination History</h4>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="icon">
            <ChevronsUpDown className="size-4" />
          </Button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent className="space-y-2">
        <div className="rounded-md border px-4 py-2 text-sm">Rabies — Dec 2025</div>
        <div className="rounded-md border px-4 py-2 text-sm">FVRCP — Oct 2025</div>
        <div className="rounded-md border px-4 py-2 text-sm">FeLV — Aug 2025</div>
      </CollapsibleContent>
    </Collapsible>
  ),
};

export const DefaultOpen: Story = {
  render: () => (
    <Collapsible defaultOpen className="w-87.5 space-y-2">
      <div className="flex items-center justify-between rounded-md border px-4 py-2">
        <h4 className="text-sm font-semibold">Recent Visits</h4>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="icon">
            <ChevronsUpDown className="size-4" />
          </Button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent className="space-y-2">
        <div className="rounded-md border px-4 py-2 text-sm">Mar 15, 2026 — Check-up</div>
        <div className="rounded-md border px-4 py-2 text-sm">Jan 20, 2026 — Dental</div>
      </CollapsibleContent>
    </Collapsible>
  ),
};
