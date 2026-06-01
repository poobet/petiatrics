import { useState, Fragment } from 'react';
import { Filter, Plus, Search, ChevronLeft, ChevronRight, MoreVertical, } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, } from '../components/ui/dropdown-menu';
import { mockAppointments, mockPets } from '../data/mockData';
const timeSlots = [
    '08:00', '09:00', '10:00', '11:00', '12:00',
    '13:00', '14:00', '15:00', '16:00', '17:00'
];
const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const currentWeek = [
    { day: 'Mon', date: 16 },
    { day: 'Tue', date: 17 },
    { day: 'Wed', date: 18 },
    { day: 'Thu', date: 19 },
    { day: 'Fri', date: 20 },
    { day: 'Sat', date: 21 },
    { day: 'Sun', date: 22 },
];
export function Appointments() {
    const [selectedDate, setSelectedDate] = useState('2026-02-18');
    const [viewMode, setViewMode] = useState('calendar');
    const getAppointmentColor = (type) => {
        switch (type) {
            case 'emergency':
                return 'bg-orange-500 border-orange-600';
            case 'surgery':
                return 'bg-blue-500 border-blue-600';
            case 'grooming':
                return 'bg-green-500 border-green-600';
            case 'vaccination':
                return 'bg-purple-500 border-purple-600';
            case 'dental':
                return 'bg-cyan-500 border-cyan-600';
            default:
                return 'bg-blue-500 border-blue-600';
        }
    };
    const getStatusBadge = (status) => {
        switch (status) {
            case 'completed':
                return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Completed</Badge>;
            case 'in-progress':
                return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">In Progress</Badge>;
            case 'cancelled':
                return <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100">Cancelled</Badge>;
            default:
                return <Badge variant="outline">Scheduled</Badge>;
        }
    };
    const todayAppointments = mockAppointments.filter(apt => apt.date === selectedDate);
    return (<div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">Appointments</h1>
          <p className="text-gray-600 mt-1">Manage and schedule appointments</p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2"/>
          New Appointment
        </Button>
      </div>

      {/* Filters and View Toggle */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"/>
          <input type="text" placeholder="Search appointments..." className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <Filter className="w-4 h-4"/>
            Filters
          </Button>
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v)} className="w-auto">
            <TabsList>
              <TabsTrigger value="calendar">Calendar</TabsTrigger>
              <TabsTrigger value="list">List</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {viewMode === 'calendar' ? (<>
          {/* Week Navigator */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900">February 2026</h2>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    <ChevronLeft className="w-4 h-4"/>
                  </Button>
                  <Button variant="outline" size="sm">Today</Button>
                  <Button variant="outline" size="sm">
                    <ChevronRight className="w-4 h-4"/>
                  </Button>
                </div>
              </div>

              {/* Week View */}
              <div className="grid grid-cols-8 gap-px bg-gray-200 border border-gray-200 rounded-lg overflow-hidden">
                {/* Time column header */}
                <div className="bg-white p-3">
                  <p className="text-xs font-medium text-gray-500">Time</p>
                </div>
                
                {/* Day headers */}
                {currentWeek.map((day) => (<div key={day.date} className={`bg-white p-3 ${day.date === 18 ? 'bg-blue-50' : ''}`}>
                    <p className="text-sm font-medium text-gray-900">{day.day}</p>
                    <p className={`text-xs ${day.date === 18 ? 'text-blue-600 font-medium' : 'text-gray-500'}`}>
                      {day.date}
                    </p>
                  </div>))}

                {/* Time slots and appointments */}
                {timeSlots.slice(0, 6).map((time) => (<Fragment key={`row-${time}`}>
                    <div className="bg-white p-3 border-t border-gray-100">
                      <p className="text-xs text-gray-500">{time}</p>
                    </div>
                    {currentWeek.map((day) => {
                    const dayDate = `2026-02-${day.date.toString().padStart(2, '0')}`;
                    const appointment = mockAppointments.find(apt => apt.date === dayDate && apt.time.startsWith(time.split(':')[0]));
                    return (<div key={`${day.date}-${time}`} className={`bg-white p-2 border-t border-gray-100 min-h-[80px] ${day.date === 18 ? 'bg-blue-50/50' : ''}`}>
                          {appointment && (<div className={`${getAppointmentColor(appointment.type)} text-white p-2 rounded-lg text-xs border-l-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer`}>
                              <p className="font-medium">{appointment.petName}</p>
                              <p className="opacity-90 mt-0.5">{appointment.time}</p>
                              <p className="opacity-75 text-[10px] mt-0.5 capitalize">{appointment.type}</p>
                            </div>)}
                        </div>);
                })}
                  </Fragment>))}
              </div>
            </CardContent>
          </Card>

          {/* Today's Schedule */}
          <Card>
            <CardHeader>
              <CardTitle>Today's Schedule - Wednesday, Feb 18</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {todayAppointments.map((apt) => {
                const pet = mockPets.find(p => p.id === apt.petId);
                return (<div key={apt.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                      <Avatar className="w-12 h-12 rounded-xl">
                        <AvatarImage src={pet?.imageUrl} alt={apt.petName}/>
                        <AvatarFallback>{apt.petName[0]}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-900">{apt.petName}</p>
                          {getStatusBadge(apt.status)}
                        </div>
                        <p className="text-sm text-gray-600">{apt.clientName}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {apt.veterinarian} • {apt.duration} mins
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900">{apt.time}</p>
                        <Badge variant="outline" className="mt-1 capitalize text-xs">
                          {apt.type}
                        </Badge>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="w-4 h-4"/>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>View Details</DropdownMenuItem>
                          <DropdownMenuItem>Edit Appointment</DropdownMenuItem>
                          <DropdownMenuItem>Mark as Completed</DropdownMenuItem>
                          <DropdownMenuItem className="text-red-600">Cancel</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>);
            })}
              </div>
            </CardContent>
          </Card>
        </>) : (
        /* List View */
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Patient</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Owner</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Veterinarian</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date & Time</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {mockAppointments.map((apt) => {
                const pet = mockPets.find(p => p.id === apt.petId);
                return (<tr key={apt.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <Avatar className="w-10 h-10 rounded-lg">
                              <AvatarImage src={pet?.imageUrl}/>
                              <AvatarFallback>{apt.petName[0]}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-gray-900">{apt.petName}</p>
                              <p className="text-sm text-gray-500">{pet?.breed}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">{apt.clientName}</td>
                        <td className="px-6 py-4">
                          <Badge variant="outline" className="capitalize">
                            {apt.type}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">{apt.veterinarian}</td>
                        <td className="px-6 py-4">
                          <p className="text-sm text-gray-900">{apt.date}</p>
                          <p className="text-xs text-gray-500">{apt.time} ({apt.duration}m)</p>
                        </td>
                        <td className="px-6 py-4">{getStatusBadge(apt.status)}</td>
                        <td className="px-6 py-4 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreVertical className="w-4 h-4"/>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem>View Details</DropdownMenuItem>
                              <DropdownMenuItem>Edit</DropdownMenuItem>
                              <DropdownMenuItem>Complete</DropdownMenuItem>
                              <DropdownMenuItem className="text-red-600">Cancel</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>);
            })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>)}
    </div>);
}
