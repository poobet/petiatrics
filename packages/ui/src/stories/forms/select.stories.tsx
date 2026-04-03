import type { Meta, StoryObj } from '@storybook/react';
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel,
  SelectSeparator, SelectTrigger, SelectValue,
} from '../../select';
import { Label } from '../../label';

const meta = {
  title: 'Forms/Select',
  component: Select,
  tags: ['autodocs'],
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div className="w-70">
      <Select defaultValue="cat">
        <SelectTrigger>
          <SelectValue placeholder="Select species" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="cat">Cat</SelectItem>
          <SelectItem value="dog">Dog</SelectItem>
          <SelectItem value="bird">Bird</SelectItem>
          <SelectItem value="rabbit">Rabbit</SelectItem>
        </SelectContent>
      </Select>
    </div>
  ),
};

export const WithGroups: Story = {
  render: () => (
    <div className="w-70">
      <Select>
        <SelectTrigger>
          <SelectValue placeholder="Select breed" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Dogs</SelectLabel>
            <SelectItem value="golden">Golden Retriever</SelectItem>
            <SelectItem value="labrador">Labrador</SelectItem>
            <SelectItem value="poodle">Poodle</SelectItem>
          </SelectGroup>
          <SelectSeparator />
          <SelectGroup>
            <SelectLabel>Cats</SelectLabel>
            <SelectItem value="persian">Persian</SelectItem>
            <SelectItem value="siamese">Siamese</SelectItem>
            <SelectItem value="maine-coon">Maine Coon</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  ),
};

export const Small: Story = {
  render: () => (
    <div className="w-55">
      <Select defaultValue="normal">
        <SelectTrigger size="sm">
          <SelectValue placeholder="Priority" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="urgent">Urgent</SelectItem>
          <SelectItem value="normal">Normal</SelectItem>
          <SelectItem value="low">Low</SelectItem>
        </SelectContent>
      </Select>
    </div>
  ),
};

export const WithLabel: Story = {
  render: () => (
    <div className="grid w-70 gap-1.5">
      <Label htmlFor="species">Species</Label>
      <Select>
        <SelectTrigger id="species">
          <SelectValue placeholder="Select species…" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="cat">Cat</SelectItem>
          <SelectItem value="dog">Dog</SelectItem>
        </SelectContent>
      </Select>
    </div>
  ),
};

export const Disabled: Story = {
  render: () => (
    <div className="w-70">
      <Select disabled>
        <SelectTrigger>
          <SelectValue placeholder="Disabled" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">A</SelectItem>
        </SelectContent>
      </Select>
    </div>
  ),
};
