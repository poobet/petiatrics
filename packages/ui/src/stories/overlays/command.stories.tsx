import type { Meta, StoryObj } from '@storybook/react';
import {
  Command, CommandEmpty, CommandGroup, CommandInput,
  CommandItem, CommandList, CommandSeparator, CommandShortcut,
} from '../../command';
import { Search, Calendar, User, Stethoscope, FileText } from 'lucide-react';

const meta = {
  title: 'Overlays/Command',
  component: Command,
  tags: ['autodocs'],
} satisfies Meta<typeof Command>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Command className="rounded-lg border shadow-md w-100">
      <CommandInput placeholder="Search patients, appointments…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Patients">
          <CommandItem><User className="size-4" /> Luna — Cat</CommandItem>
          <CommandItem><User className="size-4" /> Milo — Dog</CommandItem>
          <CommandItem><User className="size-4" /> Coco — Dog</CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Quick Actions">
          <CommandItem>
            <Calendar className="size-4" /> New Appointment
            <CommandShortcut>⌘K</CommandShortcut>
          </CommandItem>
          <CommandItem>
            <Stethoscope className="size-4" /> Start Visit
          </CommandItem>
          <CommandItem>
            <FileText className="size-4" /> Generate Report
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  ),
};
