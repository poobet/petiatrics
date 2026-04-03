import { useState } from 'react';
import {
  Search,
  Filter,
  Plus,
  MoreVertical,
  Download,
  Eye,
  Edit,
  Trash2,
  ArrowUpDown,
  Calendar,
  Activity,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { mockPets, mockMedicalRecords, mockAppointments } from '../data/mockData';

export function Patients() {
  const [selectedPet, setSelectedPet] = useState<typeof mockPets[0] | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const filteredPets = filterStatus === 'all' 
    ? mockPets 
    : mockPets.filter(pet => pet.status === filterStatus);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'healthy':
        return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Healthy</Badge>;
      case 'treatment':
        return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">In Treatment</Badge>;
      case 'critical':
        return <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100">Critical</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const petMedicalRecords = selectedPet 
    ? mockMedicalRecords.filter(record => record.petId === selectedPet.id)
    : [];

  const petAppointments = selectedPet
    ? mockAppointments.filter(apt => apt.petId === selectedPet.id)
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">Patients</h1>
          <p className="text-gray-600 mt-1">Manage patient records and information</p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" />
          Add Patient
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-600">Total Patients</p>
            <p className="text-2xl font-semibold text-gray-900 mt-1">{mockPets.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-600">Healthy</p>
            <p className="text-2xl font-semibold text-green-600 mt-1">
              {mockPets.filter(p => p.status === 'healthy').length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-600">In Treatment</p>
            <p className="text-2xl font-semibold text-blue-600 mt-1">
              {mockPets.filter(p => p.status === 'treatment').length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-600">Critical</p>
            <p className="text-2xl font-semibold text-orange-600 mt-1">
              {mockPets.filter(p => p.status === 'critical').length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search patients by name, breed, or owner..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Filter className="w-4 h-4" />
                Status: {filterStatus === 'all' ? 'All' : filterStatus}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setFilterStatus('all')}>All Status</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterStatus('healthy')}>Healthy</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterStatus('treatment')}>In Treatment</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterStatus('critical')}>Critical</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" className="gap-2">
            <Download className="w-4 h-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Patients Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    <button className="flex items-center gap-1 hover:text-gray-900">
                      Patient
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Species/Breed</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Owner</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Age/Weight</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Visit</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredPets.map((pet) => (
                  <tr key={pet.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedPet(pet)}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="w-12 h-12 rounded-xl">
                          <AvatarImage src={pet.imageUrl} alt={pet.name} />
                          <AvatarFallback>{pet.name[0]}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-gray-900">{pet.name}</p>
                          {pet.microchipId && (
                            <p className="text-xs text-gray-500">ID: {pet.microchipId}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-900">{pet.species}</p>
                      <p className="text-xs text-gray-500">{pet.breed}</p>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">{pet.owner}</td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-900">{pet.age}</p>
                      <p className="text-xs text-gray-500">{pet.weight}</p>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{pet.lastVisit}</td>
                    <td className="px-6 py-4">{getStatusBadge(pet.status)}</td>
                    <td className="px-6 py-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setSelectedPet(pet)}>
                            <Eye className="w-4 h-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Edit className="w-4 h-4 mr-2" />
                            Edit Patient
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Calendar className="w-4 h-4 mr-2" />
                            Book Appointment
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-red-600">
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Patient Detail Dialog */}
      <Dialog open={!!selectedPet} onOpenChange={(open) => !open && setSelectedPet(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          {selectedPet && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <Avatar className="w-16 h-16 rounded-xl">
                    <AvatarImage src={selectedPet.imageUrl} alt={selectedPet.name} />
                    <AvatarFallback>{selectedPet.name[0]}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-2xl">{selectedPet.name}</p>
                    <p className="text-sm text-gray-500 font-normal">{selectedPet.breed}</p>
                  </div>
                </DialogTitle>
              </DialogHeader>

              <Tabs defaultValue="info" className="mt-4">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="info">Information</TabsTrigger>
                  <TabsTrigger value="medical">Medical Records</TabsTrigger>
                  <TabsTrigger value="appointments">Appointments</TabsTrigger>
                </TabsList>

                <TabsContent value="info" className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Species</p>
                      <p className="font-medium text-gray-900">{selectedPet.species}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Breed</p>
                      <p className="font-medium text-gray-900">{selectedPet.breed}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Age</p>
                      <p className="font-medium text-gray-900">{selectedPet.age}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Weight</p>
                      <p className="font-medium text-gray-900">{selectedPet.weight}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Color</p>
                      <p className="font-medium text-gray-900">{selectedPet.color}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Microchip ID</p>
                      <p className="font-medium text-gray-900">{selectedPet.microchipId}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Owner</p>
                      <p className="font-medium text-gray-900">{selectedPet.owner}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Status</p>
                      {getStatusBadge(selectedPet.status)}
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Last Visit</p>
                      <p className="font-medium text-gray-900">{selectedPet.lastVisit}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Next Appointment</p>
                      <p className="font-medium text-gray-900">{selectedPet.nextAppointment || 'None scheduled'}</p>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="medical" className="mt-4">
                  <div className="space-y-4">
                    {petMedicalRecords.length > 0 ? (
                      petMedicalRecords.map((record) => (
                        <Card key={record.id}>
                          <CardContent className="pt-6">
                            <div className="flex items-start justify-between">
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline">{record.type}</Badge>
                                  <p className="text-sm text-gray-500">{record.date}</p>
                                </div>
                                <p className="font-medium text-gray-900">{record.diagnosis}</p>
                                <p className="text-sm text-gray-600">{record.treatment}</p>
                                {record.prescription && (
                                  <p className="text-sm text-blue-600">Rx: {record.prescription}</p>
                                )}
                                <p className="text-xs text-gray-500">By {record.veterinarian}</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    ) : (
                      <p className="text-center text-gray-500 py-8">No medical records found</p>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="appointments" className="mt-4">
                  <div className="space-y-3">
                    {petAppointments.length > 0 ? (
                      petAppointments.map((apt) => (
                        <Card key={apt.id}>
                          <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium text-gray-900 capitalize">{apt.type}</p>
                                <p className="text-sm text-gray-600 mt-1">{apt.veterinarian}</p>
                                <p className="text-xs text-gray-500 mt-1">{apt.notes}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-medium text-gray-900">{apt.date}</p>
                                <p className="text-sm text-gray-600">{apt.time}</p>
                                <Badge variant="outline" className="mt-2">{apt.status}</Badge>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    ) : (
                      <p className="text-center text-gray-500 py-8">No appointments found</p>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
