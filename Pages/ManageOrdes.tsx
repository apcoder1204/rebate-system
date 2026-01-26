import React, { useState, useEffect, useCallback } from "react";
import { User } from "@/entities/User";
import { Order, OrderFilters } from "@/entities/Order";
import { Contract } from "@/entities/Contract";
import { Button } from "@/Components/ui/button";
import { Combobox } from "@/Components/ui/combobox";
import { CustomerCombobox } from "@/Components/ui/CustomerCombobox";
import { Plus, Filter, AlertCircle, Lock, Download } from "lucide-react";
import { createPageUrl } from "@/utils";
import { useNavigate } from "react-router-dom";
import { Pagination } from "@/Components/ui/pagination";
import { Card, CardContent } from "@/Components/ui/card";

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
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const navigate = useNavigate();

  const loadOrders = useCallback(async (customerId?: string, status?: string, currentPage?: number, currentPageSize?: number) => {
    try {
      setError(null);
      const filters: OrderFilters = {};
      if (customerId && customerId !== 'all') filters.customer_id = customerId;
      if (status && status !== 'all') filters.customer_status = status;

      const response = await Order.filter(filters, '-order_date', currentPage || page, currentPageSize || pageSize);
      const data = Array.isArray(response?.data) ? response.data : [];
      const pagination = response?.pagination || {
        page: currentPage || page,
        pageSize: currentPageSize || pageSize,
        total: data.length,
        totalPages: data.length === 0 ? 0 : 1,
      };

      setOrders(data as never[]);
      setTotal(pagination.total);
      setTotalPages(pagination.totalPages);
      setPage(pagination.page);
      setPageSize(pagination.pageSize);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load orders';
      setError(errorMessage);
      console.error('Error loading orders:', err);
    }
  }, [page, pageSize]);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);
      const user = await User.me();
      const userRole = user.role || 'user';
      
      if (!['admin', 'manager', 'staff'].includes(userRole)) {
        navigate(createPageUrl('Dashboard'));
        return;
      }
      setCurrentUserRole(userRole);
      setCurrentUserId(user.id);

      const contractsResponse = await Contract.list(undefined, { includeAll: true });
      const allContracts = contractsResponse.data;
      const allUsersResponse = await User.list();
      const customerUsers = allUsersResponse.data.filter(u => !['admin', 'manager', 'staff'].includes(u.role || 'user')); 
      
      setContracts(allContracts as never[]);
      setCustomers(customerUsers as never[]);

      await loadOrders(filterCustomerId, filterStatus);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load data';
      setError(errorMessage);
      console.error("Error loading data:", error);
      navigate(createPageUrl('Home'));
    } finally {
      setLoading(false);
    }
  }, [filterCustomerId, filterStatus, loadOrders, navigate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    // Refresh orders when filters or pagination change
    loadOrders(filterCustomerId, filterStatus, page, pageSize);
  }, [filterCustomerId, filterStatus, page, pageSize, loadOrders]);

  const handleEdit = (order: any) => {
    const isOwner = order.created_by === currentUserId;
    const isDisputed = order.customer_status === 'disputed';
    const isConfirmed = order.customer_status === 'confirmed';
    const canModify =
      ['admin', 'manager'].includes(currentUserRole || '') ||
      (currentUserRole === 'staff' && (isOwner || isDisputed));

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

    const canEdit = ['admin', 'manager', 'staff'].includes(currentUserRole || '');

  return (
    <div className="min-h-screen p-6 md:p-8 bg-slate-50 dark:bg-slate-900">
      <div className="max-w-7xl mx-auto space-y-8">
        {error && (
          <Card className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
            <CardContent className="p-4">
              <p className="text-red-800 dark:text-red-200">{error}</p>
              <button
                onClick={() => loadData()}
                className="mt-2 text-sm text-red-700 dark:text-red-300 underline hover:no-underline"
              >
                Try Again
              </button>
            </CardContent>
          </Card>
        )}
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
          const lockedOrders = orders.filter((o: any) => !!o.is_locked);
          
          if (disputedOrders.length > 0 || lockedOrders.length > 0) {
            return (
              <div className="space-y-3">
                {disputedOrders.length > 0 && (
                  <Card className="border-2 border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="font-semibold text-red-900 dark:text-red-100">
                            {disputedOrders.length} Order{disputedOrders.length > 1 ? 's' : ''} Require{disputedOrders.length === 1 ? 's' : ''} Attention
                          </p>
                          <p className="text-sm text-red-800 dark:text-red-200">
                            Customer{disputedOrders.length > 1 ? 's have' : ' has'} disputed {disputedOrders.length === 1 ? 'an order' : 'orders'}. Please review and take action.
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setFilterStatus('disputed')}
                          className="border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30"
                        >
                          View Disputed Orders
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
                {lockedOrders.length > 0 && (
                  <Card className="border-2 border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-900/20">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <Lock className="w-5 h-5 text-orange-600 dark:text-orange-400 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="font-semibold text-orange-900 dark:text-orange-100">
                            {lockedOrders.length} Locked Order{lockedOrders.length > 1 ? 's' : ''}
                          </p>
                          <p className="text-sm text-orange-800 dark:text-orange-200">
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
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Filter by Customer
                </label>
                <CustomerCombobox
                  value={filterCustomerId}
                  onChange={setFilterCustomerId}
                  placeholder="All customers"
                  includeAll={true}
                />
              </div>
              
              <div className="w-full md:w-56">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
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
              
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  className="w-full md:w-auto" 
                  onClick={() => { 
                    setFilterCustomerId("all"); 
                    setFilterStatus("all");
                    setPage(1);
                    loadOrders("all", "all", 1, pageSize);
                  }}
                >
                  <Filter className="w-4 h-4 mr-2" />
                  Reset Filters
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full md:w-auto" 
                  onClick={async () => {
                    try {
                      const filters: OrderFilters = {};
                      if (filterCustomerId && filterCustomerId !== 'all') filters.customer_id = filterCustomerId;
                      if (filterStatus && filterStatus !== 'all') filters.customer_status = filterStatus;
                      
                      const blob = await Order.exportCSV(filters);
                      const url = window.URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `orders_${new Date().toISOString().split('T')[0]}.csv`;
                      document.body.appendChild(a);
                      a.click();
                      window.URL.revokeObjectURL(url);
                      document.body.removeChild(a);
                    } catch (error) {
                      console.error('Export failed:', error);
                      alert('Failed to export orders. Please try again.');
                    }
                  }}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export CSV
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <OrdersList 
          orders={orders} 
          onRefresh={() => {
            setPage(1);
            loadOrders(filterCustomerId, filterStatus, 1, pageSize);
          }}
          onEdit={handleEdit}
          canEdit={canEdit}
          currentUserRole={currentUserRole || undefined}
          currentUserId={currentUserId || undefined}
        />

        {totalPages > 0 && (
          <Card>
            <Pagination
              page={page}
              pageSize={pageSize}
              total={total}
              totalPages={totalPages}
              onPageChange={(newPage) => {
                setPage(newPage);
                loadOrders(filterCustomerId, filterStatus, newPage, pageSize);
              }}
              onPageSizeChange={(newPageSize) => {
                setPageSize(newPageSize);
                setPage(1);
                loadOrders(filterCustomerId, filterStatus, 1, newPageSize);
              }}
            />
          </Card>
        )}

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