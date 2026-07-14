
import React, { useState, useEffect, useCallback } from "react";
import { User } from "@/entities/User";
import { Contract } from "@/entities/Contract";
import { Order } from "@/entities/Order";
import { Rebate, RebateRequest } from "@/entities/Rebate";
import { Card, CardContent } from "@/Components/ui/card";
import { Button } from "@/Components/ui/button";
import { Badge } from "@/Components/ui/badge";
import { Textarea } from "@/Components/ui/textarea";
import {
  Dialog,
  DialogContent,
} from "@/Components/ui/dialog";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  FileText,
  ShoppingCart,
  DollarSign,
  Clock,
  CheckCircle,
  AlertCircle,
  Wallet,
  Gift,
  Loader2,
} from "lucide-react";

import StatsCard from "../Components/dashboard/StatsCard";
import RecentActivity from "../Components/dashboard/RecentActivity";
import RebateTimeline from "../Components/dashboard/RebateTimeline";
import { useToast } from "@/Context/ToastContext";

export default function Dashboard() {
  const [user, setUser] = useState<any>(null);
  const [contracts, setContracts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [myRequests, setMyRequests] = useState<RebateRequest[]>([]);
  const [apiStats, setApiStats] = useState<{
    activeContracts: number; totalOrders: number; totalSpent: number; availableRebate: number; paidRebate: number;
    currentContracts: number; currentOrders: number; currentTotalSpent: number; currentEstimatedRebate: number;
    previousContracts: number; previousOrders: number; previousTotalSpent: number; previousUnpaidRebate: number; previousPaidRebate: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [redeemOpen, setRedeemOpen] = useState(false);
  const [redeemContract, setRedeemContract] = useState<any>(null);
  const [redeemNotes, setRedeemNotes] = useState("");
  const [redeemSubmitting, setRedeemSubmitting] = useState(false);
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();

  const ensureArray = <T,>(value: any): T[] => (Array.isArray(value) ? value : []);

  const loadData = useCallback(async () => {
    try {
      const currentUser = await User.me();
      setUser(currentUser);
      const isStaffUser = ['admin', 'manager', 'staff'].includes(currentUser.role || '');

      if (isStaffUser) {
        // Single aggregate query for stats + one page of recent orders — parallel
        const [stats, recentOrders] = await Promise.all([
          Order.getDashboardStats(),
          Order.list('-order_date', 1, 10),
        ]);
        setApiStats(stats);
        setOrders(ensureArray(recentOrders?.data));
        setContracts([]);
      } else {
        // Customer: stats + their contracts + recent orders + rebate requests — all parallel
        const [stats, contractsResp, recentOrders, requests] = await Promise.all([
          Order.getDashboardStats(),
          Contract.filter({ customer_id: currentUser.id }, undefined, 1, 100),
          Order.filter({ customer_id: currentUser.id }, '-order_date', 1, 10),
          Rebate.getMyRequests().catch(() => []),
        ]);
        setApiStats(stats);
        setContracts(ensureArray(contractsResp?.data));
        setOrders(ensureArray(recentOrders?.data));
        setMyRequests(ensureArray(requests));
      }
    } catch (error: any) {
      console.error("Error loading dashboard data:", error);
      const msg = error?.message || '';
      if (msg.toLowerCase().includes('session expired') || msg.toLowerCase().includes('authentication')) {
        navigate(createPageUrl("Home"));
      }
    }
    setLoading(false);
  }, [navigate]);

  useEffect(() => { loadData(); }, [loadData]);

  const stats = {
    availableRebate: apiStats?.availableRebate ?? 0,
    // current cycle
    currentContracts: apiStats?.currentContracts ?? 0,
    currentOrders: apiStats?.currentOrders ?? 0,
    currentTotalSpent: apiStats?.currentTotalSpent ?? 0,
    currentEstimatedRebate: apiStats?.currentEstimatedRebate ?? 0,
    // previous cycle
    previousContracts: apiStats?.previousContracts ?? 0,
    previousOrders: apiStats?.previousOrders ?? 0,
    previousTotalSpent: apiStats?.previousTotalSpent ?? 0,
    previousUnpaidRebate: apiStats?.previousUnpaidRebate ?? 0,
    previousPaidRebate: apiStats?.previousPaidRebate ?? 0,
  };
  const userRole = user?.role || 'user';
  const isStaff = ['admin', 'manager', 'staff'].includes(userRole);

  // Find a contract the customer can redeem (no pending request already)
  const redeemableContract = !isStaff
    ? contracts.find(c => {
        const hasPending = myRequests.some(r => r.contract_id === c.id && r.status === 'pending');
        return ['active', 'approved', 'expired'].includes(c.status) && !hasPending;
      })
    : null;
  const hasPendingRequest = myRequests.some(r => r.status === 'pending');

  const handleRedeemClick = () => {
    setRedeemContract(redeemableContract);
    setRedeemNotes("");
    setRedeemOpen(true);
  };

  const handleSubmitRedeem = async () => {
    if (!redeemContract) return;
    setRedeemSubmitting(true);
    try {
      await Rebate.requestRedemption(redeemContract.id, redeemNotes || undefined);
      showSuccess("Rebate redemption request submitted! Staff will process it shortly.", 6000);
      setRedeemOpen(false);
      loadData();
    } catch (error: any) {
      showError(error?.message || "Failed to submit request. Please try again.");
    } finally {
      setRedeemSubmitting(false);
    }
  };

  const activities = [
    ...ensureArray<any>(orders).slice(0, 5).map(order => ({
      id: order.id,
      type: 'order' as const,
      title: `Order #${order.order_number}`,
      description: `Total: Tsh ${parseFloat(String(order.total_amount || 0)).toFixed(2)}`,
      timestamp: order.order_date,
      status: order.customer_status,
    })),
    ...ensureArray<any>(contracts).slice(0, 3).map(contract => ({
      id: contract.id,
      type: 'contract' as const,
      title: `Contract #${contract.contract_number || contract.id}`,
      description: `Customer: ${contract.customer_name}`,
      timestamp: contract.created_date || new Date().toISOString(),
      status: contract.status,
    })),
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

        {/* Header */}
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
            <div className="flex items-center gap-3 flex-wrap">
              {stats.previousUnpaidRebate > 0 && !hasPendingRequest && redeemableContract && (
                <Button
                  onClick={handleRedeemClick}
                  className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 shadow-lg shadow-green-500/30"
                >
                  <Gift className="w-4 h-4 mr-2" />
                  Redeem Rebate
                </Button>
              )}
              {hasPendingRequest && (
                <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-900/20 px-3 py-1.5 text-sm">
                  <Clock className="w-3 h-3 mr-1.5" />
                  Redemption Pending
                </Badge>
              )}
              <Link to={createPageUrl("MyContracts")}>
                <Button variant="outline">
                  <FileText className="w-4 h-4 mr-2" />
                  View Contracts
                </Button>
              </Link>
            </div>
          )}
        </div>

        {/* Current cycle */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-1 h-5 rounded-full bg-blue-500" />
            <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Current Cycle <span className="normal-case font-normal text-slate-400 dark:text-slate-500">— ends Dec 31, 2026</span>
            </h2>
          </div>
          <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 ${isStaff ? 'lg:grid-cols-4' : 'lg:grid-cols-4'}`}>
            <StatsCard
              title={isStaff ? "Active Contracts" : "My Contract"}
              value={stats.currentContracts}
              icon={<FileText className="w-6 h-6 text-white" />}
            />
            <StatsCard
              title="Orders This Cycle"
              value={stats.currentOrders}
              icon={<ShoppingCart className="w-6 h-6 text-white" />}
            />
            <StatsCard
              title="Amount Spent"
              value={`Tsh ${stats.currentTotalSpent.toFixed(2)}`}
              icon={<DollarSign className="w-6 h-6 text-white" />}
            />
            <StatsCard
              title="Est. Rebate"
              value={`Tsh ${stats.currentEstimatedRebate.toFixed(2)}`}
              icon={<Wallet className="w-6 h-6 text-white" />}
              trend={stats.currentEstimatedRebate > 0 ? { value: 1, isPositive: true } : undefined}
            />
          </div>
        </div>

        {/* Previous cycle */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-1 h-5 rounded-full bg-slate-400" />
            <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Previous Cycle <span className="normal-case font-normal text-slate-400 dark:text-slate-500">— ended Jun 30, 2026</span>
            </h2>
          </div>
          <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 ${isStaff ? 'lg:grid-cols-5' : 'lg:grid-cols-4'}`}>
            {isStaff && (
              <StatsCard
                title="Expired Contracts"
                value={stats.previousContracts}
                icon={<FileText className="w-6 h-6 text-white" />}
              />
            )}
            <StatsCard
              title="Past Orders"
              value={stats.previousOrders}
              icon={<ShoppingCart className="w-6 h-6 text-white" />}
            />
            <StatsCard
              title="Past Spend"
              value={`Tsh ${stats.previousTotalSpent.toFixed(2)}`}
              icon={<DollarSign className="w-6 h-6 text-white" />}
            />
            <StatsCard
              title="Rebate Pending"
              value={`Tsh ${stats.previousUnpaidRebate.toFixed(2)}`}
              icon={<Wallet className="w-6 h-6 text-white" />}
              trend={stats.previousUnpaidRebate > 0 ? { value: Math.round((stats.previousUnpaidRebate / ((stats.previousUnpaidRebate + stats.previousPaidRebate) || 1)) * 100), isPositive: false } : undefined}
            />
            <StatsCard
              title="Rebate Paid"
              value={`Tsh ${stats.previousPaidRebate.toFixed(2)}`}
              icon={<CheckCircle className="w-6 h-6 text-white" />}
              trend={stats.previousPaidRebate > 0 ? { value: Math.round((stats.previousPaidRebate / ((stats.previousUnpaidRebate + stats.previousPaidRebate) || 1)) * 100), isPositive: true } : undefined}
            />
          </div>
        </div>

        {/* Pending redemption banner */}
        {!isStaff && hasPendingRequest && (
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 p-px shadow-lg shadow-amber-500/20">
            <div className="relative flex items-center gap-4 rounded-2xl bg-gradient-to-r from-amber-950/90 to-orange-950/90 px-5 py-4">
              {/* Animated pulse ring */}
              <div className="relative shrink-0">
                <span className="absolute inset-0 animate-ping rounded-full bg-amber-400 opacity-30" />
                <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/20 ring-1 ring-amber-400/40">
                  <Clock className="h-5 w-5 text-amber-300" />
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-amber-200 leading-snug">
                  Rebate redemption in progress
                </p>
                <p className="mt-0.5 text-xs text-amber-300/80 leading-relaxed">
                  Your request is being reviewed by staff. You'll be notified once it's processed.
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-amber-500/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-amber-300 ring-1 ring-amber-400/30">
                Pending
              </span>
            </div>
          </div>
        )}

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
                    <Button variant="outline" className="bg-white dark:bg-slate-800">Start Now</Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Redeem Rebate Dialog */}
      <Dialog open={redeemOpen} onOpenChange={setRedeemOpen}>
        <DialogContent className="max-w-lg p-0 overflow-hidden rounded-2xl gap-0 border-0 shadow-2xl">
          {/* Gradient header */}
          <div className="relative bg-gradient-to-br from-emerald-500 via-green-500 to-teal-600 px-6 pt-7 pb-6">
            <div className="flex items-start gap-4 mb-5">
              <div className="p-3 bg-white/20 backdrop-blur-sm rounded-2xl shrink-0">
                <Gift className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-emerald-100 text-[11px] font-semibold uppercase tracking-widest mb-0.5">
                  Rebate Redemption
                </p>
                <h2 className="text-xl font-bold text-white leading-tight">Redeem Your Rebate</h2>
                <p className="text-emerald-200 text-xs mt-1">
                  Contract #{redeemContract?.contract_number || redeemContract?.id?.slice(0, 8)}
                </p>
              </div>
            </div>

            {/* Amount display */}
            <div className="bg-white/15 backdrop-blur-sm border border-white/25 rounded-xl px-5 py-4">
              <p className="text-emerald-100 text-[11px] font-semibold uppercase tracking-widest mb-2">
                Available to redeem
              </p>
              <p className="text-4xl font-black text-white tracking-tight">
                Tsh {Number(stats.previousUnpaidRebate).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-emerald-200 text-xs mt-2 flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                All unpaid orders · 1% rebate rate
              </p>
            </div>
          </div>

          {/* Body */}
          <div className="px-6 pt-5 pb-6 bg-white dark:bg-slate-900 space-y-5">
            {/* Steps */}
            <div>
              <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">
                What happens next
              </p>
              <div className="space-y-3">
                {[
                  'Your request is sent to staff for review',
                  'Staff verifies and approves the rebate payment',
                  'Funds disbursed · contract marked complete',
                ].map((text, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400 text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{text}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="h-px bg-slate-100 dark:bg-slate-800" />

            {/* Notes */}
            <div>
              <label className="block text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2">
                Notes <span className="font-normal text-slate-400 dark:text-slate-500">— optional</span>
              </label>
              <Textarea
                placeholder="e.g. preferred payment method, account details, any special instructions…"
                value={redeemNotes}
                onChange={e => setRedeemNotes(e.target.value)}
                rows={3}
                className="resize-none text-sm bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 rounded-xl placeholder:text-slate-400 focus-visible:ring-emerald-500"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <Button
                variant="outline"
                onClick={() => setRedeemOpen(false)}
                disabled={redeemSubmitting}
                className="flex-1 h-11 rounded-xl border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmitRedeem}
                disabled={redeemSubmitting}
                className="flex-1 h-11 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-semibold shadow-lg shadow-emerald-500/25 border-0"
              >
                {redeemSubmitting
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting…</>
                  : <><Gift className="w-4 h-4 mr-2" />Submit Request</>
                }
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
