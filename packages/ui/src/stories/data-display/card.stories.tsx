import type { Meta, StoryObj } from '@storybook/react';
import { Button } from '../../button';
import {
  Card, CardAction, CardContent, CardDescription,
  CardFooter, CardHeader, CardTitle,
} from '../../card';

const meta = {
  title: 'Data Display/Card',
  component: Card,
  tags: ['autodocs'],
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Card className="w-95">
      <CardHeader>
        <CardTitle>Luna</CardTitle>
        <CardDescription>Domestic Shorthair · Female · 3 years</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Next appointment: Mar 30, 2026 — Annual check-up with Dr. Smith
        </p>
      </CardContent>
      <CardFooter className="gap-2">
        <Button size="sm">View Profile</Button>
        <Button size="sm" variant="outline">Book Visit</Button>
      </CardFooter>
    </Card>
  ),
};

export const WithAction: Story = {
  render: () => (
    <Card className="w-95">
      <CardHeader>
        <CardTitle>Today's Summary</CardTitle>
        <CardAction>
          <Button size="sm" variant="outline">Refresh</Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><span className="text-muted-foreground">Appointments</span><p className="text-2xl font-bold">12</p></div>
          <div><span className="text-muted-foreground">Completed</span><p className="text-2xl font-bold">8</p></div>
        </div>
      </CardContent>
    </Card>
  ),
};

export const Simple: Story = {
  render: () => (
    <Card className="w-75">
      <CardHeader>
        <CardTitle>Vaccination Due</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">Rabies booster due in 14 days.</p>
      </CardContent>
    </Card>
  ),
};
