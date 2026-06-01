import { useState } from 'react';
import { Search, Filter, Plus, Download, DollarSign, CreditCard, FileText, MoreVertical, CheckCircle2, Clock, AlertCircle, TrendingUp, Send, } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, } from '../components/ui/dropdown-menu';
const mockInvoices = [
    {
        id: '1',
        invoiceNumber: 'INV-2026-001',
        clientName: 'Sarah Johnson',
        clientId: '1',
        date: '2026-02-15',
        dueDate: '2026-03-15',
        amount: 285.00,
        status: 'paid',
        paymentMethod: 'Credit Card',
        items: [
            { description: 'Annual Wellness Exam - Max', quantity: 1, unitPrice: 95.00, total: 95.00 },
            { description: 'Vaccination - DHPP', quantity: 1, unitPrice: 45.00, total: 45.00 },
            { description: 'Blood Work Panel', quantity: 1, unitPrice: 145.00, total: 145.00 },
        ]
    },
    {
        id: '2',
        invoiceNumber: 'INV-2026-002',
        clientName: 'Michael Chen',
        clientId: '2',
        date: '2026-02-16',
        dueDate: '2026-03-16',
        amount: 125.50,
        status: 'pending',
        items: [
            { description: 'Consultation - Luna', quantity: 1, unitPrice: 75.00, total: 75.00 },
            { description: 'Medication - Antibiotics', quantity: 1, unitPrice: 50.50, total: 50.50 },
        ]
    },
    {
        id: '3',
        invoiceNumber: 'INV-2026-003',
        clientName: 'James Wilson',
        clientId: '4',
        date: '2026-02-05',
        dueDate: '2026-02-20',
        amount: 275.00,
        status: 'overdue',
        items: [
            { description: 'Dental Cleaning - Bella', quantity: 1, unitPrice: 225.00, total: 225.00 },
            { description: 'Dental X-rays', quantity: 1, unitPrice: 50.00, total: 50.00 },
        ]
    },
    {
        id: '4',
        invoiceNumber: 'INV-2026-004',
        clientName: 'Emily Davis',
        clientId: '3',
        date: '2026-02-18',
        dueDate: '2026-03-18',
        amount: 450.00,
        status: 'pending',
        items: [
            { description: 'Surgery - Minor procedure', quantity: 1, unitPrice: 350.00, total: 350.00 },
            { description: 'Post-op medication', quantity: 1, unitPrice: 100.00, total: 100.00 },
        ]
    },
];
export function Billing() {
    const [filterStatus, setFilterStatus] = useState('all');
    const filteredInvoices = filterStatus === 'all'
        ? mockInvoices
        : mockInvoices.filter(inv => inv.status === filterStatus);
    const totalRevenue = mockInvoices.reduce((sum, inv) => sum + inv.amount, 0);
    const paidRevenue = mockInvoices.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + inv.amount, 0);
    const pendingRevenue = mockInvoices.filter(inv => inv.status === 'pending').reduce((sum, inv) => sum + inv.amount, 0);
    const overdueRevenue = mockInvoices.filter(inv => inv.status === 'overdue').reduce((sum, inv) => sum + inv.amount, 0);
    const getStatusBadge = (status) => {
        switch (status) {
            case 'paid':
                return (<Badge className="bg-green-100 text-green-700 hover:bg-green-100 gap-1">
            <CheckCircle2 className="w-3 h-3"/>
            Paid
          </Badge>);
            case 'pending':
                return (<Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 gap-1">
            <Clock className="w-3 h-3"/>
            Pending
          </Badge>);
            case 'overdue':
                return (<Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100 gap-1">
            <AlertCircle className="w-3 h-3"/>
            Overdue
          </Badge>);
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };
    return (<div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">Billing & Invoices</h1>
          <p className="text-gray-600 mt-1">Manage payments and financial records</p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2"/>
          Create Invoice
        </Button>
      </div>

      {/* Revenue Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Revenue</p>
                <p className="text-2xl font-semibold text-gray-900 mt-1">${totalRevenue.toLocaleString()}</p>
                <div className="flex items-center gap-1 mt-2">
                  <TrendingUp className="w-4 h-4 text-green-600"/>
                  <span className="text-sm text-green-600">+12.5%</span>
                </div>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-blue-600"/>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Paid</p>
                <p className="text-2xl font-semibold text-green-600 mt-1">${paidRevenue.toFixed(2)}</p>
                <p className="text-sm text-gray-500 mt-2">
                  {mockInvoices.filter(i => i.status === 'paid').length} invoices
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-green-600"/>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Pending</p>
                <p className="text-2xl font-semibold text-blue-600 mt-1">${pendingRevenue.toFixed(2)}</p>
                <p className="text-sm text-gray-500 mt-2">
                  {mockInvoices.filter(i => i.status === 'pending').length} invoices
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <Clock className="w-6 h-6 text-blue-600"/>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Overdue</p>
                <p className="text-2xl font-semibold text-orange-600 mt-1">${overdueRevenue.toFixed(2)}</p>
                <p className="text-sm text-gray-500 mt-2">
                  {mockInvoices.filter(i => i.status === 'overdue').length} invoices
                </p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-orange-600"/>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Tabs */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"/>
          <input type="text" placeholder="Search invoices..." className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
        </div>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Filter className="w-4 h-4"/>
                Status: {filterStatus === 'all' ? 'All' : filterStatus}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setFilterStatus('all')}>All Status</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterStatus('paid')}>Paid</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterStatus('pending')}>Pending</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterStatus('overdue')}>Overdue</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" className="gap-2">
            <Download className="w-4 h-4"/>
            Export
          </Button>
        </div>
      </div>

      {/* Invoices Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Client</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Due Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredInvoices.map((invoice) => (<tr key={invoice.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                          <FileText className="w-4 h-4 text-blue-600"/>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{invoice.invoiceNumber}</p>
                          {invoice.paymentMethod && (<p className="text-xs text-gray-500">{invoice.paymentMethod}</p>)}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">{invoice.clientName}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{invoice.date}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{invoice.dueDate}</td>
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-900">${invoice.amount.toFixed(2)}</p>
                    </td>
                    <td className="px-6 py-4">{getStatusBadge(invoice.status)}</td>
                    <td className="px-6 py-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="w-4 h-4"/>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <FileText className="w-4 h-4 mr-2"/>
                            View Invoice
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Download className="w-4 h-4 mr-2"/>
                            Download PDF
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Send className="w-4 h-4 mr-2"/>
                            Send to Client
                          </DropdownMenuItem>
                          {invoice.status === 'pending' && (<DropdownMenuItem>
                              <CreditCard className="w-4 h-4 mr-2"/>
                              Record Payment
                            </DropdownMenuItem>)}
                          <DropdownMenuItem className="text-red-600">Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Recent Transactions */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
          <CardDescription>Latest payment activities</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {mockInvoices.filter(inv => inv.status === 'paid').slice(0, 3).map((invoice) => (<div key={invoice.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-green-600"/>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{invoice.clientName}</p>
                    <p className="text-sm text-gray-600">{invoice.invoiceNumber}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium text-green-600">+${invoice.amount.toFixed(2)}</p>
                  <p className="text-xs text-gray-500">{invoice.date}</p>
                </div>
              </div>))}
          </div>
        </CardContent>
      </Card>
    </div>);
}
