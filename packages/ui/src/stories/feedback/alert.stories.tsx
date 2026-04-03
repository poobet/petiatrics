import type { Meta, StoryObj } from '@storybook/react';
import { Alert, AlertDescription, AlertTitle } from '../../alert';
import { AlertCircle, CheckCircle, Info } from 'lucide-react';

const meta = {
  title: 'Feedback/Alert',
  component: Alert,
  tags: ['autodocs'],
  argTypes: {
    variant: { control: 'select', options: ['default', 'destructive'] },
  },
} satisfies Meta<typeof Alert>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Alert className="w-105">
      <Info className="size-4" />
      <AlertTitle>Appointment Confirmed</AlertTitle>
      <AlertDescription>
        The owner has confirmed the 10:30 AM slot for tomorrow.
      </AlertDescription>
    </Alert>
  ),
};

export const Destructive: Story = {
  render: () => (
    <Alert className="w-105" variant="destructive">
      <AlertCircle className="size-4" />
      <AlertTitle>Payment Failed</AlertTitle>
      <AlertDescription>
        Card authorization was declined. Please retry with a different method.
      </AlertDescription>
    </Alert>
  ),
};

export const Success: Story = {
  render: () => (
    <Alert className="w-105">
      <CheckCircle className="size-4" />
      <AlertTitle>Record Saved</AlertTitle>
      <AlertDescription>
        Vaccination record for Luna has been saved successfully.
      </AlertDescription>
    </Alert>
  ),
};

export const TitleOnly: Story = {
  render: () => (
    <Alert className="w-105">
      <AlertTitle>No upcoming appointments.</AlertTitle>
    </Alert>
  ),
};
