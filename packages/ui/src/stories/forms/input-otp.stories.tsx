import type { Meta, StoryObj } from '@storybook/react';
import * as React from 'react';
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from '../../input-otp';
import { REGEXP_ONLY_DIGITS_AND_CHARS, REGEXP_ONLY_DIGITS } from 'input-otp';

const meta: Meta = {
  title: 'Forms/InputOTP',
  tags: ['autodocs'],
  argTypes: {
    maxLength: { control: 'number' },
    disabled: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { maxLength: 6 },
  render: (args: { maxLength?: number; disabled?: boolean }) => {
    const [value, setValue] = React.useState('');
    return (
      <div className="flex flex-col gap-2">
        <InputOTP maxLength={args.maxLength ?? 6} value={value} onChange={setValue}>
          <InputOTPGroup>
            <InputOTPSlot index={0} />
            <InputOTPSlot index={1} />
            <InputOTPSlot index={2} />
          </InputOTPGroup>
          <InputOTPSeparator />
          <InputOTPGroup>
            <InputOTPSlot index={3} />
            <InputOTPSlot index={4} />
            <InputOTPSlot index={5} />
          </InputOTPGroup>
        </InputOTP>
        <p className="text-sm text-muted-foreground">Value: {value || '—'}</p>
      </div>
    );
  },
};

export const DigitsOnly: Story = {
  render: () => {
    const [value, setValue] = React.useState('');
    return (
      <InputOTP maxLength={6} pattern={REGEXP_ONLY_DIGITS} value={value} onChange={setValue}>
        <InputOTPGroup>
          <InputOTPSlot index={0} />
          <InputOTPSlot index={1} />
          <InputOTPSlot index={2} />
          <InputOTPSlot index={3} />
          <InputOTPSlot index={4} />
          <InputOTPSlot index={5} />
        </InputOTPGroup>
      </InputOTP>
    );
  },
};

export const AlphanumericFour: Story = {
  render: () => {
    const [value, setValue] = React.useState('');
    return (
      <InputOTP
        maxLength={4}
        pattern={REGEXP_ONLY_DIGITS_AND_CHARS}
        value={value}
        onChange={setValue}
      >
        <InputOTPGroup>
          <InputOTPSlot index={0} />
          <InputOTPSlot index={1} />
          <InputOTPSlot index={2} />
          <InputOTPSlot index={3} />
        </InputOTPGroup>
      </InputOTP>
    );
  },
};

export const Disabled: Story = {
  args: { maxLength: 6, disabled: true },
  render: (args: { maxLength?: number; disabled?: boolean }) => (
    <InputOTP maxLength={args.maxLength ?? 6} disabled={args.disabled} value="123456">
      <InputOTPGroup>
        <InputOTPSlot index={0} />
        <InputOTPSlot index={1} />
        <InputOTPSlot index={2} />
      </InputOTPGroup>
      <InputOTPSeparator />
      <InputOTPGroup>
        <InputOTPSlot index={3} />
        <InputOTPSlot index={4} />
        <InputOTPSlot index={5} />
      </InputOTPGroup>
    </InputOTP>
  ),
};
