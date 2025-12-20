import React, { useState } from "react";
import { Order } from "@/entities/Order";
import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { Button } from "@/Components/ui/button";
import { Input } from "@/Components/ui/input";
import { Badge } from "@/Components/ui/badge";
import { Search, Edit, Trash2, ShoppingCart, Calendar, DollarSign, Package, Eye, Lock, Unlock, AlertCircle } from "lucide-react";
import { format, addMonths, isAfter, differenceInDays } from "date-fns";
import { useToast } from "@/Context/ToastContext";

interface OrdersListProps {
  orders: any[];
  onRefresh: () => void;
  onEdit: (order: any) => void;
  canEdit: boolean;
  currentUserRole?: string;
  currentUserId?: string;
}

export default function OrdersList({ orders, onRefresh, onEdit, canEdit, currentUserRole, currentUserId }: OrdersListProps) {
  const { showSuccess, showError, showWarning } = useToast();
  const [searchQuery, setSearchQuery] = useState("");

  const filteredOrders = orders.filter((order: any) =>
    order.order_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    order.customer_id?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDelete = async (orderId: string) => {
    if (currentUserRole !== 'admin') {
      showWarning("Only admins can delete orders.");
      return;
    }
    if (window.confirm("Are you sure you want to delete this order?")) {
      try {
        await Order.delete(orderId);
        showSuccess("Order deleted successfully.");
        onRefresh();
      } catch (error) {
        console.error("Error deleting order:", error);
        showError("Failed to delete order. Please try again.");
      }
    }
  };

  const handleView = (order: any) => {
    // For staff, this opens a view-only dialog
    // For managers/admins, this opens an editable dialog
    onEdit(order);
  };

  const handleUnlock = async (orderId: string) => {
    try {
      await Order.update(orderId, {
        is_locked: false,
        locked_date: undefined
      });
      showSuccess("Order unlocked successfully!");
      onRefresh();
    } catch (error) {
      console.error("Error unlocking order:", error);
      showError("Failed to unlock order. Please try again.");
    }
  };

  const getStatusBadge = (order: any) => {
    const eligibleDate = addMonths(new Date(order.order_date), 6);
    const isEligible = isAfter(new Date(), eligibleDate);
    
    if (order.customer_status === 'confirmed') {
      return <Badge className="bg-green-100 text-green-700">Confirmed</Badge>;
    } else if (order.customer_status === 'disputed') {
      return <Badge className="bg-red-100 text-red-700 flex items-center gap-1">
        <AlertCircle className="w-3 h-3" />
        Disputed
      </Badge>;
    } else {
      return <Badge className="bg-amber-100 text-amber-700">Pending</Badge>;
    }
  };

  // Sort orders: disputed first, then locked, then others
  const sortedOrders = [...filteredOrders].sort((a: any, b: any) => {
    if (a.customer_status === 'disputed' && b.customer_status !== 'disputed') return -1;
    if (a.customer_status !== 'disputed' && b.customer_status === 'disputed') return 1;
    if (a.is_locked && !b.is_locked) return -1;
    if (!a.is_locked && b.is_locked) return 1;
    return 0;
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <CardTitle>All Orders</CardTitle>
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
            <Input
              placeholder="Search orders..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filteredOrders.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            No orders found
          </div>
        ) : (
          <div className="space-y-4">
            {sortedOrders.map((order: any) => {
              const isDisputed = order.customer_status === 'disputed';
              const isLocked = order.is_locked || (order.customer_status === 'pending' && differenceInDays(new Date(), new Date(order.order_date)) >= 3);
              const daysSinceOrder = differenceInDays(new Date(), new Date(order.order_date));
              
              return (
              <div
                key={order.id}
                className={`flex items-center justify-between p-4 border rounded-xl transition-colors ${
                  isDisputed 
                    ? 'border-red-300 bg-red-50 hover:bg-red-100' 
                    : isLocked
                    ? 'border-orange-300 bg-orange-50 hover:bg-orange-100'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/30">
                    <ShoppingCart className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">{order.order_number}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      <p className="text-sm text-slate-600">
                        {format(new Date(order.order_date), 'MMM d, yyyy')}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="font-bold text-slate-900">Tsh {parseFloat(String(order.total_amount || 0)).toFixed(2)}</p>
                    <p className="text-sm text-green-600 font-medium">Tsh {parseFloat(String(order.rebate_amount || 0)).toFixed(2)} rebate</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-slate-600">{order.items?.length || 0} items</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(order)}
                    {isLocked && (
                      <Badge className="bg-orange-100 text-orange-700 flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        Locked
                      </Badge>
                    )}
                    {isDisputed && order.customer_comment && (
                      <div className="text-xs text-red-700 max-w-xs truncate" title={order.customer_comment}>
                        <AlertCircle className="w-3 h-3 inline mr-1" />
                        {order.customer_comment.substring(0, 30)}...
                      </div>
                    )}
                    {((['admin', 'manager'].includes(currentUserRole || '') || (currentUserRole === 'staff' && order.created_by === currentUserId)) && order.customer_status !== 'confirmed') ? (
                       <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onEdit(order)}
                        className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                    ) : (
                      // Read-only view for others or confirmed orders
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onEdit(order)} 
                        className="p-2"
                      >
                         <Eye className="w-4 h-4 text-slate-500" />
                      </Button>
                    )}
                    {isLocked && ['admin', 'manager'].includes(currentUserRole || '') && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleUnlock(order.id)}
                        className="p-2 text-green-600 hover:text-green-700 hover:bg-green-50"
                        title="Unlock Order"
                      >
                        <Unlock className="w-4 h-4" />
                      </Button>
                    )}
                    {currentUserRole === 'admin' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(order.id)}
                        className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )})}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
