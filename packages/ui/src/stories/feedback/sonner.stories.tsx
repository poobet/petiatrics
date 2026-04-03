import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { Button } from '../../button';
import { Toaster } from '../../sonner';
import { toast } from 'sonner';

const meta = {
  title: 'Feedback/Sonner',
  component: Toaster,
  tags: ['autodocs'],
  decorators: [
    (Story: React.ComponentType) => (
      <>
        <Story />
        <Toaster />
      </>
    ),
  ],
} satisfies Meta<typeof Toaster>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Button onClick={() => toast('Appointment saved successfully')}>
      Show Toast
    </Button>
  ),
};

export const Success: Story = {
  render: () => (
    <Button onClick={() => toast.success('Vaccination record updated')}>
      Success Toast
    </Button>
  ),
};

export const Error: Story = {
  render: () => (
    <Button onClick={() => toast.error('Failed to save patient record')}>
      Error Toast
    </Button>
  ),
};

export const WithDescription: Story = {
  render: () => (
    <Button onClick={() => toast('Reminder Sent', { description: 'SMS reminder sent to owner for tomorrow\'s appointment' })}>
      Toast with Description
    </Button>
  ),
};

export const WithAction: Story = {
  render: () => (
    <Button onClick={() => toast('Visit deleted', {
      action: { label: 'Undo', onClick: () => toast('Restored') },
    })}>
      Toast with Action
    </Button>
  ),
};
