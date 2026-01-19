
import React, { useState, useEffect, useCallback } from "react";
import { User } from "@/entities/User";
import { Contract } from "@/entities/Contract";
import { Order } from "@/entities/Order";
import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { Button } from "@/Components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { 
  FileText, 
  ShoppingCart, 
  DollarSign, 
  Clock,
  TrendingUp,
  CheckCircle,
  AlertCircle
} from "lucide-react";
import { addMonths, isAfter } from "date-fns";

import StatsCard from "../Components/dashboard/StatsCard";
import RecentActivity from "../Components/dashboard/RecentActivity";
import RebateTimeline from "../Components/dashboard/RebateTimeline";

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [contracts, setContracts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const ensureArray = <T,>(value: any): T[] => (Array.isArray(value) ? value : []);

  const loadData = useCallback(async () => {
    try {
      console.log("Loading dashboard data...");
      const currentUser = await User.me();
      console.log("Current user:", currentUser);
      setUser(currentUser);

      if (currentUser.role === 'admin') {
        const contractsResponse = await Contract.list('-created_date', undefined, 1, 100);
        const ordersResponse = await Order.list('-order_date', 1, 100);
        console.log("Admin data - contracts:", contractsResponse, "orders:", ordersResponse);
        setContracts(ensureArray(contractsResponse?.data));
        setOrders(ensureArray(ordersResponse?.data));
      } else {
        const userContractsResponse = await Contract.filter({ customer_id: currentUser.id }, undefined, 1, 100);
        const userOrdersResponse = await Order.filter({ customer_id: currentUser.id }, '-order_date', 1, 100);
        console.log("User data - contracts:", userContractsResponse, "orders:", userOrdersResponse);
        setContracts(ensureArray(userContractsResponse?.data));
        setOrders(ensureArray(userOrdersResponse?.data));
      }
    } catch (error) {
      console.error("Error loading dashboard data:", error);
      // If user is not authenticated, redirect to home
      navigate(createPageUrl("Home"));
    }
    setLoading(false);
  }, [navigate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const calculateStats = () => {
    const safeOrders = ensureArray<any>(orders);
    const safeContracts = ensureArray<any>(contracts);

    const totalOrders = safeOrders.length;
    const totalSpent = safeOrders.reduce((sum, order) => sum + (parseFloat(String(order.total_amount || 0))), 0);
    
    const eligibleOrders = safeOrders.filter(order => {
      const eligibleDate = addMonths(new Date(order.order_date), 6);
      return isAfter(new Date(), eligibleDate);
    });
    
    const eligibleRebate = eligibleOrders.reduce((sum, order) => sum + (parseFloat(String(order.rebate_amount || 0))), 0);
    const pendingRebate = safeOrders.reduce((sum, order) => sum + (parseFloat(String(order.rebate_amount || 0))), 0) - eligibleRebate;

    return {
      totalOrders,
      totalSpent,
      eligibleRebate,
      pendingRebate,
      activeContracts: safeContracts.filter(c => c.status === 'active').length
    };
  };

  const stats = calculateStats();
  const userRole = user?.role || 'user';
  const isStaff = ['admin', 'manager', 'staff'].includes(userRole);
  
  console.log("Dashboard render - user:", user, "stats:", stats, "contracts:", contracts, "orders:", orders);

  // Create activities from orders and contracts
  const activities = [
    ...ensureArray<any>(orders).slice(0, 5).map(order => ({
      id: order.id,
      type: 'order' as const,
      title: `Order #${order.order_number}`,
      description: `Total: Tsh ${parseFloat(String(order.total_amount || 0)).toFixed(2)}`,
      timestamp: order.order_date,
      status: order.customer_status
    })),
    ...ensureArray<any>(contracts).slice(0, 3).map(contract => ({
      id: contract.id,
      type: 'contract' as const,
      title: `Contract #${contract.contract_number || contract.id}`,
      description: `Customer: ${contract.customer_name}`,
      timestamp: contract.created_date || new Date().toISOString(),
      status: contract.status
    }))
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 5);

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 md:p-8 bg-slate-50 dark:bg-slate-900">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-slate-100 mb-2">
              Welcome back, {user?.full_name?.split(' ')[0]}
            </h1>
            <p className="text-slate-600 dark:text-slate-400">
              {isStaff ? 'Manage rebate contracts and orders' : 'Track your rebates and orders'}
            </p>
          </div>
          {!isStaff && (
            <Link to={createPageUrl("MyContracts")}>
              <Button className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-lg shadow-blue-500/30">
                <FileText className="w-4 h-4 mr-2" />
                View Contracts
              </Button>
            </Link>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatsCard
            title={isStaff ? "Total Contracts" : "Active Contracts"}
            value={stats.activeContracts}
            icon={<FileText className="w-6 h-6 text-white" />}
          />
          <StatsCard
            title="Total Orders"
            value={stats.totalOrders}
            icon={<ShoppingCart className="w-6 h-6 text-white" />}
          />
          <StatsCard
            title="Available Rebate"
            value={`Tsh ${stats.eligibleRebate.toFixed(2)}`}
            icon={<CheckCircle className="w-6 h-6 text-white" />}
            trend={stats.eligibleRebate > 0 ? { value: 100, isPositive: true } : undefined}
          />
          <StatsCard
            title="Pending Rebate"
            value={`Tsh ${stats.pendingRebate.toFixed(2)}`}
            icon={<Clock className="w-6 h-6 text-white" />}
          />
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <RecentActivity activities={activities} />
          </div>
          <div>
            <RebateTimeline orders={orders} />
          </div>
        </div>

        {!isStaff && contracts.length === 0 && (
          <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/20">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-blue-100 dark:bg-blue-900/40 rounded-xl">
                  <AlertCircle className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-1">Get Started with Your Rebate Contract</h3>
                  <p className="text-slate-600 dark:text-slate-400 text-sm mb-4">
                    Download, sign, and upload your rebate contract to start earning 1% back on all your purchases.
                  </p>
                  <Link to={createPageUrl("MyContracts")}>
                    <Button variant="outline" className="bg-white dark:bg-slate-800">
                      Start Now
                    </Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
