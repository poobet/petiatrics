import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { Dashboard } from '../../../../../documents/display/src/app/pages/Dashboard';
import { Appointments } from '../../../../../documents/display/src/app/pages/Appointments';
import { Clients } from '../../../../../documents/display/src/app/pages/Clients';
import { Patients } from '../../../../../documents/display/src/app/pages/Patients';
import { MobileOwnerApp } from '../../../../../documents/display/src/app/pages/MobileOwnerApp';
import { Billing } from '../../../../../documents/display/src/app/pages/Billing';
import { MedicalRecords } from '../../../../../documents/display/src/app/pages/MedicalRecords';
import { Staff } from '../../../../../documents/display/src/app/pages/Staff';
import { DashboardLayout } from '../../../../../documents/display/src/app/layouts/DashboardLayout';
import { InventoryProductEdit } from '../../../../../documents/display/src/app/pages/InventoryProductEdit';

const meta = {
  title: 'Pages/Figma Mockups',
  parameters: { layout: 'fullscreen' },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const DashboardPage: Story = {
  render: () => (
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route element={<DashboardLayout />}>
          <Route index element={<Dashboard />} />
        </Route>
      </Routes>
    </MemoryRouter>
  ),
};

export const AppointmentsPage: Story = {
  render: () => (
    <MemoryRouter initialEntries={['/appointments']}>
      <Routes>
        <Route element={<DashboardLayout />}>
          <Route path="/appointments" element={<Appointments />} />
        </Route>
      </Routes>
    </MemoryRouter>
  ),
};

export const ClientsPage: Story = {
  render: () => (
    <MemoryRouter initialEntries={['/clients']}>
      <Routes>
        <Route element={<DashboardLayout />}>
          <Route path="/clients" element={<Clients />} />
        </Route>
      </Routes>
    </MemoryRouter>
  ),
};

export const PatientsPage: Story = {
  render: () => (
    <MemoryRouter initialEntries={['/patients']}>
      <Routes>
        <Route element={<DashboardLayout />}>
          <Route path="/patients" element={<Patients />} />
        </Route>
      </Routes>
    </MemoryRouter>
  ),
};

export const BillingPage: Story = {
  render: () => (
    <MemoryRouter initialEntries={['/billing']}>
      <Routes>
        <Route element={<DashboardLayout />}>
          <Route path="/billing" element={<Billing />} />
        </Route>
      </Routes>
    </MemoryRouter>
  ),
};

export const MedicalRecordsPage: Story = {
  render: () => (
    <MemoryRouter initialEntries={['/medical-records']}>
      <Routes>
        <Route element={<DashboardLayout />}>
          <Route path="/medical-records" element={<MedicalRecords />} />
        </Route>
      </Routes>
    </MemoryRouter>
  ),
};

export const StaffPage: Story = {
  render: () => (
    <MemoryRouter initialEntries={['/staff']}>
      <Routes>
        <Route element={<DashboardLayout />}>
          <Route path="/staff" element={<Staff />} />
        </Route>
      </Routes>
    </MemoryRouter>
  ),
};

export const InventoryProductEditPage: Story = {
  render: () => (
    <MemoryRouter initialEntries={['/inventory/products/5b39f840-fe0e-44dc-833b-da80fbe57b30/edit']}>
      <Routes>
        <Route element={<DashboardLayout />}>
          <Route path="/inventory/products/:id/edit" element={<InventoryProductEdit />} />
        </Route>
      </Routes>
    </MemoryRouter>
  ),
};

export const OwnerMobileApp: Story = {
  render: () => (
    <MemoryRouter initialEntries={['/mobile']}>
      <MobileOwnerApp />
    </MemoryRouter>
  ),
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
  },
};
