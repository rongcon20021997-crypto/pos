import { useEffect, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';
import { Plus, Pencil, Trash2, Barcode, X, Check } from 'lucide-react';
import { supabase, Product } from '../lib/supabase';

export default function AdminTab() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [barcodeProduct, setBarcodeProduct] = useState<Product | null>(null);
  const [form, setForm] = useState({ code: '', name: '', price: '', stock: '' });
  const [saving, setSaving] = useState(false);
  const barcodeRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    if (barcodeProduct && barcodeRef.current) {
      JsBarcode(barcodeRef.current, barcodeProduct.code, {
        format: 'CODE128',
        width: 2,
        height: 80,
        displayValue: true,
        fontSize: 14,
        margin: 10,
      });
    }
  }, [barcodeProduct]);

  async function fetchProducts() {
    setLoading(true);
    const { data } = await supabase.from('products').select('*').order('created_at', { ascending: false });
    setProducts(data ?? []);
    setLoading(false);
  }

  function openCreate() {
    setEditProduct(null);
    setForm({ code: '', name: '', price: '', stock: '' });
    setShowForm(true);
  }

  function openEdit(p: Product) {
    setEditProduct(p);
    setForm({ code: p.code, name: p.name, price: String(p.price), stock: String(p.stock) });
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.code || !form.name || !form.price) return;
    setSaving(true);
    const payload = {
      code: form.code.trim(),
      name: form.name.trim(),
      price: parseInt(form.price),
      stock: parseInt(form.stock) || 0,
    };
    if (editProduct) {
      await supabase.from('products').update(payload).eq('id', editProduct.id);
    } else {
      await supabase.from('products').insert(payload);
    }
    setSaving(false);
    setShowForm(false);
    fetchProducts();
  }

  async function handleDelete(id: string) {
    if (!confirm('Xoá sản phẩm này?')) return;
    await supabase.from('products').delete().eq('id', id);
    fetchProducts();
  }

  function printBarcode() {
    const svg = barcodeRef.current;
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <html><head><title>Barcode</title>
      <style>body{display:flex;align-items:center;justify-content:center;height:100vh;margin:0;}</style>
      </head><body>${svgData}<script>window.onload=()=>window.print()<\/script></body></html>
    `);
    win.document.close();
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Danh sách sản phẩm</h2>
          <p className="text-gray-500 text-sm mt-1">{products.length} sản phẩm</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg font-medium transition-colors"
        >
          <Plus size={18} />
          Thêm sản phẩm
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Mã SP</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Tên sản phẩm</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Giá (VND)</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Tồn kho</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p, i) => (
                <tr key={p.id} className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${i % 2 === 0 ? '' : 'bg-gray-50/50'}`}>
                  <td className="px-4 py-3">
                    <span className="font-mono bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs">{p.code}</span>
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                  <td className="px-4 py-3 text-right text-gray-700 font-medium">
                    {p.price.toLocaleString('vi-VN')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`font-medium ${p.stock < 10 ? 'text-red-600' : 'text-gray-700'}`}>{p.stock}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => setBarcodeProduct(p)}
                        className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                        title="Xem mã vạch"
                      >
                        <Barcode size={16} />
                      </button>
                      <button
                        onClick={() => openEdit(p)}
                        className="p-1.5 text-gray-500 hover:text-amber-600 hover:bg-amber-50 rounded-md transition-colors"
                        title="Chỉnh sửa"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(p.id)}
                        className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                        title="Xoá"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {products.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-16 text-gray-400">
                    Chưa có sản phẩm nào
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">{editProduct ? 'Chỉnh sửa sản phẩm' : 'Thêm sản phẩm mới'}</h3>
              <button onClick={() => setShowForm(false)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                <X size={18} className="text-gray-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Mã sản phẩm *</label>
                <input
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  placeholder="VD: SP001"
                  value={form.code}
                  onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Tên sản phẩm *</label>
                <input
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Nhập tên sản phẩm"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Giá (VND) *</label>
                <input
                  type="number"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0"
                  value={form.price}
                  onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Tồn kho</label>
                <input
                  type="number"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0"
                  value={form.stock}
                  onChange={e => setForm(f => ({ ...f, stock: e.target.value }))}
                />
              </div>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 border border-gray-200 text-gray-700 px-4 py-2.5 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              >
                Huỷ
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.code || !form.name || !form.price}
                className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-4 py-2.5 rounded-lg font-medium transition-colors"
              >
                {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Check size={16} />}
                Lưu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barcode Modal */}
      {barcodeProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">Mã vạch</h3>
              <button onClick={() => setBarcodeProduct(null)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                <X size={18} className="text-gray-500" />
              </button>
            </div>
            <div className="p-6 flex flex-col items-center gap-4">
              <div className="text-center">
                <p className="font-semibold text-gray-900 text-lg">{barcodeProduct.name}</p>
                <p className="text-gray-500 text-sm mt-0.5">{barcodeProduct.price.toLocaleString('vi-VN')} VND</p>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-4 w-full flex justify-center">
                <svg ref={barcodeRef} />
              </div>
              <button
                onClick={printBarcode}
                className="w-full flex items-center justify-center gap-2 bg-gray-900 hover:bg-gray-800 text-white px-4 py-2.5 rounded-lg font-medium transition-colors"
              >
                In mã vạch
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
