import { useState } from 'react';
import { Search, Filter, Plus, FileText, Download, Calendar, User, Pill, ClipboardList, MoreVertical, } from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, } from '../components/ui/dropdown-menu';
import { mockMedicalRecords, mockPets } from '../data/mockData';
export function MedicalRecords() {
    const [selectedType, setSelectedType] = useState('all');
    const filteredRecords = selectedType === 'all'
        ? mockMedicalRecords
        : mockMedicalRecords.filter(record => record.type.toLowerCase() === selectedType);
    const recordTypes = ['all', 'checkup', 'treatment', 'vaccination', 'surgery'];
    return (<div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">Medical Records</h1>
          <p className="text-gray-600 mt-1">View and manage patient medical history</p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2"/>
          New Record
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Records</p>
                <p className="text-2xl font-semibold text-gray-900 mt-1">{mockMedicalRecords.length}</p>
              </div>
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-blue-600"/>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">This Month</p>
                <p className="text-2xl font-semibold text-gray-900 mt-1">
                  {mockMedicalRecords.filter(r => r.date.startsWith('2026-02')).length}
                </p>
              </div>
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <Calendar className="w-5 h-5 text-green-600"/>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Treatments</p>
                <p className="text-2xl font-semibold text-gray-900 mt-1">
                  {mockMedicalRecords.filter(r => r.type === 'Treatment').length}
                </p>
              </div>
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <Pill className="w-5 h-5 text-orange-600"/>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Vaccinations</p>
                <p className="text-2xl font-semibold text-gray-900 mt-1">
                  {mockMedicalRecords.filter(r => r.type === 'Vaccination').length}
                </p>
              </div>
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <ClipboardList className="w-5 h-5 text-purple-600"/>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"/>
          <input type="text" placeholder="Search by patient, diagnosis, or veterinarian..." className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
        </div>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Filter className="w-4 h-4"/>
                Type: {selectedType === 'all' ? 'All' : selectedType}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {recordTypes.map((type) => (<DropdownMenuItem key={type} onClick={() => setSelectedType(type)}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </DropdownMenuItem>))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" className="gap-2">
            <Download className="w-4 h-4"/>
            Export
          </Button>
        </div>
      </div>

      {/* Medical Records Timeline */}
      <div className="space-y-4">
        {filteredRecords.map((record) => {
            const pet = mockPets.find(p => p.id === record.petId);
            return (<Card key={record.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  {/* Timeline dot */}
                  <div className="flex flex-col items-center">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${record.type === 'Treatment' ? 'bg-orange-100' :
                    record.type === 'Vaccination' ? 'bg-purple-100' :
                        record.type === 'Checkup' ? 'bg-green-100' :
                            'bg-blue-100'}`}>
                      {record.type === 'Treatment' ? <Pill className="w-6 h-6 text-orange-600"/> :
                    record.type === 'Vaccination' ? <ClipboardList className="w-6 h-6 text-purple-600"/> :
                        <FileText className="w-6 h-6 text-blue-600"/>}
                    </div>
                    <div className="w-0.5 h-full bg-gray-200 mt-2"></div>
                  </div>

                  {/* Patient Info */}
                  <div className="flex-shrink-0">
                    <Avatar className="w-16 h-16 rounded-xl">
                      <AvatarImage src={pet?.imageUrl} alt={pet?.name}/>
                      <AvatarFallback>{pet?.name[0]}</AvatarFallback>
                    </Avatar>
                  </div>

                  {/* Record Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-900">{pet?.name}</h3>
                          <Badge variant="outline">{record.type}</Badge>
                          <span className="text-sm text-gray-500">{record.date}</span>
                        </div>
                        
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-gray-400"/>
                            <p className="text-sm text-gray-600">{record.veterinarian}</p>
                          </div>
                        </div>

                        <div className="bg-gray-50 rounded-lg p-4 mt-3">
                          <div className="grid gap-3">
                            <div>
                              <p className="text-sm font-medium text-gray-700">Diagnosis</p>
                              <p className="text-gray-900 mt-1">{record.diagnosis}</p>
                            </div>
                            
                            <div>
                              <p className="text-sm font-medium text-gray-700">Treatment</p>
                              <p className="text-gray-900 mt-1">{record.treatment}</p>
                            </div>

                            {record.prescription && (<div>
                                <p className="text-sm font-medium text-gray-700">Prescription</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <Pill className="w-4 h-4 text-blue-600"/>
                                  <p className="text-blue-600 font-medium">{record.prescription}</p>
                                </div>
                              </div>)}

                            {record.notes && (<div>
                                <p className="text-sm font-medium text-gray-700">Notes</p>
                                <p className="text-sm text-gray-600 mt-1">{record.notes}</p>
                              </div>)}

                            {record.nextVisit && (<div className="flex items-center gap-2 pt-2 border-t border-gray-200">
                                <Calendar className="w-4 h-4 text-green-600"/>
                                <p className="text-sm text-gray-600">
                                  Next visit: <span className="font-medium text-gray-900">{record.nextVisit}</span>
                                </p>
                              </div>)}
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="w-4 h-4"/>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>View Full Record</DropdownMenuItem>
                          <DropdownMenuItem>Edit Record</DropdownMenuItem>
                          <DropdownMenuItem>Print</DropdownMenuItem>
                          <DropdownMenuItem>Download PDF</DropdownMenuItem>
                          <DropdownMenuItem className="text-red-600">Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>);
        })}
      </div>
    </div>);
}
