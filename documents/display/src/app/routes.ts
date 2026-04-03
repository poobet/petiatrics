import { createBrowserRouter } from 'react-router';
import { DashboardLayout } from './layouts/DashboardLayout';
import { Dashboard } from './pages/Dashboard';
import { Appointments } from './pages/Appointments';
import { Patients } from './pages/Patients';
import { Clients } from './pages/Clients';
import { MedicalRecords } from './pages/MedicalRecords';
import { Billing } from './pages/Billing';
import { Staff } from './pages/Staff';
import { MobileOwnerApp } from './pages/MobileOwnerApp';

export const router = createBrowserRouter([
  {
    path: '/',
    Component: DashboardLayout,
    children: [
      { index: true, Component: Dashboard },
      { path: 'appointments', Component: Appointments },
      { path: 'patients', Component: Patients },
      { path: 'clients', Component: Clients },
      { path: 'medical-records', Component: MedicalRecords },
      { path: 'billing', Component: Billing },
      { path: 'staff', Component: Staff },
    ],
  },
  {
    path: '/mobile',
    Component: MobileOwnerApp,
  },
]);
