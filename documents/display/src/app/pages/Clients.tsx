import { useState } from 'react';
import {
  Search,
  Filter,
  Plus,
  MoreVertical,
  Download,
  Mail,
  Phone,
  MapPin,
  PawPrint,
  DollarSign,
  Calendar,
  Edit,
  Trash2,
  Eye,
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
import { mockClients, mockPets, mockAppointments } from '../data/mockData';

export function Clients() {
  const [selectedClient, setSelectedClient] = useState<typeof mockClients[0] | null>(null);

  const clientPets = selectedClient
    ? mockPets.filter(pet => selectedClient.pets.includes(pet.id))
    : [];

  const clientAppointments = selectedClient
    ? mockAppointments.filter(apt => 
        clientPets.some(pet => pet.id === apt.petId)
      )
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">Clients</h1>
          <p className="text-gray-600 mt-1">Manage client information and relationships</p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" />
          Add Client
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Clients</p>
                <p className="text-2xl font-semibold text-gray-900 mt-1">{mockClients.length}</p>
              </div>
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <PawPrint className="w-5 h-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Clients</p>
                <p className="text-2xl font-semibold text-green-600 mt-1">
                  {mockClients.filter(c => c.totalVisits > 0).length}
                </p>
              </div>
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <Calendar className="w-5 h-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Visits</p>
                <p className="text-2xl font-semibold text-gray-900 mt-1">
                  {mockClients.reduce((sum, c) => sum + c.totalVisits, 0)}
                </p>
              </div>
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Calendar className="w-5 h-5 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Outstanding Balance</p>
                <p className="text-2xl font-semibold text-orange-600 mt-1">
                  ${mockClients.reduce((sum, c) => sum + c.outstandingBalance, 0).toFixed(2)}
                </p>
              </div>
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-orange-600" />
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
            placeholder="Search clients by name, email, or phone..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <Filter className="w-4 h-4" />
            Filters
          </Button>
          <Button variant="outline" className="gap-2">
            <Download className="w-4 h-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Clients Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Client</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pets</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Visits</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Balance</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Join Date</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {mockClients.map((client) => {
                  const pets = mockPets.filter(pet => client.pets.includes(pet.id));
                  return (
                    <tr key={client.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedClient(client)}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="w-12 h-12">
                            <AvatarImage src={client.imageUrl} alt={client.name} />
                            <AvatarFallback>{client.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-gray-900">{client.name}</p>
                            <p className="text-xs text-gray-500">{client.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Phone className="w-4 h-4" />
                            {client.phone}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <MapPin className="w-3 h-3" />
                            {client.address.split(',')[0]}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1">
                          <Badge variant="outline" className="gap-1">
                            <PawPrint className="w-3 h-3" />
                            {client.pets.length}
                          </Badge>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">{client.totalVisits}</td>
                      <td className="px-6 py-4">
                        {client.outstandingBalance > 0 ? (
                          <span className="text-sm font-medium text-orange-600">
                            ${client.outstandingBalance.toFixed(2)}
                          </span>
                        ) : (
                          <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                            Paid
                          </Badge>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{client.joinDate}</td>
                      <td className="px-6 py-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setSelectedClient(client)}>
                              <Eye className="w-4 h-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Edit className="w-4 h-4 mr-2" />
                              Edit Client
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Mail className="w-4 h-4 mr-2" />
                              Send Email
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-red-600">
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Client Detail Dialog */}
      <Dialog open={!!selectedClient} onOpenChange={(open) => !open && setSelectedClient(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          {selectedClient && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <Avatar className="w-16 h-16">
                    <AvatarImage src={selectedClient.imageUrl} alt={selectedClient.name} />
                    <AvatarFallback>{selectedClient.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-2xl">{selectedClient.name}</p>
                    <p className="text-sm text-gray-500 font-normal">Client since {selectedClient.joinDate}</p>
                  </div>
                </DialogTitle>
              </DialogHeader>

              <Tabs defaultValue="info" className="mt-4">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="info">Information</TabsTrigger>
                  <TabsTrigger value="pets">Pets</TabsTrigger>
                  <TabsTrigger value="appointments">Appointments</TabsTrigger>
                </TabsList>

                <TabsContent value="info" className="space-y-4 mt-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Contact Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center gap-3">
                        <Mail className="w-5 h-5 text-gray-400" />
                        <div>
                          <p className="text-sm text-gray-500">Email</p>
                          <p className="font-medium text-gray-900">{selectedClient.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Phone className="w-5 h-5 text-gray-400" />
                        <div>
                          <p className="text-sm text-gray-500">Phone</p>
                          <p className="font-medium text-gray-900">{selectedClient.phone}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <MapPin className="w-5 h-5 text-gray-400" />
                        <div>
                          <p className="text-sm text-gray-500">Address</p>
                          <p className="font-medium text-gray-900">{selectedClient.address}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="grid grid-cols-2 gap-4">
                    <Card>
                      <CardContent className="pt-6">
                        <p className="text-sm text-gray-500">Total Visits</p>
                        <p className="text-2xl font-semibold text-gray-900 mt-1">{selectedClient.totalVisits}</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <p className="text-sm text-gray-500">Outstanding Balance</p>
                        <p className={`text-2xl font-semibold mt-1 ${selectedClient.outstandingBalance > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                          ${selectedClient.outstandingBalance.toFixed(2)}
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="pets" className="mt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {clientPets.map((pet) => (
                      <Card key={pet.id}>
                        <CardContent className="pt-6">
                          <div className="flex items-start gap-3">
                            <Avatar className="w-16 h-16 rounded-xl">
                              <AvatarImage src={pet.imageUrl} alt={pet.name} />
                              <AvatarFallback>{pet.name[0]}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <p className="font-medium text-gray-900">{pet.name}</p>
                              <p className="text-sm text-gray-600">{pet.breed}</p>
                              <div className="flex items-center gap-2 mt-2">
                                <Badge variant="outline" className="text-xs">{pet.species}</Badge>
                                <Badge className={
                                  pet.status === 'healthy' ? 'bg-green-100 text-green-700 hover:bg-green-100' :
                                  pet.status === 'treatment' ? 'bg-blue-100 text-blue-700 hover:bg-blue-100' :
                                  'bg-orange-100 text-orange-700 hover:bg-orange-100'
                                } >
                                  {pet.status}
                                </Badge>
                              </div>
                              <p className="text-xs text-gray-500 mt-2">Last visit: {pet.lastVisit}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="appointments" className="mt-4">
                  <div className="space-y-3">
                    {clientAppointments.length > 0 ? (
                      clientAppointments.map((apt) => (
                        <Card key={apt.id}>
                          <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="font-medium text-gray-900">{apt.petName}</p>
                                  <Badge variant="outline" className="capitalize text-xs">{apt.type}</Badge>
                                </div>
                                <p className="text-sm text-gray-600 mt-1">{apt.veterinarian}</p>
                                {apt.notes && (
                                  <p className="text-xs text-gray-500 mt-1">{apt.notes}</p>
                                )}
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
