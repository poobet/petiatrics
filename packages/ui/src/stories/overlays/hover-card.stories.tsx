import type { Meta, StoryObj } from '@storybook/react';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '../../hover-card';
import { Avatar, AvatarFallback } from '../../avatar';
import { Button } from '../../button';

const meta = {
  title: 'Overlays/HoverCard',
  component: HoverCard,
  tags: ['autodocs'],
} satisfies Meta<typeof HoverCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <HoverCard>
      <HoverCardTrigger asChild>
        <Button variant="link">@luna</Button>
      </HoverCardTrigger>
      <HoverCardContent className="w-80">
        <div className="flex gap-4">
          <Avatar>
            <AvatarFallback>LU</AvatarFallback>
          </Avatar>
          <div className="space-y-1">
            <h4 className="text-sm font-semibold">Luna</h4>
            <p className="text-sm text-muted-foreground">
              Domestic Shorthair · Female · 3 years
            </p>
            <p className="text-xs text-muted-foreground">
              Owner: S. Patel · Last visit: Mar 15, 2026
            </p>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  ),
};
