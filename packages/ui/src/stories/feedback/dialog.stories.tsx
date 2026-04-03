import type { Meta, StoryObj } from '@storybook/react';
import { Button } from '../../button';
import { Input } from '../../input';
import { Label } from '../../label';
import {
  Dialog, DialogClose, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '../../dialog';

const meta = {
  title: 'Feedback/Dialog',
  component: Dialog,
  tags: ['autodocs'],
} satisfies Meta<typeof Dialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Open Dialog</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm Appointment Change</DialogTitle>
          <DialogDescription>
            This will notify the owner and update the schedule timeline.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
          <Button>Confirm</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};

export const WithForm: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Add New Patient</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-106.25">
        <DialogHeader>
          <DialogTitle>New Patient</DialogTitle>
          <DialogDescription>
            Enter the patient details below. Click save when done.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" placeholder="e.g. Luna" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="species">Species</Label>
            <Input id="species" placeholder="e.g. Cat" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="breed">Breed</Label>
            <Input id="breed" placeholder="e.g. Domestic Shorthair" />
          </div>
        </div>
        <DialogFooter>
          <Button type="submit">Save Patient</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};
