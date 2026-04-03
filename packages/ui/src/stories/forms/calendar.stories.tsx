import type { Meta, StoryObj } from '@storybook/react';
import * as React from 'react';
import { Calendar } from '../../calendar';

const meta = {
  title: 'Forms/Calendar',
  component: Calendar,
  tags: ['autodocs'],
} satisfies Meta<typeof Calendar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => {
    const [date, setDate] = React.useState<Date | undefined>(new Date());
    return <Calendar mode="single" selected={date} onSelect={setDate} />;
  },
};

export const WithSelectedDate: Story = {
  render: () => {
    const [date, setDate] = React.useState<Date | undefined>(
      new Date(2025, 0, 15),
    );
    return (
      <div className="border rounded-md inline-block">
        <Calendar mode="single" selected={date} onSelect={setDate} />
      </div>
    );
  },
};

export const RangeSelection: Story = {
  render: () => {
    const [range, setRange] = React.useState<
      { from: Date | undefined; to?: Date | undefined } | undefined
    >({ from: new Date(2025, 0, 10), to: new Date(2025, 0, 20) });
    return (
      <div className="border rounded-md inline-block">
        <Calendar
          mode="range"
          selected={range}
          onSelect={setRange}
          numberOfMonths={2}
        />
      </div>
    );
  },
};

export const Disabled: Story = {
  render: () => (
    <Calendar
      mode="single"
      disabled={(date) => date < new Date()}
      selected={undefined}
      onSelect={() => {}}
    />
  ),
};
