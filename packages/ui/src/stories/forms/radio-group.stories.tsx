import type { Meta, StoryObj } from '@storybook/react';
import { RadioGroup, RadioGroupItem } from '../../radio-group';
import { Label } from '../../label';

const meta = {
  title: 'Forms/RadioGroup',
  component: RadioGroup,
  tags: ['autodocs'],
} satisfies Meta<typeof RadioGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <RadioGroup defaultValue="dog">
      <div className="flex items-center gap-2">
        <RadioGroupItem value="dog" id="dog" />
        <Label htmlFor="dog">Dog</Label>
      </div>
      <div className="flex items-center gap-2">
        <RadioGroupItem value="cat" id="cat" />
        <Label htmlFor="cat">Cat</Label>
      </div>
      <div className="flex items-center gap-2">
        <RadioGroupItem value="bird" id="bird" />
        <Label htmlFor="bird">Bird</Label>
      </div>
    </RadioGroup>
  ),
};

export const Horizontal: Story = {
  render: () => (
    <RadioGroup defaultValue="male" className="flex gap-4">
      <div className="flex items-center gap-2">
        <RadioGroupItem value="male" id="male" />
        <Label htmlFor="male">Male</Label>
      </div>
      <div className="flex items-center gap-2">
        <RadioGroupItem value="female" id="female" />
        <Label htmlFor="female">Female</Label>
      </div>
    </RadioGroup>
  ),
};

export const Disabled: Story = {
  render: () => (
    <RadioGroup defaultValue="dog" disabled>
      <div className="flex items-center gap-2">
        <RadioGroupItem value="dog" id="d-dog" />
        <Label htmlFor="d-dog">Dog</Label>
      </div>
      <div className="flex items-center gap-2">
        <RadioGroupItem value="cat" id="d-cat" />
        <Label htmlFor="d-cat">Cat</Label>
      </div>
    </RadioGroup>
  ),
};
