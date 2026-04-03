import type { Meta, StoryObj } from '@storybook/react';
import {
  Table, TableBody, TableCaption, TableCell, TableHead,
  TableHeader, TableFooter, TableRow,
} from '../../table';

const meta = {
  title: 'Data Display/Table',
  component: Table,
  tags: ['autodocs'],
} satisfies Meta<typeof Table>;

export default meta;
type Story = StoryObj<typeof meta>;

const appointments = [
  { id: 'APT-1031', patient: 'Luna', species: 'Cat', owner: 'S. Patel', status: 'Confirmed' },
  { id: 'APT-1032', patient: 'Milo', species: 'Dog', owner: 'K. Tan', status: 'Pending' },
  { id: 'APT-1033', patient: 'Coco', species: 'Dog', owner: 'P. Wong', status: 'Completed' },
  { id: 'APT-1034', patient: 'Biscuit', species: 'Cat', owner: 'L. Chen', status: 'Cancelled' },
];

export const Default: Story = {
  render: () => (
    <div className="w-150">
      <Table>
        <TableCaption>Today's appointments</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Visit ID</TableHead>
            <TableHead>Patient</TableHead>
            <TableHead>Species</TableHead>
            <TableHead>Owner</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {appointments.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-medium">{row.id}</TableCell>
              <TableCell>{row.patient}</TableCell>
              <TableCell>{row.species}</TableCell>
              <TableCell>{row.owner}</TableCell>
              <TableCell>{row.status}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  ),
};

const invoices = [
  { id: 'INV-001', desc: 'Vaccination', amount: 1500 },
  { id: 'INV-002', desc: 'Dental Cleaning', amount: 3200 },
  { id: 'INV-003', desc: 'X-Ray', amount: 2000 },
];

export const WithFooter: Story = {
  render: () => (
    <div className="w-125">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Invoice</TableHead>
            <TableHead>Description</TableHead>
            <TableHead className="text-right">Amount (฿)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.map((inv) => (
            <TableRow key={inv.id}>
              <TableCell className="font-medium">{inv.id}</TableCell>
              <TableCell>{inv.desc}</TableCell>
              <TableCell className="text-right">{inv.amount.toLocaleString()}</TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={2}>Total</TableCell>
            <TableCell className="text-right">
              {invoices.reduce((s, i) => s + i.amount, 0).toLocaleString()}
            </TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  ),
};
