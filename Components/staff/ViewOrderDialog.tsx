import React, { useState } from "react";
import { Order } from "@/entities/Order";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/Components/ui/dialog";
import { Button } from "@/Components/ui/button";
import { Input } from "@/Components/ui/input";
import { Label } from "@/Components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/Components/ui/select";
import { Plus, Trash2, ShoppingCart, Save } from "lucide-react";
import { useToast } from "@/Context/ToastContext";

interface ViewOrderDialogProps {
  open: boolean;
  onClose: () => void;
  order: any;
  isEditable: boolean;
  onSave: (orderId: string, orderData: any) => Promise<void>;
  customers: any[];
}

export default function ViewOrderDialog({ 
  open, 
  onClose, 
  order, 
  isEditable, 
  onSave, 
  customers 
}: ViewOrderDialogProps) {
  const { showSuccess, showError } = useToast();
  const [formData, setFormData] = useState({
    customer_id: "",
    contract_id: "",
    order_date: "",
  });
  
  const [items, setItems] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (order) {
      setFormData({
        customer_id: order.customer_id || "",
        contract_id: order.contract_id || "",
        order_date: order.order_date ? order.order_date.split('T')[0] : "",
      });
      setItems(order.items?.map((item: any) => ({
        ...item,
        price: String(item.unit_price || item.price || ""),
        quantity: String(item.quantity || ""),
        total_price: parseFloat(String(item.total_price || 0))
      })) || []);
    }
  }, [order, open]);

  const updateItem = (index: number, field: string, value: any) => {
    if (!isEditable) return;
    
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    
    if (field === 'quantity' || field === 'price') {
      const quantity = parseFloat(newItems[index].quantity) || 0;
      const price = parseFloat(newItems[index].price) || 0;
      newItems[index].total_price = quantity * price;
    }
    
    setItems(newItems);
  };

  const addItem = () => {
    if (!isEditable) return;
    setItems([...items, { product_name: "", quantity: "", price: "", total_price: 0 }]);
  };

  const removeItem = (index: number) => {
    if (!isEditable || items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const calculateOrderTotal = () => {
    return items.reduce((sum, item) => sum + (item.total_price || 0), 0);
  };

  const calculateRebateAmount = () => {
    return calculateOrderTotal() * 0.01; // 1% rebate
  };

  const handleSave = async () => {
    if (!isEditable) return;
    
    setSaving(true);
    try {
      const orderData = {
        ...formData,
        items: items.map(item => ({
          product_name: item.product_name,
          quantity: parseInt(String(item.quantity)),
          unit_price: parseFloat(item.price),
          total_price: parseFloat(item.total_price)
        })),
        total_amount: calculateOrderTotal(),
        rebate_amount: calculateRebateAmount(),
      };

      await onSave(order.id, orderData);
      showSuccess("Order updated successfully!", 5000);
      onClose();
    } catch (error) {
      console.error("Error saving order:", error);
      showError("Failed to save order. Please try again.");
    }
    setSaving(false);
  };

  const getCustomerName = (customerId: string) => {
    const customer = customers?.find(c => c.id === customerId);
    return customer ? customer.full_name : customerId;
  };

  const getCustomerEmail = (customerId: string) => {
    const customer = customers?.find(c => c.id === customerId);
    return customer ? customer.email : "";
  };

  if (!order) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto p-6 md:p-8">
        <DialogHeader className="pb-3 border-b border-slate-100">
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-blue-600" />
            Order Details - #{order.order_number}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Customer
              </label>
              <div className="mt-1 p-3 bg-slate-50 rounded-md">
                <div className="font-medium text-slate-900">{getCustomerName(order.customer_id)}</div>
                <div className="text-sm text-slate-600">{getCustomerEmail(order.customer_id)}</div>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Order Date
              </label>
              <Input
                type="date"
                value={formData.order_date}
                onChange={(e) => isEditable && setFormData(prev => ({ ...prev, order_date: e.target.value }))}
                readOnly={!isEditable}
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-4">
              <label className="block text-sm font-medium text-slate-700">
                Order Items
              </label>
              {isEditable && (
                <Button type="button" onClick={addItem} size="sm" variant="outline">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Item
                </Button>
              )}
            </div>
            
            <div className="space-y-4">
              {/* Header row */}
              <div className="grid grid-cols-12 gap-4 text-sm font-semibold text-slate-600 border-b pb-2">
                <div className="col-span-5">Product Name</div>
                <div className="col-span-2">Qty</div>
                <div className="col-span-2">Price</div>
                <div className="col-span-2">Total</div>
                {isEditable && <div className="col-span-1">Action</div>}
              </div>
              
              {items.map((item, index) => (
                <div key={index} className="grid grid-cols-12 gap-4 items-center">
                  <div className="col-span-5">
                    <Input
                      placeholder="Product name"
                      value={item.product_name}
                      onChange={(e) => updateItem(index, 'product_name', e.target.value)}
                      readOnly={!isEditable}
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      placeholder="0"
                      value={item.quantity}
                      onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                      min="1"
                      readOnly={!isEditable}
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={item.price}
                      onChange={(e) => updateItem(index, 'price', e.target.value)}
                      min="0"
                      step="0.01"
                      readOnly={!isEditable}
                    />
                  </div>
                  <div className="col-span-2">
                    <div className="px-3 py-2 bg-slate-50 rounded-md text-sm font-medium">
                      Tsh {parseFloat(String(item.total_price || 0)).toFixed(2)}
                    </div>
                  </div>
                  {isEditable && (
                    <div className="col-span-1">
                      {items.length > 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removeItem(index)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-50 p-6 rounded-lg">
            <div className="flex justify-between items-center text-lg font-semibold text-slate-900">
              <span>Order Total:</span>
              <span>Tsh {calculateOrderTotal().toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center text-sm text-green-600 font-medium mt-2">
              <span>Rebate Amount (1%):</span>
              <span>Tsh {calculateRebateAmount().toFixed(2)}</span>
            </div>
          </div>

          {order.customer_comment && (
            <div className="bg-blue-50 p-6 rounded-lg border border-blue-100">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Customer Comment
              </label>
              <div className="text-sm text-slate-700">{order.customer_comment}</div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          {isEditable && (
            <Button 
              onClick={handleSave} 
              disabled={saving}
              className="bg-gradient-to-r from-blue-600 to-blue-700"
            >
              <Save className="w-4 h-4 mr-2" />
              {saving ? "Saving..." : "Update Order"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
