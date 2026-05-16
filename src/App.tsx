import POSTab from './components/POSTab';

export default function App() {
  return (
    <div className="h-screen bg-gray-800 flex items-center justify-center">
      <div className="w-[480px] h-screen max-h-screen bg-gray-50 flex flex-col overflow-hidden shadow-2xl">
        <POSTab isActive={true} />
      </div>
    </div>
  );
}
