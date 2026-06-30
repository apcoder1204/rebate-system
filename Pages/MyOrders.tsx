import React, { useState, useEffect, useCallback } from "react";
import { User } from "@/entities/User";
import { Order } from "@/entities/Order";
import { createPageUrl } from "@/utils";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/Components/ui/card";
import { Button } from "@/Components/ui/button";
import {
  ShoppingCart,
  Search,
  Calendar,
  DollarSign,
  Package,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import { OrderCard } from "@/Components/orders";
import { OrderFilters } from "@/Components/orders";

const PAGE_SIZE = 20;

export default function MyOrders() {
  const [user, setUser] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [grandTotalAmount, setGrandTotalAmount] = useState(0);
  const [grandTotalRebate, setGrandTotalRebate] = useState(0);
  const [unpaidEligibleRebate, setUnpaidEligibleRebate] = useState(0);
  const navigate = useNavigate();

  const loadData = useCallback(async (page = 1) => {
    try {
      const currentUser = await User.me();
      if (['admin', 'manager', 'staff'].includes(currentUser.role)) {
        navigate(createPageUrl('Dashboard'));
        return;
      }
      setUser(currentUser);

      const response = await Order.filter(
        { customer_id: currentUser.id },
        '-order_date',
        page,
        PAGE_SIZE
      );

      const safeOrders = Array.isArray(response?.data) ? response.data : [];
      setOrders(safeOrders);
      setCurrentPage(response.pagination?.page ?? 1);
      setTotalPages(response.pagination?.totalPages ?? 1);
      setTotalCount(response.pagination?.total ?? safeOrders.length);

      if (response.totals) {
        setGrandTotalAmount(response.totals.totalAmount ?? 0);
        setGrandTotalRebate(response.totals.totalRebate ?? 0);
        setUnpaidEligibleRebate(response.totals.unpaidEligibleRebate ?? 0);
      }
    } catch (error: any) {
      console.error("Error loading orders:", error);
      setLoadError(error?.message || "Failed to load orders. Please try again.");
    }
    setLoading(false);
  }, [navigate]);

  useEffect(() => {
    loadData(1);
  }, [loadData]);

  // Client-side filter on the current page only (search + status)
  const filteredOrders = orders.filter((order) => {
    const matchesSearch = !searchQuery ||
      order.order_number?.toLowerCase().includes(searchQuery.toLowerCase());

    let matchesStatus = true;
    if (filterStatus === "eligible") {
      // Orders under expired contracts with unpaid rebate
      matchesStatus = order.contract_status === 'expired' && order.rebate_status !== 'paid';
    } else if (filterStatus === "pending") {
      matchesStatus = order.customer_status === 'pending';
    }

    return matchesSearch && matchesStatus;
  });

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    setLoading(true);
    loadData(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen p-6 md:p-8 bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <ShoppingCart className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">Could not load orders</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">{loadError}</p>
            <Button onClick={() => { setLoadError(null); setLoading(true); loadData(1); }}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 md:p-8 bg-slate-50 dark:bg-slate-900">
      <div className="max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-slate-100 mb-2">My Orders</h1>
          <p className="text-slate-600 dark:text-slate-400">Track your orders and rebate eligibility</p>
        </div>

        {/* Stats — always reflect ALL orders via API totals, not just current page */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0 shadow-xl shadow-blue-500/30">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <Package className="w-8 h-8 opacity-80" />
              </div>
              <p className="text-blue-100 text-sm mb-1">Total Orders</p>
              <p className="text-3xl font-bold">{totalCount}</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white border-0 shadow-xl shadow-purple-500/30">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <DollarSign className="w-8 h-8 opacity-80" />
              </div>
              <p className="text-purple-100 text-sm mb-1">Total Spent</p>
              <p className="text-3xl font-bold">Tsh {grandTotalAmount.toFixed(2)}</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white border-0 shadow-xl shadow-green-500/30">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <ShoppingCart className="w-8 h-8 opacity-80" />
              </div>
              <p className="text-green-100 text-sm mb-1">Rebate Due</p>
              <p className="text-3xl font-bold">Tsh {unpaidEligibleRebate.toFixed(2)}</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-500 to-amber-600 text-white border-0 shadow-xl shadow-amber-500/30">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <Calendar className="w-8 h-8 opacity-80" />
              </div>
              <p className="text-amber-100 text-sm mb-1">Total Rebate</p>
              <p className="text-3xl font-bold">Tsh {grandTotalRebate.toFixed(2)}</p>
            </CardContent>
          </Card>
        </div>

        <OrderFilters
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          filterStatus={filterStatus}
          setFilterStatus={setFilterStatus}
        />

        {filteredOrders.length === 0 ? (
          <Card className="border-dashed border-2 border-slate-200 dark:border-slate-700">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <ShoppingCart className="w-16 h-16 text-slate-300 dark:text-slate-600 mb-4" />
              <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-2">
                {totalCount === 0 ? 'No Orders Yet' : 'No Orders Found'}
              </h3>
              <p className="text-slate-600 dark:text-slate-400 text-center">
                {totalCount === 0
                  ? 'Your orders will appear here once staff adds them to the system.'
                  : 'Try adjusting your search or filters.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            {filteredOrders.map((order) => (
              <OrderCard key={order.id} order={order} onRefresh={() => loadData(currentPage)} />
            ))}
          </div>
        )}

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 pt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage <= 1 || loading}
              className="flex items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" />
              Prev
            </Button>

            <span className="text-sm text-slate-600 dark:text-slate-400 px-2">
              Page {currentPage} of {totalPages}
              <span className="ml-2 text-slate-400 dark:text-slate-500">({totalCount} orders)</span>
            </span>

            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= totalPages || loading}
              className="flex items-center gap-1"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
