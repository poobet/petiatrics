// Mock data for Pet Clinic Management System

export interface Pet {
  id: string;
  name: string;
  species: string;
  breed: string;
  age: string;
  weight: string;
  owner: string;
  ownerId: string;
  status: 'healthy' | 'treatment' | 'critical';
  lastVisit: string;
  nextAppointment?: string;
  imageUrl: string;
  microchipId?: string;
  color?: string;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  pets: string[];
  totalVisits: number;
  outstandingBalance: number;
  joinDate: string;
  imageUrl: string;
}

export interface Appointment {
  id: string;
  petId: string;
  petName: string;
  clientName: string;
  type: 'checkup' | 'vaccination' | 'surgery' | 'grooming' | 'emergency' | 'dental';
  veterinarian: string;
  date: string;
  time: string;
  duration: number;
  status: 'scheduled' | 'in-progress' | 'completed' | 'cancelled';
  notes?: string;
}

export interface MedicalRecord {
  id: string;
  petId: string;
  date: string;
  type: string;
  veterinarian: string;
  diagnosis: string;
  treatment: string;
  prescription?: string;
  notes?: string;
  nextVisit?: string;
}

export interface Staff {
  id: string;
  name: string;
  role: 'Veterinarian' | 'Vet Tech' | 'Receptionist' | 'Groomer';
  email: string;
  phone: string;
  schedule: string;
  imageUrl: string;
  status: 'available' | 'busy' | 'off-duty';
}

export const mockPets: Pet[] = [
  {
    id: '1',
    name: 'แม็กซ์',
    species: 'สุนัข',
    breed: 'โกลเด้น รีทรีฟเวอร์',
    age: '4 ปี',
    weight: '32 กก.',
    owner: 'ซาร่า จอห์นสัน',
    ownerId: '1',
    status: 'healthy',
    lastVisit: '2026-02-10',
    nextAppointment: '2026-03-15',
    imageUrl: 'https://images.unsplash.com/photo-1633722715463-d30f4f325e24?w=400',
    microchipId: 'MC982374982',
    color: 'สีทอง'
  },
  {
    id: '2',
    name: 'ลูน่า',
    species: 'แมว',
    breed: 'เปอร์เซีย',
    age: '2 ปี',
    weight: '4.5 กก.',
    owner: 'ไมเคิล เฉิน',
    ownerId: '2',
    status: 'treatment',
    lastVisit: '2026-02-15',
    nextAppointment: '2026-02-22',
    imageUrl: 'https://images.unsplash.com/photo-1573865526739-10c1d3a1f0aa?w=400',
    microchipId: 'MC982374983',
    color: 'ขาว'
  },
  {
    id: '3',
    name: 'ชาร์ลี',
    species: 'สุนัข',
    breed: 'บีเกิ้ล',
    age: '6 ปี',
    weight: '13 กก.',
    owner: 'เอมิลี่ เดวิส',
    ownerId: '3',
    status: 'healthy',
    lastVisit: '2026-01-28',
    nextAppointment: '2026-04-10',
    imageUrl: 'https://images.unsplash.com/photo-1505628346881-b72b27e84530?w=400',
    microchipId: 'MC982374984',
    color: 'สามสี'
  },
  {
    id: '4',
    name: 'เบลล่า',
    species: 'สุนัข',
    breed: 'ลาบราดอร์',
    age: '3 ปี',
    weight: '28 กก.',
    owner: 'เจมส์ วิลสัน',
    ownerId: '4',
    status: 'healthy',
    lastVisit: '2026-02-05',
    imageUrl: 'https://images.unsplash.com/photo-1591769225440-811ad7d6eab3?w=400',
    microchipId: 'MC982374985',
    color: 'เหลือง'
  },
  {
    id: '5',
    name: 'ไมโล',
    species: 'แมว',
    breed: 'สยาม',
    age: '5 ปี',
    weight: '5.2 กก.',
    owner: 'ซาร่า จอห์นสัน',
    ownerId: '1',
    status: 'healthy',
    lastVisit: '2026-02-12',
    imageUrl: 'https://images.unsplash.com/photo-1513360371669-4adf3dd7dff8?w=400',
    microchipId: 'MC982374986',
    color: 'ซีลพอยท์'
  },
  {
    id: '6',
    name: 'ร็อคกี้',
    species: 'สุนัข',
    breed: 'เยอรมัน เชพเพิร์ด',
    age: '7 ปี',
    weight: '35 กก.',
    owner: 'เดวิด มาร์ติเนซ',
    ownerId: '5',
    status: 'treatment',
    lastVisit: '2026-02-16',
    nextAppointment: '2026-02-20',
    imageUrl: 'https://images.unsplash.com/photo-1568572933382-74d440642117?w=400',
    microchipId: 'MC982374987',
    color: 'ดำแทน'
  }
];

