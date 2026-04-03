import type { Meta, StoryObj } from '@storybook/react';
import { ToggleGroup, ToggleGroupItem } from '../../toggle-group';
import { AlignLeft, AlignCenter, AlignRight, Bold, Italic, Underline } from 'lucide-react';

const meta = {
  title: 'Actions/ToggleGroup',
  component: ToggleGroup,
  tags: ['autodocs'],
} satisfies Meta<typeof ToggleGroup>;

export default meta;
// Use unparameterized StoryObj — ToggleGroup has a discriminated union (type: "single" | "multiple")
type Story = StoryObj;

export const Single: Story = {
  render: () => (
    <ToggleGroup type="single" defaultValue="center">
      <ToggleGroupItem value="left"><AlignLeft className="size-4" /></ToggleGroupItem>
      <ToggleGroupItem value="center"><AlignCenter className="size-4" /></ToggleGroupItem>
      <ToggleGroupItem value="right"><AlignRight className="size-4" /></ToggleGroupItem>
    </ToggleGroup>
  ),
};

export const Multiple: Story = {
  render: () => (
    <ToggleGroup type="multiple" defaultValue={['bold']}>
      <ToggleGroupItem value="bold"><Bold className="size-4" /></ToggleGroupItem>
      <ToggleGroupItem value="italic"><Italic className="size-4" /></ToggleGroupItem>
      <ToggleGroupItem value="underline"><Underline className="size-4" /></ToggleGroupItem>
    </ToggleGroup>
  ),
};

export const Outline: Story = {
  render: () => (
    <ToggleGroup type="single" variant="outline" defaultValue="left">
      <ToggleGroupItem value="left"><AlignLeft className="size-4" /></ToggleGroupItem>
      <ToggleGroupItem value="center"><AlignCenter className="size-4" /></ToggleGroupItem>
      <ToggleGroupItem value="right"><AlignRight className="size-4" /></ToggleGroupItem>
    </ToggleGroup>
  ),
};

export const Small: Story = {
  render: () => (
    <ToggleGroup type="single" size="sm" defaultValue="center">
      <ToggleGroupItem value="left"><AlignLeft className="size-4" /></ToggleGroupItem>
      <ToggleGroupItem value="center"><AlignCenter className="size-4" /></ToggleGroupItem>
      <ToggleGroupItem value="right"><AlignRight className="size-4" /></ToggleGroupItem>
    </ToggleGroup>
  ),
};

export const Disabled: Story = {
  render: () => (
    <ToggleGroup type="single" disabled>
      <ToggleGroupItem value="left"><AlignLeft className="size-4" /></ToggleGroupItem>
      <ToggleGroupItem value="center"><AlignCenter className="size-4" /></ToggleGroupItem>
      <ToggleGroupItem value="right"><AlignRight className="size-4" /></ToggleGroupItem>
    </ToggleGroup>
  ),
};
