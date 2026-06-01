import { useState } from 'react';
import { Link } from 'react-router';
import { Home, PawPrint, Calendar, FileText, Bell, User, ChevronRight, Plus, Clock, MapPin, Phone, Pill, ArrowLeft, Settings, LogOut, CreditCard, Mail, } from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { mockPets, mockAppointments, mockMedicalRecords, mockClients } from '../data/mockData';
export function MobileOwnerApp() {
    const [currentScreen, setCurrentScreen] = useState('home');
    const [selectedPetId, setSelectedPetId] = useState(null);
    // Mock owner data - Sarah Johnson
    const owner = mockClients[0];
    const ownerPets = mockPets.filter(pet => owner.pets.includes(pet.id));
    const selectedPet = selectedPetId ? mockPets.find(p => p.id === selectedPetId) : null;
    const upcomingAppointments = mockAppointments.filter(apt => ownerPets.some(pet => pet.id === apt.petId) &&
        new Date(apt.date) >= new Date('2026-02-18')).slice(0, 3);
    const notifications = [
        {
            id: '1',
            type: 'appointment',
            title: 'Appointment Reminder',
            message: 'Max has a checkup scheduled for tomorrow at 9:00 AM',
            time: '2 hours ago',
            read: false,
        },
        {
            id: '2',
            type: 'medical',
            title: 'Medical Update',
            message: 'New medical record available for Milo',
            time: '1 day ago',
            read: false,
        },
        {
            id: '3',
            type: 'billing',
            title: 'Payment Received',
            message: 'Thank you! Your payment of $285.00 has been received',
            time: '3 days ago',
            read: true,
        },
    ];
    // Navigation
    const navItems = [
        { id: 'home', icon: Home, label: 'Home' },
        { id: 'pets', icon: PawPrint, label: 'Pets' },
        { id: 'appointments', icon: Calendar, label: 'Appointments' },
        { id: 'profile', icon: User, label: 'Profile' },
    ];
    const renderHeader = () => (<div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-4">
      <div className="flex items-center justify-between">
        {currentScreen !== 'home' && currentScreen !== 'pets' && currentScreen !== 'appointments' && currentScreen !== 'profile' ? (<button onClick={() => {
                if (currentScreen === 'pet-detail')
                    setCurrentScreen('pets');
                else if (currentScreen === 'book-appointment')
                    setCurrentScreen('appointments');
                else
                    setCurrentScreen('home');
            }}>
            <ArrowLeft className="w-6 h-6 text-gray-700"/>
          </button>) : (<div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <PawPrint className="w-5 h-5 text-white"/>
            </div>
            <h1 className="text-lg font-semibold text-gray-900">PetClinic</h1>
          </div>)}
        <button onClick={() => setCurrentScreen('notifications')} className="relative p-2 hover:bg-gray-100 rounded-lg">
          <Bell className="w-6 h-6 text-gray-700"/>
          {notifications.filter(n => !n.read).length > 0 && (<span className="absolute top-1.5 right-1.5 w-2 h-2 bg-orange-500 rounded-full"></span>)}
        </button>
      </div>
    </div>);
    const renderBottomNav = () => (<div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-2 safe-area-bottom">
      <div className="flex items-center justify-around">
        {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentScreen === item.id;
            return (<button key={item.id} onClick={() => setCurrentScreen(item.id)} className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors ${isActive ? 'text-blue-600' : 'text-gray-600'}`}>
              <Icon className={`w-6 h-6 ${isActive ? 'text-blue-600' : 'text-gray-500'}`}/>
              <span className="text-xs font-medium">{item.label}</span>
            </button>);
        })}
      </div>
    </div>);
    const renderHome = () => (<div className="space-y-6 pb-20">
      {/* Welcome Section */}
      <div className="bg-gradient-to-br from-blue-600 to-blue-700 text-white p-6 rounded-2xl mx-4 mt-4">
        <p className="text-blue-100">Welcome back,</p>
        <h2 className="text-2xl font-semibold mt-1">{owner.name.split(' ')[0]}</h2>
        <p className="text-blue-100 mt-2">You have {upcomingAppointments.length} upcoming appointments</p>
      </div>

      {/* Quick Actions */}
      <div className="px-4">
        <h3 className="font-semibold text-gray-900 mb-3">Quick Actions</h3>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => setCurrentScreen('book-appointment')} className="bg-blue-50 p-4 rounded-xl text-left hover:bg-blue-100 transition-colors">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center mb-3">
              <Calendar className="w-5 h-5 text-white"/>
            </div>
            <p className="font-medium text-gray-900">Book Appointment</p>
            <p className="text-xs text-gray-600 mt-1">Schedule a visit</p>
          </button>
          <button onClick={() => setCurrentScreen('pets')} className="bg-green-50 p-4 rounded-xl text-left hover:bg-green-100 transition-colors">
            <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center mb-3">
              <PawPrint className="w-5 h-5 text-white"/>
            </div>
            <p className="font-medium text-gray-900">My Pets</p>
            <p className="text-xs text-gray-600 mt-1">View pet info</p>
          </button>
        </div>
      </div>

      {/* My Pets */}
      <div className="px-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900">My Pets</h3>
          <button onClick={() => setCurrentScreen('pets')} className="text-sm text-blue-600">
            View All
          </button>
        </div>
        <div className="space-y-3">
          {ownerPets.map((pet) => (<Card key={pet.id} onClick={() => {
                setSelectedPetId(pet.id);
                setCurrentScreen('pet-detail');
            }}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Avatar className="w-14 h-14 rounded-xl">
                    <AvatarImage src={pet.imageUrl} alt={pet.name}/>
                    <AvatarFallback>{pet.name[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{pet.name}</p>
                    <p className="text-sm text-gray-600">{pet.breed}</p>
                    <Badge className={`mt-1 text-xs ${pet.status === 'healthy' ? 'bg-green-100 text-green-700 hover:bg-green-100' :
                pet.status === 'treatment' ? 'bg-blue-100 text-blue-700 hover:bg-blue-100' :
                    'bg-orange-100 text-orange-700 hover:bg-orange-100'}`}>
                      {pet.status === 'healthy' ? 'Healthy' : pet.status === 'treatment' ? 'In Treatment' : 'Critical'}
                    </Badge>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400"/>
                </div>
              </CardContent>
            </Card>))}
        </div>
      </div>

      {/* Upcoming Appointments */}
      <div className="px-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900">Upcoming Appointments</h3>
          <button onClick={() => setCurrentScreen('appointments')} className="text-sm text-blue-600">
            View All
          </button>
        </div>
        <div className="space-y-3">
          {upcomingAppointments.map((apt) => (<Card key={apt.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900">{apt.petName}</p>
                      <Badge variant="outline" className="text-xs capitalize">{apt.type}</Badge>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{apt.veterinarian}</p>
                    <div className="flex items-center gap-4 mt-2">
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <Calendar className="w-3 h-3"/>
                        {apt.date}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <Clock className="w-3 h-3"/>
                        {apt.time}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>))}
        </div>
      </div>
    </div>);
    const renderPets = () => (<div className="space-y-4 pb-20 p-4">
      <h2 className="text-xl font-semibold text-gray-900 mt-2">My Pets</h2>
      <div className="grid gap-4">
        {ownerPets.map((pet) => (<Card key={pet.id} onClick={() => {
                setSelectedPetId(pet.id);
                setCurrentScreen('pet-detail');
            }} className="cursor-pointer hover:shadow-md transition-shadow">
            <CardContent className="p-0">
              <div className="flex items-center gap-4 p-4">
                <Avatar className="w-20 h-20 rounded-xl">
                  <AvatarImage src={pet.imageUrl} alt={pet.name}/>
                  <AvatarFallback>{pet.name[0]}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{pet.name}</h3>
                  <p className="text-sm text-gray-600">{pet.breed}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="outline" className="text-xs">{pet.species}</Badge>
                    <Badge className={`text-xs ${pet.status === 'healthy' ? 'bg-green-100 text-green-700 hover:bg-green-100' :
                pet.status === 'treatment' ? 'bg-blue-100 text-blue-700 hover:bg-blue-100' :
                    'bg-orange-100 text-orange-700 hover:bg-orange-100'}`}>
                      {pet.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">{pet.age} • {pet.weight}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400"/>
              </div>
            </CardContent>
          </Card>))}
      </div>
    </div>);
    const renderPetDetail = () => {
        if (!selectedPet)
            return null;
        const petRecords = mockMedicalRecords.filter(r => r.petId === selectedPet.id);
        const petAppointments = mockAppointments.filter(a => a.petId === selectedPet.id);
        return (<div className="space-y-4 pb-20 p-4">
        {/* Pet Header */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <Avatar className="w-24 h-24 rounded-2xl">
                <AvatarImage src={selectedPet.imageUrl} alt={selectedPet.name}/>
                <AvatarFallback>{selectedPet.name[0]}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h2 className="text-2xl font-semibold text-gray-900">{selectedPet.name}</h2>
                <p className="text-gray-600">{selectedPet.breed}</p>
                <Badge className={`mt-2 ${selectedPet.status === 'healthy' ? 'bg-green-100 text-green-700 hover:bg-green-100' :
                selectedPet.status === 'treatment' ? 'bg-blue-100 text-blue-700 hover:bg-blue-100' :
                    'bg-orange-100 text-orange-700 hover:bg-orange-100'}`}>
                  {selectedPet.status}
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-6">
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-xs text-gray-500">Age</p>
                <p className="font-medium text-gray-900 mt-1">{selectedPet.age}</p>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-xs text-gray-500">Weight</p>
                <p className="font-medium text-gray-900 mt-1">{selectedPet.weight}</p>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-xs text-gray-500">Color</p>
                <p className="font-medium text-gray-900 mt-1">{selectedPet.color}</p>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-xs text-gray-500">Microchip</p>
                <p className="font-medium text-gray-900 mt-1 text-xs">{selectedPet.microchipId}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => setCurrentScreen('book-appointment')}>
            <Calendar className="w-4 h-4 mr-2"/>
            Book Visit
          </Button>
          <Button variant="outline">
            <Phone className="w-4 h-4 mr-2"/>
            Call Clinic
          </Button>
        </div>

        {/* Medical Records */}
        <div>
          <h3 className="font-semibold text-gray-900 mb-3">Medical History</h3>
          <div className="space-y-3">
            {petRecords.length > 0 ? (petRecords.map((record) => (<Card key={record.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">{record.type}</Badge>
                          <span className="text-xs text-gray-500">{record.date}</span>
                        </div>
                        <p className="font-medium text-gray-900 mt-2">{record.diagnosis}</p>
                        <p className="text-sm text-gray-600 mt-1">{record.treatment}</p>
                        {record.prescription && (<div className="flex items-center gap-1 mt-2 text-sm text-blue-600">
                            <Pill className="w-4 h-4"/>
                            {record.prescription}
                          </div>)}
                        <p className="text-xs text-gray-500 mt-2">By {record.veterinarian}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>))) : (<p className="text-center text-gray-500 py-8 text-sm">No medical records yet</p>)}
          </div>
        </div>

        {/* Appointments */}
        <div>
          <h3 className="font-semibold text-gray-900 mb-3">Appointments</h3>
          <div className="space-y-3">
            {petAppointments.slice(0, 3).map((apt) => (<Card key={apt.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Badge variant="outline" className="capitalize text-xs">{apt.type}</Badge>
                      <p className="font-medium text-gray-900 mt-2">{apt.veterinarian}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <Calendar className="w-3 h-3"/>
                          {apt.date}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <Clock className="w-3 h-3"/>
                          {apt.time}
                        </div>
                      </div>
                    </div>
                    <Badge variant="outline">{apt.status}</Badge>
                  </div>
                </CardContent>
              </Card>))}
          </div>
        </div>
      </div>);
    };
    const renderAppointments = () => (<div className="space-y-4 pb-20 p-4">
      <div className="flex items-center justify-between mt-2">
        <h2 className="text-xl font-semibold text-gray-900">Appointments</h2>
        <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => setCurrentScreen('book-appointment')}>
          <Plus className="w-4 h-4 mr-1"/>
          Book
        </Button>
      </div>

      <div className="space-y-3">
        {upcomingAppointments.map((apt) => (<Card key={apt.id}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${apt.type === 'emergency' ? 'bg-orange-100' :
                apt.type === 'surgery' ? 'bg-blue-100' :
                    apt.type === 'grooming' ? 'bg-green-100' :
                        'bg-gray-100'}`}>
                  <Calendar className={`w-6 h-6 ${apt.type === 'emergency' ? 'text-orange-600' :
                apt.type === 'surgery' ? 'text-blue-600' :
                    apt.type === 'grooming' ? 'text-green-600' :
                        'text-gray-600'}`}/>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900">{apt.petName}</p>
                    <Badge variant="outline" className="text-xs capitalize">{apt.type}</Badge>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{apt.veterinarian}</p>
                  <div className="flex items-center gap-4 mt-2">
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <Calendar className="w-3 h-3"/>
                      {apt.date}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <Clock className="w-3 h-3"/>
                      {apt.time}
                    </div>
                  </div>
                  {apt.notes && (<p className="text-xs text-gray-500 mt-2">{apt.notes}</p>)}
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-gray-200 flex gap-2">
                <Button variant="outline" size="sm" className="flex-1">Reschedule</Button>
                <Button variant="outline" size="sm" className="flex-1 text-red-600 hover:text-red-700">Cancel</Button>
              </div>
            </CardContent>
          </Card>))}
      </div>
    </div>);
    const renderBookAppointment = () => (<div className="space-y-4 pb-20 p-4">
      <h2 className="text-xl font-semibold text-gray-900 mt-2">Book Appointment</h2>
      
      <Card>
        <CardContent className="p-4 space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Select Pet</label>
            <select className="w-full mt-2 px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg">
              {ownerPets.map((pet) => (<option key={pet.id} value={pet.id}>{pet.name}</option>))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Appointment Type</label>
            <select className="w-full mt-2 px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg">
              <option>Checkup</option>
              <option>Vaccination</option>
              <option>Grooming</option>
              <option>Dental</option>
              <option>Emergency</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Preferred Veterinarian</label>
            <select className="w-full mt-2 px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg">
              <option>Dr. Amanda Foster</option>
              <option>Dr. Robert Kim</option>
              <option>Dr. Lisa Martinez</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Preferred Date</label>
            <input type="date" className="w-full mt-2 px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg"/>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Preferred Time</label>
            <select className="w-full mt-2 px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg">
              <option>Morning (8:00 AM - 12:00 PM)</option>
              <option>Afternoon (12:00 PM - 4:00 PM)</option>
              <option>Evening (4:00 PM - 7:00 PM)</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Notes (Optional)</label>
            <textarea className="w-full mt-2 px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg resize-none" rows={3} placeholder="Any additional information..."/>
          </div>

          <Button className="w-full bg-blue-600 hover:bg-blue-700 py-6">
            Request Appointment
          </Button>
        </CardContent>
      </Card>
    </div>);
    const renderNotifications = () => (<div className="space-y-3 pb-20 p-4">
      <h2 className="text-xl font-semibold text-gray-900 mt-2">Notifications</h2>
      
      <div className="space-y-2">
        {notifications.map((notif) => (<Card key={notif.id} className={!notif.read ? 'border-l-4 border-l-blue-600' : ''}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${notif.type === 'appointment' ? 'bg-blue-100' :
                notif.type === 'medical' ? 'bg-green-100' :
                    'bg-orange-100'}`}>
                  {notif.type === 'appointment' ? <Calendar className="w-5 h-5 text-blue-600"/> :
                notif.type === 'medical' ? <FileText className="w-5 h-5 text-green-600"/> :
                    <CreditCard className="w-5 h-5 text-orange-600"/>}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{notif.title}</p>
                  <p className="text-sm text-gray-600 mt-1">{notif.message}</p>
                  <p className="text-xs text-gray-500 mt-2">{notif.time}</p>
                </div>
                {!notif.read && (<div className="w-2 h-2 bg-blue-600 rounded-full mt-2"></div>)}
              </div>
            </CardContent>
          </Card>))}
      </div>
    </div>);
    const renderProfile = () => (<div className="space-y-4 pb-20 p-4">
      <div className="mt-2">
        <div className="flex items-center gap-4">
          <Avatar className="w-20 h-20">
            <AvatarImage src={owner.imageUrl} alt={owner.name}/>
            <AvatarFallback>{owner.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
          </Avatar>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{owner.name}</h2>
            <p className="text-sm text-gray-600">Member since {owner.joinDate}</p>
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-3">
            <Mail className="w-5 h-5 text-gray-400"/>
            <div>
              <p className="text-xs text-gray-500">Email</p>
              <p className="text-sm text-gray-900">{owner.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Phone className="w-5 h-5 text-gray-400"/>
            <div>
              <p className="text-xs text-gray-500">Phone</p>
              <p className="text-sm text-gray-900">{owner.phone}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <MapPin className="w-5 h-5 text-gray-400"/>
            <div>
              <p className="text-xs text-gray-500">Address</p>
              <p className="text-sm text-gray-900">{owner.address}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <button className="w-full flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
          <div className="flex items-center gap-3">
            <Settings className="w-5 h-5 text-gray-600"/>
            <span className="font-medium text-gray-900">Settings</span>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400"/>
        </button>

        <button className="w-full flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
          <div className="flex items-center gap-3">
            <CreditCard className="w-5 h-5 text-gray-600"/>
            <span className="font-medium text-gray-900">Payment Methods</span>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400"/>
        </button>

        <Link to="/" className="w-full flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
          <div className="flex items-center gap-3">
            <ArrowLeft className="w-5 h-5 text-gray-600"/>
            <span className="font-medium text-gray-900">Back to Admin</span>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400"/>
        </Link>

        <button className="w-full flex items-center justify-between p-4 bg-white border border-red-200 rounded-lg hover:bg-red-50 text-red-600">
          <div className="flex items-center gap-3">
            <LogOut className="w-5 h-5"/>
            <span className="font-medium">Sign Out</span>
          </div>
        </button>
      </div>
    </div>);
    return (<div className="min-h-screen bg-gray-50 max-w-md mx-auto relative">
      {renderHeader()}
      <main className="min-h-[calc(100vh-64px)]">
        {currentScreen === 'home' && renderHome()}
        {currentScreen === 'pets' && renderPets()}
        {currentScreen === 'pet-detail' && renderPetDetail()}
        {currentScreen === 'appointments' && renderAppointments()}
        {currentScreen === 'book-appointment' && renderBookAppointment()}
        {currentScreen === 'notifications' && renderNotifications()}
        {currentScreen === 'profile' && renderProfile()}
      </main>
      {['home', 'pets', 'appointments', 'profile'].includes(currentScreen) && renderBottomNav()}
    </div>);
}
