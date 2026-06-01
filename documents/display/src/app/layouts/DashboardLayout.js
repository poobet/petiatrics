import { Outlet, Link, useLocation } from 'react-router';
import { LayoutDashboard, Calendar, PawPrint, Users, FileText, CreditCard, UserCog, Search, Bell, ChevronDown, Menu, X, Smartphone } from 'lucide-react';
import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, } from '../components/ui/dropdown-menu';
const navigation = [
    { name: 'แดชบอร์ด', href: '/', icon: LayoutDashboard },
    { name: 'นัดหมาย', href: '/appointments', icon: Calendar },
    { name: 'ผู้ป่วย', href: '/patients', icon: PawPrint },
    { name: 'เจ้าของสัตว์', href: '/clients', icon: Users },
    { name: 'ประวัติการรักษา', href: '/medical-records', icon: FileText },
    { name: 'การเงิน', href: '/billing', icon: CreditCard },
    { name: 'พนักงาน', href: '/staff', icon: UserCog },
];
export function DashboardLayout() {
    const location = useLocation();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const isActive = (path) => {
        if (path === '/') {
            return location.pathname === '/';
        }
        return location.pathname.startsWith(path);
    };
    return (<div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 ease-in-out lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
                <PawPrint className="w-6 h-6 text-white"/>
              </div>
              <div>
                <h1 className="font-semibold text-gray-900">PetClinic</h1>
                <p className="text-xs text-gray-500">Management</p>
              </div>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden">
              <X className="w-5 h-5 text-gray-500"/>
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
            {navigation.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (<Link key={item.name} to={item.href} onClick={() => setSidebarOpen(false)} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${active
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100'}`}>
                  <Icon className={`w-5 h-5 ${active ? 'text-blue-700' : 'text-gray-500'}`}/>
                  {item.name}
                </Link>);
        })}
          </nav>

          {/* Mobile App Link */}
          <div className="p-4 border-t border-gray-200">
            <Link to="/mobile" className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-green-50 to-blue-50 rounded-xl border border-green-200">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <Smartphone className="w-5 h-5 text-green-700"/>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">แอปเจ้าของสัตว์</p>
                <p className="text-xs text-gray-600">มุมมองมือถือ</p>
              </div>
            </Link>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-40 bg-white border-b border-gray-200">
          <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
            {/* Mobile menu button */}
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden">
              <Menu className="w-6 h-6 text-gray-700"/>
            </button>

            {/* Search */}
            <div className="flex-1 max-w-2xl mx-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"/>
                <input type="text" placeholder="ค้นหาผู้ป่วย เจ้าของสัตว์ การนัดหมาย..." className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"/>
              </div>
            </div>

            {/* Right side */}
            <div className="flex items-center gap-3">
              {/* Notifications */}
              <button className="relative p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
                <Bell className="w-5 h-5"/>
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-orange-500 rounded-full"></span>
              </button>

              {/* User menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 pl-2 pr-3 py-1.5 hover:bg-gray-100 rounded-lg">
                    <Avatar className="w-8 h-8">
                      <AvatarImage src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100"/>
                      <AvatarFallback>DM</AvatarFallback>
                    </Avatar>
                    <div className="text-left hidden sm:block">
                      <p className="text-sm font-medium text-gray-900">ดร.มาร์คัส</p>
                      <p className="text-xs text-gray-500">ผู้ดูแลระบบ</p>
                    </div>
                    <ChevronDown className="w-4 h-4 text-gray-500"/>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>บัญชีของฉัน</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>ตั้งค่าโปรไฟล์</DropdownMenuItem>
                  <DropdownMenuItem>การตั้งค่า</DropdownMenuItem>
                  <DropdownMenuItem>ช่วยเหลือและสนับสนุน</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-red-600">ออกจากระบบ</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (<div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)}/>)}
    </div>);
}
