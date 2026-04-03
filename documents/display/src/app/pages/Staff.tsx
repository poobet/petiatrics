import { useState } from 'react';
import {
  Search,
  Filter,
  Plus,
  MoreVertical,
  Mail,
  Phone,
  Calendar,
  Clock,
  Edit,
  Trash2,
  Eye,
  UserCheck,
  UserX,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { mockStaff, mockAppointments } from '../data/mockData';

export function Staff() {
  const [filterRole, setFilterRole] = useState<string>('all');

  const filteredStaff = filterRole === 'all'
    ? mockStaff
    : mockStaff.filter(staff => staff.role === filterRole);

  const roles = ['all', 'Veterinarian', 'Vet Tech', 'Receptionist', 'Groomer'];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'available':
        return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Available</Badge>;
      case 'busy':
        return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">Busy</Badge>;
      case 'off-duty':
        return <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100">Off Duty</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'Veterinarian':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">{role}</Badge>;
      case 'Vet Tech':
        return <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">{role}</Badge>;
      case 'Groomer':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">{role}</Badge>;
      case 'Receptionist':
        return <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">{role}</Badge>;
      default:
        return <Badge variant="outline">{role}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">Staff Management</h1>
          <p className="text-gray-600 mt-1">Manage team members and schedules</p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" />
          Add Staff Member
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Staff</p>
                <p className="text-2xl font-semibold text-gray-900 mt-1">{mockStaff.length}</p>
              </div>
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <UserCheck className="w-5 h-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Available</p>
                <p className="text-2xl font-semibold text-green-600 mt-1">
                  {mockStaff.filter(s => s.status === 'available').length}
                </p>
              </div>
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <UserCheck className="w-5 h-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Busy</p>
                <p className="text-2xl font-semibold text-blue-600 mt-1">
                  {mockStaff.filter(s => s.status === 'busy').length}
                </p>
              </div>
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Veterinarians</p>
                <p className="text-2xl font-semibold text-gray-900 mt-1">
                  {mockStaff.filter(s => s.role === 'Veterinarian').length}
                </p>
              </div>
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <UserCheck className="w-5 h-5 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search staff by name, role, or email..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Filter className="w-4 h-4" />
              Role: {filterRole === 'all' ? 'All' : filterRole}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {roles.map((role) => (
              <DropdownMenuItem key={role} onClick={() => setFilterRole(role)}>
                {role.charAt(0).toUpperCase() + role.slice(1)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Staff Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredStaff.map((staff) => {
          const staffAppointments = mockAppointments.filter(apt => apt.veterinarian === staff.name);
          const todayAppointments = staffAppointments.filter(apt => apt.date === '2026-02-18');

          return (
            <Card key={staff.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <Avatar className="w-16 h-16">
                    <AvatarImage src={staff.imageUrl} alt={staff.name} />
                    <AvatarFallback>{staff.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-gray-900">{staff.name}</h3>
                        <div className="mt-1">{getRoleBadge(staff.role)}</div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Eye className="w-4 h-4 mr-2" />
                            View Profile
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Edit className="w-4 h-4 mr-2" />
                            Edit Staff
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Calendar className="w-4 h-4 mr-2" />
                            View Schedule
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-red-600">
                            <Trash2 className="w-4 h-4 mr-2" />
                            Remove
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Mail className="w-4 h-4" />
                    {staff.email}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Phone className="w-4 h-4" />
                    {staff.phone}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Clock className="w-4 h-4" />
                    {staff.schedule}
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Status</p>
                      <div className="mt-1">{getStatusBadge(staff.status)}</div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500">Today's Appointments</p>
                      <p className="text-2xl font-semibold text-gray-900 mt-1">{todayAppointments.length}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Today's Schedule */}
      <Card>
        <CardHeader>
          <CardTitle>Today's Schedule Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {mockStaff.filter(s => s.role === 'Veterinarian').map((staff) => {
              const todayAppointments = mockAppointments.filter(
                apt => apt.veterinarian === staff.name && apt.date === '2026-02-18'
              );

              return (
                <div key={staff.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                  <Avatar className="w-12 h-12">
                    <AvatarImage src={staff.imageUrl} alt={staff.name} />
                    <AvatarFallback>{staff.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{staff.name}</p>
                    <p className="text-sm text-gray-600">{staff.role}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <p className="text-sm text-gray-500">Appointments</p>
                      <p className="text-lg font-semibold text-gray-900">{todayAppointments.length}</p>
                    </div>
                    {getStatusBadge(staff.status)}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
