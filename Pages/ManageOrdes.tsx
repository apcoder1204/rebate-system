import React, { useState, useEffect, useCallback } from "react";
import { User } from "@/entities/User";
import { Order } from "@/entities/Order";
import { Contract } from "@/entities/Contract";
import { Button } from "@/Components/ui/button";
import { Combobox } from "@/Components/ui/combobox";
import { Plus, Filter, AlertCircle, Lock } from "lucide-react";
import { createPageUrl } from "@/utils";
import { useNavigate } from "react-router-dom";

import OrdersList from "@/Components/staff/OrdersList";
import CreateOrderDialog from "@/Components/staff/CreateOrderDialog";
import ViewOrderDialog from "@/Components/staff/ViewOrderDialog";
import { Card, CardContent } from "@/Components/ui/card";

export default function ManageOrders() {
  const [orders, setOrders] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [filterCustomerId, setFilterCustomerId] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const loadOrders = useCallback(async (customerId?: string, status?: string) => {
    const filters: any = {};
    if (customerId && customerId !== 'all') filters.customer_id = customerId;
    if (status && status !== 'all') filters.customer_status = status;

    const allOrders = await Order.filter(filters, '-order_date');
    setOrders(allOrders as never[]);
  }, []);

  const loadData = useCallback(async () => {
    try {
      const user = await User.me();
      const userRole = user.role || 'user';
      
      if (!['admin', 'manager', 'staff'].includes(userRole)) {
        navigate(createPageUrl('Dashboard'));
        return;
      }
      setCurrentUserRole(userRole);
      setCurrentUserId(user.id);

      const allContracts = await Contract.list();
      const allUsers = await User.list();
      const customerUsers = allUsers.filter(u => !['admin', 'manager', 'staff'].includes(u.role || 'user')); 
      
      setContracts(allContracts as never[]);
      setCustomers(customerUsers as never[]);

      await loadOrders(filterCustomerId, filterStatus);
    } catch (error) {
      console.error("Error loading data:", error);
      navigate(createPageUrl('Home'));
    }
    setLoading(false);
  }, [filterCustomerId, filterStatus, loadOrders, navigate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    // Refresh orders when filters change
    loadOrders(filterCustomerId, filterStatus);
  }, [filterCustomerId, filterStatus, loadOrders]);

  const handleEdit = (order: any) => {
    const isOwner = order.created_by === currentUserId;
    const canModify = ['admin', 'manager'].includes(currentUserRole || '') || (currentUserRole === 'staff' && isOwner);
    const isConfirmed = order.customer_status === 'confirmed';
    
    setEditingOrder(order);
    
    if (canModify && !isConfirmed) {
      setShowCreateDialog(true);
    } else {
      // View only mode
      setShowViewDialog(true);
    }
  };

  const handleCloseDialog = () => {
    setShowCreateDialog(false);
    setShowViewDialog(false);
    setEditingOrder(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400" />
      </div>
    );
  }

    const canEdit = ['admin', 'manager'].includes(currentUserRole || '');

  return (
    <div className="min-h-screen p-6 md:p-8 bg-slate-50 dark:bg-slate-900">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-slate-100 mb-2">Manage Orders</h1>
            <p className="text-slate-600 dark:text-slate-400">Create and manage customer orders</p>
          </div>
          <Button
            onClick={() => setShowCreateDialog(true)}
            className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-lg shadow-blue-500/30"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Order
          </Button>
        </div>

        {/* Notification Banner for Disputed Orders */}
        {(() => {
          const disputedOrders = orders.filter((o: any) => o.customer_status === 'disputed');
          const lockedOrders = orders.filter((o: any) => {
            const daysSinceOrder = Math.floor((new Date().getTime() - new Date(o.order_date).getTime()) / (1000 * 60 * 60 * 24));
            return o.is_locked || (o.customer_status === 'pending' && daysSinceOrder >= 3);
          });
          
          if (disputedOrders.length > 0 || lockedOrders.length > 0) {
            return (
              <div className="space-y-3">
                {disputedOrders.length > 0 && (
                  <Card className="border-2 border-red-300 bg-red-50">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="font-semibold text-red-900">
                            {disputedOrders.length} Order{disputedOrders.length > 1 ? 's' : ''} Require{disputedOrders.length === 1 ? 's' : ''} Attention
                          </p>
                          <p className="text-sm text-red-800">
                            Customer{disputedOrders.length > 1 ? 's have' : ' has'} disputed {disputedOrders.length === 1 ? 'an order' : 'orders'}. Please review and take action.
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setFilterStatus('disputed')}
                          className="border-red-300 text-red-700 hover:bg-red-100"
                        >
                          View Disputed Orders
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
                {lockedOrders.length > 0 && (
                  <Card className="border-2 border-orange-300 bg-orange-50">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <Lock className="w-5 h-5 text-orange-600 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="font-semibold text-orange-900">
                            {lockedOrders.length} Locked Order{lockedOrders.length > 1 ? 's' : ''}
                          </p>
                          <p className="text-sm text-orange-800">
                            {lockedOrders.length === 1 ? 'An order has' : 'Orders have'} been locked due to non-confirmation within 3 days.
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            );
          }
          return null;
        })()}

        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-6 items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Filter by Customer
                </label>
                <Combobox
                  options={[
                    { value: "all", label: "All customers" },
                    ...customers.map((c: any) => ({
                      value: c.id,
                      label: c.full_name || "Unknown Name",
                      subLabel: c.email
                    }))
                  ]}
                  value={filterCustomerId}
                  onChange={setFilterCustomerId}
                  placeholder="All customers"
                />
              </div>
              
              <div className="w-full md:w-56">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Status
                </label>
                <Combobox
                  options={[
                    { value: "all", label: "All statuses" },
                    { value: "pending", label: "Pending" },
                    { value: "confirmed", label: "Confirmed" },
                    { value: "disputed", label: "Disputed" }
                  ]}
                  value={filterStatus}
                  onChange={setFilterStatus}
                  placeholder="All statuses"
                />
              </div>
              
              <div>
                <Button 
                  variant="outline" 
                  className="w-full md:w-auto" 
                  onClick={() => { 
                    setFilterCustomerId("all"); 
                    setFilterStatus("all"); 
                  }}
                >
                  <Filter className="w-4 h-4 mr-2" />
                  Reset Filters
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <OrdersList 
          orders={orders} 
          onRefresh={() => loadOrders(filterCustomerId, filterStatus)}
          onEdit={handleEdit}
          canEdit={canEdit}
          currentUserRole={currentUserRole || undefined}
          currentUserId={currentUserId || undefined}
        />

        <CreateOrderDialog
          open={showCreateDialog}
          onClose={handleCloseDialog}
          onSuccess={loadData}
          contracts={contracts}
          customers={customers}
          editingOrder={editingOrder}
        />

        <ViewOrderDialog
          open={showViewDialog}
          onClose={handleCloseDialog}
          order={editingOrder}
          isEditable={false}
          onSave={async () => {}}
          customers={customers}
        />
      </div>
    </div>
  );
}