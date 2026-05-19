import { useEffect, useRef, useState } from 'react';
import { Trash2, Plus, Minus, ShoppingCart, Phone, X, CheckCircle, QrCode, Printer, Loader2, User, Search } from 'lucide-react';
import { supabase, CartItem, Product } from '../lib/supabase';

interface POSTabProps {
  isActive: boolean;
}

export default function POSTab({ isActive }: POSTabProps) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [scanFeedback, setScanFeedback] = useState<{ code: string; found: boolean } | null>(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [phone, setPhone] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [foundCustomer, setFoundCustomer] = useState<string | null>(null);
  const [lookingUpPhone, setLookingUpPhone] = useState(false);
  const [paying, setPaying] = useState(false);
  const [showQRPayment, setShowQRPayment] = useState(false);
  const [qrCountdown, setQrCountdown] = useState(4);
  const [successOrder, setSuccessOrder] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<{ items: CartItem[]; phone: string; customerName: string; total: number; date: Date } | null>(null);
  const [barcodeInput, setBarcodeInput] = useState('');
  
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  const total = cart.reduce((s, item) => s + item.price * item.quantity, 0);

  // Global listener to focus the hidden input when typing (e.g. from a barcode scanner)
  useEffect(() => {
    if (isActive && barcodeInputRef.current && !showCheckout && !showQRPayment && !successOrder) {
      barcodeInputRef.current.focus();
    }

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (!isActive || showCheckout || showQRPayment || successOrder) return;
      
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') {
        if (document.activeElement !== barcodeInputRef.current) {
          return; // Let user type in other fields (like phone number)
        }
      }

      // If a standard character is typed, focus our hidden barcode input
      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        barcodeInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isActive, showCheckout, showQRPayment, successOrder]);

  const handleBarcodeSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const code = barcodeInput.trim();
    if (!code) return;

    const { data } = await supabase.from('products').select('*').eq('code', code).maybeSingle();
    if (data) {
      addToCart(data as Product);
      setScanFeedback({ code, found: true });
    } else {
      setScanFeedback({ code, found: false });
    }
    setTimeout(() => setScanFeedback(null), 2000);
    setBarcodeInput('');
    barcodeInputRef.current?.focus();
  };

  // Phone lookup from localStorage
  useEffect(() => {
    const trimmed = phone.trim();
    if (trimmed.length < 9) {
      setFoundCustomer(null);
      setCustomerName('');
      return;
    }

    setLookingUpPhone(true);
    // Small delay for UX feel
    const timeout = setTimeout(() => {
      try {
        const stored = localStorage.getItem('pos_customers');
        const customers: Record<string, string> = stored ? JSON.parse(stored) : {};
        const name = customers[trimmed];
        if (name) {
          setFoundCustomer(name);
          setCustomerName(name);
        } else {
          setFoundCustomer(null);
          setCustomerName('');
        }
      } catch {
        setFoundCustomer(null);
      } finally {
        setLookingUpPhone(false);
      }
    }, 300);

    return () => { clearTimeout(timeout); setLookingUpPhone(false); };
  }, [phone]);

  function addToCart(product: Product) {
    setCart(prev => {
      const existing = prev.find(i => i.id === product.id);
      if (existing) {
        return prev.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [{ ...product, quantity: 1 }, ...prev];
    });
  }

  function updateQty(id: string, delta: number) {
    setCart(prev => prev
      .map(i => i.id === id ? { ...i, quantity: i.quantity + delta } : i)
      .filter(i => i.quantity > 0)
    );
  }

  function removeItem(id: string) {
    setCart(prev => prev.filter(i => i.id !== id));
  }

  function clearCart() {
    setCart([]);
  }

  async function handlePay() {
    const finalName = foundCustomer || customerName.trim();
    if (!phone.trim() || !finalName) return;
    setPaying(true);

    // Save bill data before clearing
    const billData = {
      items: [...cart],
      phone: phone.trim(),
      customerName: finalName,
      total,
      date: new Date(),
    };

    // Save order to database
    const { data: order } = await supabase
      .from('orders')
      .insert({ customer_phone: phone.trim(), customer_name: finalName, total })
      .select()
      .single();

    if (order) {
      await supabase.from('order_items').insert(
        cart.map(item => ({
          order_id: order.id,
          product_id: item.id,
          quantity: item.quantity,
          unit_price: item.price,
        }))
      );
    }

    setPaying(false);
    setCompletedOrder(billData);
    setCart([]);

    // Save customer name → phone to localStorage
    try {
      const stored = localStorage.getItem('pos_customers');
      const customers: Record<string, string> = stored ? JSON.parse(stored) : {};
      customers[phone.trim()] = finalName;
      localStorage.setItem('pos_customers', JSON.stringify(customers));
    } catch { /* ignore storage errors */ }

    setPhone('');
    setCustomerName('');
    setFoundCustomer(null);

    // Transition to QR payment screen
    setShowQRPayment(true);
    setQrCountdown(5);
  }

  // Auto-countdown for QR payment screen
  useEffect(() => {
    if (!showQRPayment) return;

    if (qrCountdown <= 0) {
      // Payment "completed" — show success
      setShowQRPayment(false);
      setSuccessOrder(true);
      return;
    }

    const timer = setTimeout(() => {
      setQrCountdown(prev => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [showQRPayment, qrCountdown]);

  function closeSuccess() {
    setSuccessOrder(false);
    setShowCheckout(false);
    setShowQRPayment(false);
    setCompletedOrder(null);
    barcodeInputRef.current?.focus();
  }

  function printBill() {
    if (!completedOrder) return;
    const win = window.open('', '_blank');
    if (!win) return;
    const itemsHtml = completedOrder.items.map(i =>
      `<tr><td style="padding:4px 0">${i.name}</td><td style="text-align:center">${i.quantity}</td><td style="text-align:right">${(i.price * i.quantity).toLocaleString('vi-VN')}₫</td></tr>`
    ).join('');
    win.document.write(`
      <html><head><title>Bill</title>
      <style>
        body{font-family:monospace;width:300px;margin:0 auto;padding:20px;font-size:13px}
        h2{text-align:center;margin:0 0 4px}
        .center{text-align:center}
        hr{border:none;border-top:1px dashed #000;margin:8px 0}
        table{width:100%;border-collapse:collapse}
        .total{font-size:16px;font-weight:bold}
      </style>
      </head><body>
        <h2>FOSO POS</h2>
        <p class="center" style="margin:0 0 8px;font-size:11px">${completedOrder.date.toLocaleString('vi-VN')}</p>
        <hr/>
        <table>
          <tr style="font-weight:bold;border-bottom:1px solid #000"><td>Sản phẩm</td><td style="text-align:center">SL</td><td style="text-align:right">Tiền</td></tr>
          ${itemsHtml}
        </table>
        <hr/>
        <p class="total" style="text-align:right">Tổng: ${completedOrder.total.toLocaleString('vi-VN')}₫</p>
        <hr/>
        <p>Khách hàng: ${completedOrder.customerName}</p>
        <p>SĐT: ${completedOrder.phone}</p>
        <p class="center" style="margin-top:12px;font-size:11px">Cảm ơn quý khách!</p>
        <script>window.onload=()=>window.print()<\/script>
      </body></html>
    `);
    win.document.close();
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Hidden barcode scanner input */}
      <form onSubmit={handleBarcodeSubmit} className="absolute opacity-0 pointer-events-none w-0 h-0 overflow-hidden" aria-hidden="true">
        <input
          ref={barcodeInputRef}
          type="text"
          value={barcodeInput}
          onChange={(e) => setBarcodeInput(e.target.value)}
          autoFocus
          autoComplete="off"
        />
        <button type="submit" tabIndex={-1}>Submit</button>
      </form>

      {/* Global Scan feedback toast */}
      {scanFeedback && (
        <div className={`absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg text-white text-sm font-medium shadow-lg z-50 ${scanFeedback.found ? 'bg-green-500' : 'bg-red-500'}`}>
          {scanFeedback.found ? `✓ Đã thêm mã ${scanFeedback.code}` : `✗ Không tìm thấy mã ${scanFeedback.code}`}
        </div>
      )}

      {/* Cart panel */}
      <div className="flex-1 bg-white flex flex-col border-t border-gray-200 min-h-0">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart size={20} className="text-gray-700" />
            <h3 className="font-bold text-gray-900 text-lg">Giỏ hàng</h3>
            {cart.length > 0 && (
              <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full font-medium">
                {cart.reduce((s, i) => s + i.quantity, 0)}
              </span>
            )}
          </div>
          {cart.length > 0 && (
            <button
              onClick={clearCart}
              className="text-xs text-red-500 hover:text-red-700 font-medium transition-colors"
            >
              Xoá tất cả
            </button>
          )}
        </div>

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-3">
              <ShoppingCart size={48} strokeWidth={1.5} />
              <p className="text-sm">Quét mã vạch để thêm sản phẩm</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {cart.map(item => (
                <div key={item.id} className="px-5 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm truncate">{item.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5 font-mono">{item.code}</p>
                    <p className="text-blue-600 font-semibold text-sm mt-0.5">
                      {(item.price * item.quantity).toLocaleString('vi-VN')} ₫
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => updateQty(item.id, -1)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
                    >
                      <Minus size={12} />
                    </button>
                    <span className="w-8 text-center font-bold text-gray-900 text-sm">{item.quantity}</span>
                    <button
                      onClick={() => updateQty(item.id, 1)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                  <button
                    onClick={() => removeItem(item.id)}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors ml-1"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-gray-600 font-medium">Tổng cộng</span>
            <span className="text-2xl font-bold text-gray-900">{total.toLocaleString('vi-VN')} ₫</span>
          </div>
          <button
            disabled={cart.length === 0}
            onClick={() => setShowCheckout(true)}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-200 disabled:text-gray-400 text-white py-3.5 rounded-xl font-bold text-base transition-colors"
          >
            Đặt hàng
          </button>
        </div>
      </div>

      {/* Checkout Modal */}
      {showCheckout && !successOrder && !showQRPayment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">Nhập thông tin khách hàng</h3>
              <button onClick={() => setShowCheckout(false)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                <X size={18} className="text-gray-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* Phone input */}
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5 flex items-center gap-1.5">
                  <Phone size={14} />
                  Số điện thoại khách hàng
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 pr-9"
                    placeholder="Nhập số điện thoại"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                  />
                  {lookingUpPhone && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Loader2 size={16} className="animate-spin text-gray-400" />
                    </div>
                  )}
                </div>
              </div>

              {/* Customer name — found or input */}
              {phone.trim().length >= 9 && !lookingUpPhone && (
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1.5 flex items-center gap-1.5">
                    <User size={14} />
                    Tên khách hàng
                  </label>
                  {foundCustomer ? (
                    <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2.5">
                      <CheckCircle size={16} className="text-green-500 shrink-0" />
                      <span className="text-sm font-medium text-green-800">{foundCustomer}</span>
                      <span className="text-xs text-green-500 ml-auto">Khách quen</span>
                    </div>
                  ) : (
                    <input
                      type="text"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="Nhập tên khách hàng"
                      value={customerName}
                      onChange={e => setCustomerName(e.target.value)}
                    />
                  )}
                </div>
              )}
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button
                onClick={() => setShowCheckout(false)}
                className="flex-1 border border-gray-200 text-gray-700 px-4 py-2.5 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              >
                Huỷ
              </button>
              <button
                onClick={handlePay}
                disabled={paying || !phone.trim() || (!foundCustomer && !customerName.trim())}
                className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white px-4 py-2.5 rounded-lg font-bold transition-colors"
              >
                {paying ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : null}
                Tiếp tục
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Payment Modal — 2 column: items left, QR right */}
      {showQRPayment && completedOrder && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" style={{ animation: 'fadeInUp 0.3s ease-out', padding: '12px 2px' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full overflow-hidden flex flex-col" style={{ maxWidth: 460, maxHeight: '95vh' }}>
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-5 py-3 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-base font-bold text-white">Thông tin thanh toán</h3>
                <p className="text-blue-200 text-xs mt-0.5">Quét mã QR để thanh toán</p>
              </div>
              <div className="text-right">
                <p className="text-blue-100 text-xs">Tổng tiền</p>
                <p className="text-xl font-bold text-white">{completedOrder.total.toLocaleString('vi-VN')}₫</p>
              </div>
            </div>

            {/* Two-column body */}
            <div className="flex flex-1 min-h-0">
              {/* Left — Item list */}
              <div className="flex-1 border-r border-gray-100 flex flex-col min-w-0">
                <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Danh sách mặt hàng</p>
                </div>
                <div className="flex-1 overflow-y-auto px-4 py-2">
                  {completedOrder.items.map((item, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                      <div className="flex-1 min-w-0 mr-2">
                        <p className="text-sm font-medium text-gray-800 truncate">{item.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{item.price.toLocaleString('vi-VN')}₫ × {item.quantity}</p>
                      </div>
                      <p className="text-sm font-bold text-gray-900 whitespace-nowrap">{(item.price * item.quantity).toLocaleString('vi-VN')}₫</p>
                    </div>
                  ))}
                </div>
                {/* Customer info footer */}
                <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50 shrink-0">
                  <div className="flex items-center gap-2">
                    <User size={14} className="text-gray-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{completedOrder.customerName}</p>
                      <p className="text-xs text-gray-400">{completedOrder.phone}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right — QR code */}
              <div className="flex flex-col items-center justify-center px-5 py-4" style={{ width: 200 }}>
                {/* QR Code */}
                <div className="relative bg-white border-2 border-gray-100 rounded-xl p-2 shadow-sm">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`FOSO-PAY|${completedOrder.total}|${completedOrder.phone}|${Date.now()}`)}&color=1e40af`}
                    alt="QR thanh toán"
                    className="w-36 h-36 rounded"
                    style={{ imageRendering: 'pixelated' }}
                  />
                  {/* Pulsing scanner line */}
                  <div
                    className="absolute left-4 right-4 h-0.5 bg-blue-500 rounded-full"
                    style={{
                      animation: 'scanLine 2s ease-in-out infinite',
                      top: '50%',
                    }}
                  />
                </div>

                <p className="text-xs text-gray-400 mt-2 text-center">Quét mã để thanh toán</p>

                {/* Countdown timer */}
                <div className="flex flex-col items-center gap-1.5 mt-3">
                  <div className="relative w-10 h-10">
                    <svg className="w-10 h-10 -rotate-90" viewBox="0 0 48 48">
                      <circle cx="24" cy="24" r="20" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                      <circle
                        cx="24" cy="24" r="20" fill="none" stroke="#3b82f6" strokeWidth="3"
                        strokeLinecap="round"
                        strokeDasharray={`${(qrCountdown / 5) * 125.66} 125.66`}
                        style={{ transition: 'stroke-dasharray 1s linear' }}
                      />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-blue-600">
                      {qrCountdown}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-400">
                    <Loader2 size={12} className="animate-spin text-blue-500" />
                    <span>Đang chờ...</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CSS animation keyframes */}
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes scanLine {
          0%, 100% { top: 20%; opacity: 0.4; }
          50% { top: 75%; opacity: 0.8; }
        }
      `}</style>

      {/* Receipt Bill Modal */}
      {successOrder && completedOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            {/* Bill header */}
            <div className="bg-green-50 px-6 py-4 text-center">
              <CheckCircle size={36} className="text-green-500 mx-auto mb-2" />
              <h3 className="text-lg font-bold text-gray-900">Thanh toán thành công!</h3>
            </div>

            {/* Receipt content */}
            <div className="px-6 py-4">
              <div className="border border-gray-200 rounded-xl p-4 bg-gray-50" style={{ fontFamily: 'monospace' }}>
                <p className="text-center font-bold text-base text-gray-900 mb-1">FOSO POS</p>
                <p className="text-center text-xs text-gray-500 mb-3">
                  {completedOrder.date.toLocaleString('vi-VN')}
                </p>
                <div className="border-t border-dashed border-gray-300 my-2" />

                {/* Items */}
                <div className="space-y-1.5">
                  {completedOrder.items.map((item, i) => (
                    <div key={i} className="flex justify-between text-sm text-gray-700">
                      <span className="flex-1 truncate">{item.name}</span>
                      <span className="w-8 text-center text-gray-500">x{item.quantity}</span>
                      <span className="w-24 text-right font-medium">{(item.price * item.quantity).toLocaleString('vi-VN')}₫</span>
                    </div>
                  ))}
                </div>

                <div className="border-t border-dashed border-gray-300 my-2" />

                {/* Total */}
                <div className="flex justify-between items-center">
                  <span className="font-bold text-gray-900">TỔNG CỘNG</span>
                  <span className="text-lg font-bold text-green-600">{completedOrder.total.toLocaleString('vi-VN')}₫</span>
                </div>

                <div className="border-t border-dashed border-gray-300 my-2" />

                <p className="text-xs text-gray-500">KH: {completedOrder.customerName}</p>
                <p className="text-xs text-gray-500">SĐT: {completedOrder.phone}</p>
                <p className="text-center text-xs text-gray-400 mt-2">Cảm ơn quý khách!</p>
              </div>
            </div>

            {/* Actions */}
            <div className="px-6 pb-5 flex gap-3">
              <button
                onClick={printBill}
                className="flex-1 flex items-center justify-center gap-2 border border-gray-200 text-gray-700 py-2.5 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              >
                <Printer size={16} />
                In bill
              </button>
              <button
                onClick={closeSuccess}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-xl font-bold transition-colors"
              >
                Kết thúc
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
