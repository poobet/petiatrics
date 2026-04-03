import type { Meta, StoryObj } from '@storybook/react';
import { Button } from '../../button';
import {
  Drawer, DrawerClose, DrawerContent, DrawerDescription,
  DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger,
} from '../../drawer';

const meta = {
  title: 'Feedback/Drawer',
  component: Drawer,
  tags: ['autodocs'],
} satisfies Meta<typeof Drawer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Drawer>
      <DrawerTrigger asChild>
        <Button variant="outline">Open Drawer</Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Patient Quick View</DrawerTitle>
          <DrawerDescription>Luna — Cat, Domestic Shorthair, 3 years</DrawerDescription>
        </DrawerHeader>
        <div className="px-4 pb-4 text-sm text-muted-foreground">
          <p>Weight: 4.2 kg</p>
          <p>Last visit: Mar 15, 2026</p>
          <p>Vaccination status: Up to date</p>
        </div>
        <DrawerFooter>
          <Button>View Full Profile</Button>
          <DrawerClose asChild>
            <Button variant="outline">Close</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  ),
};