export const mockClients: Client[] = [
  {
    id: '1',
    name: 'ซาร่า จอห์นสัน',
    email: 'sarah.johnson@email.com',
    phone: '081-234-5678',
    address: '123 ถนนเมเปิ้ล สปริงฟิลด์',
    pets: ['1', '5'],
    totalVisits: 24,
    outstandingBalance: 0,
    joinDate: '2023-05-15',
    imageUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400'
  },
  {
    id: '2',
    name: 'ไมเคิล เฉิน',
    email: 'michael.chen@email.com',
    phone: '082-345-6789',
    address: '456 ถนนโอ๊ค สปริงฟิลด์',
    pets: ['2'],
    totalVisits: 15,
    outstandingBalance: 3765,
    joinDate: '2024-01-20',
    imageUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400'
  },
  {
    id: '3',
    name: 'เอมิลี่ เดวิส',
    email: 'emily.davis@email.com',
    phone: '083-456-7890',
    address: '789 ถนนไพน์ สปริงฟิลด์',
    pets: ['3'],
    totalVisits: 32,
    outstandingBalance: 0,
    joinDate: '2022-08-10',
    imageUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400'
  },
  {
    id: '4',
    name: 'เจมส์ วิลสัน',
    email: 'james.wilson@email.com',
    phone: '084-567-8901',
    address: '321 ถนนเบิร์ช สปริงฟิลด์',
    pets: ['4'],
    totalVisits: 18,
    outstandingBalance: 8250,
    joinDate: '2023-11-05',
    imageUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400'
  },
  {
    id: '5',
    name: 'เดวิด มาร์ติเนซ',
    email: 'david.martinez@email.com',
    phone: '085-678-9012',
    address: '654 ถนนซีดาร์ สปริงฟิลด์',
    pets: ['6'],
    totalVisits: 28,
    outstandingBalance: 0,
    joinDate: '2022-03-22',
    imageUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400'
  }
];

export const mockAppointments: Appointment[] = [
  {
    id: '1',
    petId: '1',
    petName: 'แม็กซ์',
    clientName: 'ซาร่า จอห์นสัน',
    type: 'checkup',
    veterinarian: 'ดร.อแมนด้า ฟอสเตอร์',
    date: '2026-02-18',
    time: '09:00',
    duration: 30,
    status: 'scheduled',
    notes: 'ตรวจสุขภาพประจำปี'
  },
  {
    id: '2',
    petId: '2',
    petName: 'ลูน่า',
    clientName: 'ไมเคิล เฉ��น',
    type: 'vaccination',
    veterinarian: 'ดร.โรเบิร์ต คิม',
    date: '2026-02-18',
    time: '10:30',
    duration: 20,
    status: 'scheduled',
    notes: 'ฉีดวัคซีนป้องกันโรคพิษสุนัขบ้า (Booster)'
  },
  {
    id: '3',
    petId: '6',
    petName: 'ร็อคกี้',
    clientName: 'เดวิด มาร์ติเนซ',
    type: 'emergency',
    veterinarian: 'ดร.อแมนด้า ฟอสเตอร์',
    date: '2026-02-18',
    time: '11:00',
    duration: 45,
    status: 'in-progress',
    notes: 'ขาหน้าขวาเดินขากระเผลก'
  },
  {
    id: '4',
    petId: '3',
    petName: 'ชาร์ลี',
    clientName: 'เอมิลี่ เดวิส',
    type: 'dental',
    veterinarian: 'ดร.ลิซ่า มาร์ติเนซ',
    date: '2026-02-18',
    time: '14:00',
    duration: 60,
    status: 'scheduled',
    notes: 'ทำความสะอาดฟันและตรวจสุขภาพช่องปาก'
  },
  {
    id: '5',
    petId: '4',
    petName: 'เบลล่า',
    clientName: 'เจมส์ วิลสัน',
    type: 'grooming',
    veterinarian: 'ซาร่า ทอมป์สัน',
    date: '2026-02-18',
    time: '15:30',
    duration: 90,
    status: 'scheduled',
    notes: 'บริการอาบน้ำตัดขนแบบครบวงจร'
  },
  {
    id: '6',
    petId: '5',
    petName: 'ไมโล',
    clientName: 'ซาร่า จอห์นสัน',
    type: 'checkup',
    veterinarian: 'ดร.โรเบิร์ต คิม',
    date: '2026-02-19',
    time: '09:30',
    duration: 30,
    status: 'scheduled'
  },
  {
    id: '7',
    petId: '1',
    petName: 'แม็กซ์',
    clientName: 'ซาร่า จอห์นสัน',
    type: 'surgery',
    veterinarian: 'ดร.อแมนด้า ฟอสเตอร์',
    date: '2026-02-20',
    time: '10:00',
    duration: 120,
    status: 'scheduled',
    notes: 'ผ่าตัดเอาก้อนเนื้อที่ผิวหนังออก (รายเล็กน้อย)'
  }
];

