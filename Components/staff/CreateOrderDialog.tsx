import React, { useState, useEffect } from "react";
import { Order } from "@/entities/Order";
import { Contract } from "@/entities/Contract";
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
import { Combobox } from "@/Components/ui/combobox";
import { Plus, Trash2, ShoppingCart } from "lucide-react";
import { useToast } from "@/Context/ToastContext";

interface CreateOrderDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  contracts: any[];
  customers: any[];
  editingOrder: any;
}

export default function CreateOrderDialog({ 
  open, 
  onClose, 
  onSuccess, 
  contracts, 
  customers, 
  editingOrder 
}: CreateOrderDialogProps) {
  const { showSuccess, showError, showWarning } = useToast();
  const [formData, setFormData] = useState({
    customer_id: "",
    contract_id: "",
    order_date: new Date().toISOString().split('T')[0],
  });
  
  const [items, setItems] = useState([
    { product_name: "", quantity: "", price: "", total_price: 0 }
  ]);
  
  const [availableContracts, setAvailableContracts] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (editingOrder) {
      setFormData({
        customer_id: editingOrder.customer_id || "",
        contract_id: editingOrder.contract_id || "",
        order_date: editingOrder.order_date ? editingOrder.order_date.split('T')[0] : new Date().toISOString().split('T')[0],
      });
      setItems(editingOrder.items?.map((item: any) => ({
        ...item,
        price: String(item.unit_price || item.price || ""),
        quantity: String(item.quantity || ""),
        total_price: parseFloat(String(item.total_price || 0))
      })) || [{ product_name: "", quantity: "", price: "", total_price: 0 }]);
    } else {
      setFormData({
        customer_id: "",
        contract_id: "",
        order_date: new Date().toISOString().split('T')[0],
      });
      setItems([{ product_name: "", quantity: "", price: "", total_price: 0 }]);
    }
  }, [editingOrder, open]);

  useEffect(() => {
    if (formData.customer_id) {
      const customerContracts = contracts.filter((c: any) => c.customer_id === formData.customer_id);
      setAvailableContracts(customerContracts);
      if (customerContracts.length > 0 && !formData.contract_id) {
        setFormData(prev => ({ ...prev, contract_id: customerContracts[0].id }));
      }
    } else {
      setAvailableContracts([]);
    }
  }, [formData.customer_id, contracts]);

  const updateItem = (index: number, field: string, value: string) => {
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
    setItems([...items, { product_name: "", quantity: "", price: "", total_price: 0 }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const calculateOrderTotal = () => {
    return items.reduce((sum, item) => sum + (item.total_price || 0), 0);
  };

  const calculateRebateAmount = () => {
    return calculateOrderTotal() * 0.01; // 1% rebate
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.customer_id) {
      showWarning("Please select a customer");
      return;
    }
    
    if (!formData.contract_id) {
      showWarning("Please select a contract");
      return;
    }
    
    if (items.some(item => !item.product_name || !item.quantity || !item.price)) {
      showWarning("Please fill in all item details");
      return;
    }
    
    if (calculateOrderTotal() <= 0) {
      showWarning("Order total must be greater than 0");
      return;
    }

    setSubmitting(true);
    try {
      const orderData = {
        ...formData,
        items: items.map(item => ({
          product_name: item.product_name,
          quantity: parseInt(String(item.quantity)),
          unit_price: parseFloat(item.price),
          total_price: parseFloat(String(item.total_price))
        })),
        total_amount: calculateOrderTotal(),
        rebate_amount: calculateRebateAmount(),
        customer_status: 'pending' as const
      };

      if (editingOrder) {
        await Order.update(editingOrder.id, orderData);
      } else {
        // Check if this is the first order for the customer
        let isFirstOrder = false;
        try {
          const existingOrders = await Order.filter({ customer_id: formData.customer_id });
          isFirstOrder = existingOrders.length === 0;
        } catch (err) {
          console.warn("Failed to check existing orders", err);
        }

        await Order.create(orderData);

        // If first order, activate the pending contract
        if (isFirstOrder) {
          const selectedContract = availableContracts.find(c => c.id === formData.contract_id);
          if (selectedContract && selectedContract.status === 'pending') {
            try {
              await Contract.update(formData.contract_id, { status: 'active' });
            } catch (err) {
              console.error("Failed to auto-activate contract", err);
            }
          }
        }
      }
      
      showSuccess(editingOrder ? "Order updated successfully!" : "Order created successfully!", 5000);
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error saving order:", error);
      showError("Failed to save order. Please try again.");
    }
    setSubmitting(false);
  };

  const getCustomerName = (customerId: string) => {
    const customer = customers.find((c: any) => c.id === customerId);
    return customer ? customer.full_name : customerId;
  };

  const customerOptions = customers.map((c: any) => ({
    value: c.id,
    label: c.full_name || "Unknown Name",
    subLabel: c.email
  }));

  const contractOptions = availableContracts.map((c: any) => ({
    value: c.id,
    label: c.contract_number || "No Contract Number",
    subLabel: `Status: ${c.status}`
  }));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto p-6 md:p-8">
        <DialogHeader className="pb-3 border-b border-slate-100">
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-blue-600" />
            {editingOrder ? 'Edit Order' : 'Create New Order'}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6 mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="customer_id">Customer *</Label>
              <Combobox
                options={customerOptions}
                value={formData.customer_id}
                onChange={(value) => setFormData(prev => ({ ...prev, customer_id: value, contract_id: "" }))}
                placeholder="Select customer"
                className="mt-1"
              />
            </div>
            
            <div>
              <Label htmlFor="contract_id">Contract *</Label>
              <Combobox
                options={contractOptions}
                value={formData.contract_id}
                onChange={(value) => setFormData(prev => ({ ...prev, contract_id: value }))}
                placeholder="Select contract"
                disabled={!formData.customer_id}
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="order_date">Order Date</Label>
            <Input
              id="order_date"
              type="date"
              value={formData.order_date}
              onChange={(e) => setFormData(prev => ({ ...prev, order_date: e.target.value }))}
              className="mt-1"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-4">
              <Label>Order Items *</Label>
            </div>
            
            <div className="space-y-4">
              {/* Header row */}
              <div className="grid grid-cols-12 gap-4 text-sm font-semibold text-slate-600 border-b pb-2">
                <div className="col-span-5">Product Name</div>
                <div className="col-span-2">Qty</div>
                <div className="col-span-2">Price</div>
                <div className="col-span-2">Total</div>
                <div className="col-span-1">Action</div>
              </div>
              
              {items.map((item, index) => (
                <div key={index} className="grid grid-cols-12 gap-4 items-center">
                  <div className="col-span-5">
                    <Input
                      placeholder="Product name"
                      value={item.product_name}
                      onChange={(e) => updateItem(index, 'product_name', e.target.value)}
                      required
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      placeholder="0"
                      value={item.quantity}
                      onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                      min="1"
                      required
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
                      required
                    />
                  </div>
                  <div className="col-span-2">
                    <div className="px-3 py-2 bg-slate-50 rounded-md text-sm font-medium">
                      Tsh {parseFloat(String(item.total_price || 0)).toFixed(2)}
                    </div>
                  </div>
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
                </div>
              ))}
              
              <div className="flex justify-end mt-4">
                <Button type="button" onClick={addItem} size="sm" variant="outline">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Item
                </Button>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-lg">
            <div className="flex justify-between items-center text-lg font-semibold">
              <span>Order Total:</span>
              <span>Tsh {calculateOrderTotal().toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center text-sm text-green-600 mt-1">
              <span>Rebate Amount (1%):</span>
              <span>Tsh {calculateRebateAmount().toFixed(2)}</span>
            </div>
          </div>
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={submitting}
            className="bg-gradient-to-r from-blue-600 to-blue-700"
          >
            {submitting ? "Saving..." : editingOrder ? "Update Order" : "Create Order"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
