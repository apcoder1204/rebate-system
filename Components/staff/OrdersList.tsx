import React, { useState } from "react";
import { Order } from "@/entities/Order";
import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { Button } from "@/Components/ui/button";
import { Input } from "@/Components/ui/input";
import { Badge } from "@/Components/ui/badge";
import { Search, Edit, Trash2, ShoppingCart, Calendar, DollarSign, Package, Eye, Lock, Unlock, AlertCircle, Download } from "lucide-react";
import { format, addMonths, isAfter, differenceInDays } from "date-fns";
import { useToast } from "@/Context/ToastContext";
import jsPDF from "jspdf";

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

  const handleDownload = (order: any) => {
    const doc = new jsPDF();

    // Header
    doc.setFontSize(14);
    doc.text(`Order ${order.order_number || order.id || ""}`, 14, 16);
    doc.setFontSize(10);
    doc.text(`Status: ${(order.customer_status || "unknown").toUpperCase()}`, 14, 22);
    doc.text(`Date: ${order.order_date ? new Date(order.order_date).toLocaleDateString() : "N/A"}`, 100, 22);
    doc.text(`Customer: ${order.customer_name || order.customer_id || "N/A"}`, 14, 28);

    // Table layout - refined column positions for better alignment
    const startY = 38;
    // Item (narrow), Description (wide), QTY (right-aligned), Unit price (right-aligned), AmountTotal (right-aligned)
    const colX = [14, 25, 130, 155, 185]; 
    const rowHeight = 10;

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Item", colX[0], startY);
    doc.text("Itemdescription", colX[1], startY);
    doc.text("QTY", colX[2], startY, { align: "right" });
    doc.text("Unit price", colX[3], startY, { align: "right" });
    doc.text("AmountTotal", colX[4], startY, { align: "right" });

    doc.setFont("helvetica", "normal");
    const items = order.items || [];
    let y = startY + rowHeight;
    items.forEach((item: any, index: number) => {
      doc.text(String(index + 1), colX[0], y);
      doc.text(String(item.product_name || "Item"), colX[1], y);
      doc.text(String(item.quantity ?? 0), colX[2], y, { align: "right" });
      doc.text(`${parseFloat(String(item.unit_price || 0)).toLocaleString()}`, colX[3], y, { align: "right" });
      doc.text(`${parseFloat(String(item.total_price || 0)).toLocaleString()}`, colX[4], y, { align: "right" });
      y += rowHeight;
    });

    // Totals row - right-aligned
    const totalAmount = parseFloat(String(order.total_amount || 0));
    doc.setFont("helvetica", "bold");
    doc.text("TOTAL", colX[3], y, { align: "right" });
    doc.text(`${totalAmount.toLocaleString()}`, colX[4], y, { align: "right" });

    const filename = `${order.order_number || "order"}.pdf`;
    doc.save(filename);
  };

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
                className={`flex flex-col md:flex-row items-start md:items-center justify-between p-4 border rounded-xl transition-colors gap-4 ${
                  isDisputed 
                    ? 'border-red-300 bg-red-50 hover:bg-red-100' 
                    : isLocked
                    ? 'border-orange-300 bg-orange-50 hover:bg-orange-100'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-4 w-full md:w-auto">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/30 flex-shrink-0">
                    <ShoppingCart className="w-6 h-6 text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 truncate">{order.order_number}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Calendar className="w-3 h-3 text-slate-400 flex-shrink-0" />
                      <p className="text-sm text-slate-600 truncate">
                        {format(new Date(order.order_date), 'MMM d, yyyy')}
                      </p>
                    </div>
                    {(['admin', 'manager'].includes(currentUserRole || '') || currentUserId === order.created_by) && (
                      <p className="text-xs text-slate-500 mt-1">
                        Created by: {order.creator_name || order.created_by || 'Unknown'}
                      </p>
                    )}
                  </div>
                </div>
                
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full md:w-auto">
                  <div className="flex flex-row sm:flex-col justify-between w-full sm:w-auto sm:text-right gap-2 sm:gap-0">
                    <div>
                      <p className="font-bold text-slate-900">Tsh {parseFloat(String(order.total_amount || 0)).toFixed(2)}</p>
                      <p className="text-sm text-green-600 font-medium">Tsh {parseFloat(String(order.rebate_amount || 0)).toFixed(2)} rebate</p>
                    </div>
                    <div className="sm:hidden text-right">
                       <p className="text-sm text-slate-600">{order.items?.length || 0} items</p>
                    </div>
                  </div>
                  <div className="hidden sm:block text-right">
                    <p className="text-sm text-slate-600">{order.items?.length || 0} items</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    {getStatusBadge(order)}
                    {isLocked && (
                      <Badge className="bg-orange-100 text-orange-700 flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        Locked
                      </Badge>
                    )}
                    {isDisputed && order.customer_comment && (
                      <div className="text-xs text-red-700 max-w-xs truncate w-full sm:w-auto" title={order.customer_comment}>
                        <AlertCircle className="w-3 h-3 inline mr-1" />
                        {order.customer_comment.substring(0, 30)}...
                      </div>
                    )}
                    <div className="flex items-center gap-2 ml-auto sm:ml-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownload(order)}
                        className="p-2"
                        title="Download PDF"
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                      {((['admin', 'manager'].includes(currentUserRole || '')) ||
                        (currentUserRole === 'staff' && (order.created_by === currentUserId || isDisputed))) &&
                        order.customer_status !== 'confirmed' ? (
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
              </div>
            )})}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