export const mockMedicalRecords: MedicalRecord[] = [
  {
    id: '1',
    petId: '1',
    date: '2026-02-10',
    type: 'ตรวจสุขภาพ',
    veterinarian: 'ดร.อแมนด้า ฟอสเตอร์',
    diagnosis: 'สุขภาพดี - การตรวจสุขภาพตามปกติ',
    treatment: 'ไม่ต้องรักษา',
    notes: 'น้ำหนักคงที่ สภาพร่างกายดี แนะนำให้ทำความสะอาดฟันใน 6 เดือน',
    nextVisit: '2026-08-10'
  },
  {
    id: '2',
    petId: '2',
    date: '2026-02-15',
    type: 'การรักษา',
    veterinarian: 'ดร.โรเบิร์ต คิม',
    diagnosis: 'ติดเชื้อทางเดินหายใจส่วนบน',
    treatment: 'รับประทานยาปฏิชีวนะ',
    prescription: 'Amoxicillin 50mg รับประทานวันละ 2 ครั้ง เป็นเวลา 10 วัน',
    notes: 'นัดติดตามอาการใน 1 สัปดาห์',
    nextVisit: '2026-02-22'
  },
  {
    id: '3',
    petId: '3',
    date: '2026-01-28',
    type: 'ฉีดวัคซีน',
    veterinarian: 'ดร.ลิซ่า มาร์ติเนซ',
    diagnosis: 'ฉีดวัคซีนป้องกันโรคประจำปี',
    treatment: 'ฉีดวัคซีน DHPP และวัคซีนป้องกันโรคพิษสุนัขบ้า',
    notes: 'ไม่มีอาการแพ้ ครั้งต่อไปนัดในอีก 1 ปี',
    nextVisit: '2027-01-28'
  }
];

export const mockStaff: Staff[] = [
  {
    id: '1',
    name: 'ดร.อแมนด้า ฟอสเตอร์',
    role: 'Veterinarian',
    email: 'amanda.foster@petclinic.com',
    phone: '091-111-2222',
    schedule: 'จันทร์-ศุกร์ 08:00-16:00 น.',
    imageUrl: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=400',
    status: 'available'
  },
  {
    id: '2',
    name: 'ดร.โรเบิร์ต คิม',
    role: 'Veterinarian',
    email: 'robert.kim@petclinic.com',
    phone: '092-222-3333',
    schedule: 'จันทร์-ศุกร์ 10:00-18:00 น.',
    imageUrl: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=400',
    status: 'busy'
  },
  {
    id: '3',
    name: 'ดร.ลิซ่า มาร์ติเนซ',
    role: 'Veterinarian',
    email: 'lisa.martinez@petclinic.com',
    phone: '093-333-4444',
    schedule: 'อังคาร-เสาร์ 09:00-17:00 น.',
    imageUrl: 'https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=400',
    status: 'available'
  },
  {
    id: '4',
    name: 'ซาร่า ทอมป์สัน',
    role: 'Groomer',
    email: 'sarah.thompson@petclinic.com',
    phone: '094-444-5555',
    schedule: 'จันทร์-ศุกร์ 09:00-17:00 น.',
    imageUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400',
    status: 'available'
  },
  {
    id: '5',
    name: 'เควิน พาร์ค',
    role: 'Vet Tech',
    email: 'kevin.park@petclinic.com',
    phone: '095-555-6666',
    schedule: 'จันทร์-ศุกร์ 07:00-15:00 น.',
    imageUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400',
    status: 'available'
  }
];

export const dashboardStats = {
  todayAppointments: 12,
  patientsInClinic: 5,
  revenue: {
    today: 2840,
    month: 45230,
    trend: 12.5
  },
  activePatients: 247
};

export const revenueData = [
  { month: 'ม.ค.', revenue: 42000 },
  { month: 'ก.พ.', revenue: 45230 },
  { month: 'มี.ค.', revenue: 38500 },
  { month: 'เม.ย.', revenue: 51200 },
  { month: 'พ.ค.', revenue: 48900 },
  { month: 'มิ.ย.', revenue: 52300 }
];

export const appointmentTypeData = [
  { name: 'ตรวจสุขภาพ', value: 45, color: '#3b82f6' },
  { name: 'ฉีดวัคซีน', value: 25, color: '#10b981' },
  { name: 'ผ่าตัด', value: 10, color: '#f97316' },
  { name: 'ดูแลขน', value: 15, color: '#8b5cf6' },
  { name: 'ฉุกเฉิน', value: 5, color: '#ef4444' }
];
