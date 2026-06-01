import { Activity, Calendar, TrendingUp, Users, Clock, ArrowUpRight, DollarSign, PawPrint } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Button } from '../components/ui/button';
import { dashboardStats, mockAppointments, mockPets, revenueData, appointmentTypeData } from '../data/mockData';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
const getTypeLabel = (type) => {
    const labels = {
        'checkup': 'ตรวจสุขภาพ',
        'vaccination': 'ฉีดวัคซีน',
        'surgery': 'ผ่าตัด',
        'grooming': 'ดูแลขน',
        'emergency': 'ฉุกเฉิน',
        'dental': 'ทันตกรรม'
    };
    return labels[type] || type;
};
const getStatusLabel = (status) => {
    const labels = {
        'scheduled': 'นัดหมายแล้ว',
        'in-progress': 'กำลังดำเนินการ',
        'completed': 'เสร็จสิ้น',
        'cancelled': 'ยกเลิก'
    };
    return labels[status] || status;
};
const getHealthStatusLabel = (status) => {
    const labels = {
        'healthy': 'สุขภาพดี',
        'treatment': 'กำลังรักษา',
        'critical': 'วิกฤต'
    };
    return labels[status] || status;
};
export function Dashboard() {
    const todayAppointments = mockAppointments.filter(apt => apt.date === '2026-02-18');
    const upcomingAppointments = todayAppointments.slice(0, 5);
    const recentPatients = mockPets.slice(0, 4);
    return (<div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-semibold text-gray-900">แดชบอร์ด</h1>
        <p className="text-gray-600 mt-1">ยินดีต้อนรับกลับมา! นี่คือสิ่งที่เกิดขึ้นวันนี้</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600">การนัดหมายวันนี้</p>
                <p className="text-3xl font-semibold text-gray-900 mt-2">{dashboardStats.todayAppointments}</p>
                <div className="flex items-center gap-1 mt-2">
                  <ArrowUpRight className="w-4 h-4 text-green-600"/>
                  <span className="text-sm text-green-600 font-medium">8% เทียบกับเมื่อวาน</span>
                </div>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <Calendar className="w-6 h-6 text-blue-600"/>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600">ผู้ป่วยในคลินิก</p>
                <p className="text-3xl font-semibold text-gray-900 mt-2">{dashboardStats.patientsInClinic}</p>
                <div className="flex items-center gap-1 mt-2">
                  <Activity className="w-4 h-4 text-blue-600"/>
                  <span className="text-sm text-gray-600 font-medium">กำลังดำเนินการ</span>
                </div>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <PawPrint className="w-6 h-6 text-green-600"/>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600">รายได้วันนี้</p>
                <p className="text-3xl font-semibold text-gray-900 mt-2">฿{dashboardStats.revenue.today.toLocaleString()}</p>
                <div className="flex items-center gap-1 mt-2">
                  <ArrowUpRight className="w-4 h-4 text-green-600"/>
                  <span className="text-sm text-green-600 font-medium">เติบโต {dashboardStats.revenue.trend}%</span>
                </div>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-orange-600"/>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600">ผู้ป่วยทั้งหมด</p>
                <p className="text-3xl font-semibold text-gray-900 mt-2">{dashboardStats.activePatients}</p>
                <div className="flex items-center gap-1 mt-2">
                  <TrendingUp className="w-4 h-4 text-green-600"/>
                  <span className="text-sm text-gray-600 font-medium">จำนวนที่ลงทะเบียน</span>
                </div>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-purple-600"/>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's Appointments */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>การนัดหมายวันนี้</CardTitle>
                <CardDescription>วันพุธที่ 18 กุมภาพันธ์ 2026</CardDescription>
              </div>
              <Button variant="outline" size="sm">ดูทั้งหมด</Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {upcomingAppointments.map((apt) => (<div key={apt.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                  <div className="flex-shrink-0">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${apt.type === 'emergency' ? 'bg-orange-100' :
                apt.type === 'surgery' ? 'bg-blue-100' :
                    apt.type === 'grooming' ? 'bg-green-100' :
                        'bg-gray-200'}`}>
                      <Clock className={`w-6 h-6 ${apt.type === 'emergency' ? 'text-orange-600' :
                apt.type === 'surgery' ? 'text-blue-600' :
                    apt.type === 'grooming' ? 'text-green-600' :
                        'text-gray-600'}`}/>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900">{apt.petName}</p>
                      <Badge variant={apt.status === 'in-progress' ? 'default' :
                apt.status === 'completed' ? 'secondary' :
                    'outline'} className="text-xs">
                        {getStatusLabel(apt.status)}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600">{apt.clientName} • {apt.veterinarian}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">{apt.time} น.</p>
                    <p className="text-xs text-gray-500">{getTypeLabel(apt.type)}</p>
                  </div>
                </div>))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>ผู้ป่วยล่าสุด</CardTitle>
            <CardDescription>เช็คอินล่าสุด</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentPatients.map((pet) => (<div key={pet.id} className="flex items-center gap-3">
                  <Avatar className="w-12 h-12 rounded-xl">
                    <AvatarImage src={pet.imageUrl} alt={pet.name}/>
                    <AvatarFallback>{pet.name[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900">{pet.name}</p>
                    <p className="text-sm text-gray-600">{pet.breed}</p>
                  </div>
                  <Badge variant={pet.status === 'healthy' ? 'secondary' : pet.status === 'treatment' ? 'default' : 'destructive'} className={pet.status === 'healthy' ? 'bg-green-100 text-green-700 hover:bg-green-100' :
                pet.status === 'treatment' ? 'bg-blue-100 text-blue-700 hover:bg-blue-100' :
                    'bg-orange-100 text-orange-700 hover:bg-orange-100'}>
                    {getHealthStatusLabel(pet.status)}
                  </Badge>
                </div>))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Chart */}
        <Card>
          <CardHeader>
            <CardTitle>รายได้รายเดือน</CardTitle>
            <CardDescription>แนวโน้มรายได้ใน 6 เดือนที่ผ่านมา</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                <XAxis dataKey="month" stroke="#9ca3af"/>
                <YAxis stroke="#9ca3af"/>
                <Tooltip contentStyle={{
            backgroundColor: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
        }}/>
                <Bar dataKey="revenue" fill="#3b82f6" radius={[8, 8, 0, 0]}/>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Appointment Types */}
        <Card>
          <CardHeader>
            <CardTitle>สัดส่วนการนัดหมาย</CardTitle>
            <CardDescription>แบ่งตามประเภทการนัดหมาย</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={appointmentTypeData} cx="50%" cy="50%" labelLine={false} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} outerRadius={100} fill="#8884d8" dataKey="value">
                  {appointmentTypeData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color}/>))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>ดำเนินการด่วน</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button variant="outline" className="h-auto py-4 flex-col gap-2">
              <Calendar className="w-5 h-5"/>
              <span>นัดหมายใหม่</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2">
              <PawPrint className="w-5 h-5"/>
              <span>เพิ่มผู้ป่วย</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2">
              <Users className="w-5 h-5"/>
              <span>เพิ่มเจ้าของสัตว์</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2">
              <DollarSign className="w-5 h-5"/>
              <span>สร้างใบแจ้งหนี้</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>);
}
