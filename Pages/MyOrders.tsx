import React, { useState, useEffect, useCallback } from "react";
import { User } from "@/entities/User";
import { Order } from "@/entities/Order";
import { createPageUrl } from "@/utils";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/Components/ui/card";
import { Badge } from "@/Components/ui/badge";
import { Input } from "@/Components/ui/input";
import { 
  ShoppingCart, 
  Search,
  Calendar,
  DollarSign,
  Package
} from "lucide-react";
import { format, addMonths, isAfter } from "date-fns";

import { OrderCard } from "@/Components/orders";
import { OrderFilters } from "@/Components/orders";

export default function MyOrders() {
  const [user, setUser] = useState(null);
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const applyFilters = useCallback(() => {
    let filtered = [...orders];

    if (searchQuery) {
      filtered = filtered.filter(order =>
        order.order_number?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (filterStatus !== "all") {
      filtered = filtered.filter(order => {
        const eligibleDate = addMonths(new Date(order.order_date), 6);
        const isEligible = isAfter(new Date(), eligibleDate);
        
        if (filterStatus === "eligible") return isEligible;
        if (filterStatus === "pending") return !isEligible;
        return true;
      });
    }

    setFilteredOrders(filtered);
  }, [orders, searchQuery, filterStatus]);
  
  const loadData = useCallback(async () => {
    try {
      const currentUser = await User.me();
      if (['admin', 'manager', 'staff'].includes(currentUser.role)) {
         // Staff should not see this customer-facing page
        navigate(createPageUrl('Dashboard'));
        return;
      }
      setUser(currentUser);
      
      console.log("Loading orders for customer:", currentUser.id);
      const userOrdersResponse = await Order.filter({ customer_id: currentUser.id }, '-order_date');
      console.log("Orders loaded:", userOrdersResponse);
      
      const safeOrders = Array.isArray(userOrdersResponse?.data) ? userOrdersResponse.data : [];
      setOrders(safeOrders as never[]);
    } catch (error) {
      console.error("Error loading orders:", error);
      navigate(createPageUrl("Home"));
    }
    setLoading(false);
  }, [navigate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  const calculateTotals = () => {
    const totalSpent = orders.reduce((sum, order) => sum + (parseFloat(String(order.total_amount || 0))), 0);
    const totalRebate = orders.reduce((sum, order) => sum + (parseFloat(String(order.rebate_amount || 0))), 0);
    
    const eligible = orders.filter(order => {
      const eligibleDate = addMonths(new Date(order.order_date), 6);
      return isAfter(new Date(), eligibleDate);
    });
    
    const eligibleRebate = eligible.reduce((sum, order) => sum + (parseFloat(String(order.rebate_amount || 0))), 0);

    return { totalSpent, totalRebate, eligibleRebate, eligibleCount: eligible.length };
  };

  const totals = calculateTotals();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400" />
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

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0 shadow-xl shadow-blue-500/30">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <Package className="w-8 h-8 opacity-80" />
              </div>
              <p className="text-blue-100 text-sm mb-1">Total Orders</p>
              <p className="text-3xl font-bold">{orders.length}</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white border-0 shadow-xl shadow-purple-500/30">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <DollarSign className="w-8 h-8 opacity-80" />
              </div>
              <p className="text-purple-100 text-sm mb-1">Total Spent</p>
              <p className="text-3xl font-bold">Tsh {totals.totalSpent.toFixed(2)}</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white border-0 shadow-xl shadow-green-500/30">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <ShoppingCart className="w-8 h-8 opacity-80" />
              </div>
              <p className="text-green-100 text-sm mb-1">Available Rebate</p>
              <p className="text-3xl font-bold">Tsh {totals.eligibleRebate.toFixed(2)}</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-500 to-amber-600 text-white border-0 shadow-xl shadow-amber-500/30">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <Calendar className="w-8 h-8 opacity-80" />
              </div>
              <p className="text-amber-100 text-sm mb-1">Total Rebate</p>
              <p className="text-3xl font-bold">Tsh {totals.totalRebate.toFixed(2)}</p>
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
                {orders.length === 0 ? 'No Orders Yet' : 'No Orders Found'}
              </h3>
              <p className="text-slate-600 dark:text-slate-400 text-center">
                {orders.length === 0 
                  ? 'Your orders will appear here once staff adds them to the system.'
                  : 'Try adjusting your search or filters.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            {filteredOrders.map((order) => (
              <OrderCard key={order.id} order={order} onRefresh={loadData} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}