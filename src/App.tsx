import { useState } from 'react';
import { LayoutGrid, ScanLine } from 'lucide-react';
import AdminTab from './components/AdminTab';
import POSTab from './components/POSTab';

type Tab = 'admin' | 'pos';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('pos');

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header — always full width */}
      <header className="bg-white border-b border-gray-200 shadow-sm h-14 flex items-center px-6 gap-1 shrink-0">
        <div className="flex items-center gap-2 mr-6">
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
            <ScanLine size={16} className="text-white" />
          </div>
          <span className="font-bold text-gray-900 text-base">POS System</span>
        </div>

        <nav className="flex gap-1">
          <button
            onClick={() => setActiveTab('pos')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'pos'
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <ScanLine size={14} />
            POS
          </button>
          <button
            onClick={() => setActiveTab('admin')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'admin'
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <LayoutGrid size={14} />
            Quản trị
          </button>
        </nav>
      </header>

      {/* POS tab — portrait 480px centered */}
      <div
        style={{ display: activeTab === 'pos' ? 'flex' : 'none' }}
        className="flex-1 bg-gray-800 items-center justify-center overflow-hidden"
      >
        <div className="w-[480px] h-full bg-gray-50 flex flex-col overflow-hidden shadow-2xl">
          <POSTab isActive={activeTab === 'pos'} />
        </div>
      </div>

      {/* Admin tab — full width */}
      <div
        style={{ display: activeTab === 'admin' ? 'block' : 'none' }}
        className="flex-1 w-full overflow-auto"
      >
        <AdminTab />
      </div>
    </div>
  );
}
