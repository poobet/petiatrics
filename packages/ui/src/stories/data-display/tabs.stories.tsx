import type { Meta, StoryObj } from '@storybook/react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../tabs';

const meta = {
  title: 'Data Display/Tabs',
  component: Tabs,
  tags: ['autodocs'],
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Tabs defaultValue="overview" className="w-115">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="records">Records</TabsTrigger>
        <TabsTrigger value="billing">Billing</TabsTrigger>
      </TabsList>
      <TabsContent value="overview" className="rounded-md border p-4">
        Patient overview with latest vitals and appointment summary.
      </TabsContent>
      <TabsContent value="records" className="rounded-md border p-4">
        Medical history, prescriptions, and vaccination timeline.
      </TabsContent>
      <TabsContent value="billing" className="rounded-md border p-4">
        Invoices, payment status, and claim references.
      </TabsContent>
    </Tabs>
  ),
};

export const ManyTabs: Story = {
  render: () => (
    <Tabs defaultValue="info" className="w-150">
      <TabsList>
        <TabsTrigger value="info">Info</TabsTrigger>
        <TabsTrigger value="vitals">Vitals</TabsTrigger>
        <TabsTrigger value="vaccines">Vaccines</TabsTrigger>
        <TabsTrigger value="visits">Visits</TabsTrigger>
        <TabsTrigger value="documents">Documents</TabsTrigger>
      </TabsList>
      <TabsContent value="info" className="rounded-md border p-4">Basic patient information</TabsContent>
      <TabsContent value="vitals" className="rounded-md border p-4">Vitals history chart</TabsContent>
      <TabsContent value="vaccines" className="rounded-md border p-4">Vaccination schedule</TabsContent>
      <TabsContent value="visits" className="rounded-md border p-4">Past visits log</TabsContent>
      <TabsContent value="documents" className="rounded-md border p-4">Uploaded documents</TabsContent>
    </Tabs>
  ),
};
