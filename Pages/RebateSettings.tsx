import React, { useState, useEffect, useCallback, useRef } from "react";
import { User } from "@/entities/User";
import { Rebate, CustomerRebateSearch, RebateRequest } from "@/entities/Rebate";
import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { Badge } from "@/Components/ui/badge";
import { Button } from "@/Components/ui/button";
import { Input } from "@/Components/ui/input";
import { Textarea } from "@/Components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/Components/ui/dialog";
import {
  Search,
  User as UserIcon,
  CreditCard,
  CheckCircle,
  Clock,
  XCircle,
  ChevronDown,
  ChevronUp,
  Loader2,
  Calculator,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useToast } from "@/Context/ToastContext";

function RebateStatusBadge({ status }: { status: string }) {
  if (status === 'approved') return (
    <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
      <CheckCircle className="w-3 h-3 mr-1" />Approved
    </Badge>
  );
  if (status === 'rejected') return (
    <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
      <XCircle className="w-3 h-3 mr-1" />Rejected
    </Badge>
  );
  return (
    <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
      <Clock className="w-3 h-3 mr-1" />Pending
    </Badge>
  );
}

export default function RebateSettings() {
  const [userRole, setUserRole] = useState<string>('staff');
  const [loading, setLoading] = useState(true);

  // Calculator — search
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<CustomerRebateSearch[]>([]);
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pending rebate requests
  const [pendingRequests, setPendingRequests] = useState<RebateRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);

  // Pay dialog (direct staff payment)
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [payTarget, setPayTarget] = useState<{ customer: CustomerRebateSearch; contractIdx: number } | null>(null);
  const [payNotes, setPayNotes] = useState("");
  const [paying, setPaying] = useState(false);

  // Approve/reject dialog
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [approveTarget, setApproveTarget] = useState<RebateRequest | null>(null);
  const [approveNotes, setApproveNotes] = useState("");
  const [approving, setApproving] = useState(false);
  const [rejectMode, setRejectMode] = useState(false);

  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();

  const loadRequests = useCallback(async () => {
    setRequestsLoading(true);
    try {
      const requests = await Rebate.listRequests('pending');
      setPendingRequests(Array.isArray(requests) ? requests : []);
    } catch {
      // non-critical
    } finally {
      setRequestsLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const user = await User.me();
        const role = user.role || 'user';
        if (!['admin', 'manager', 'staff'].includes(role)) {
          navigate(createPageUrl('Dashboard'));
          return;
        }
        setUserRole(role);
      } catch {
        navigate(createPageUrl('Dashboard'));
        return;
      } finally {
        setLoading(false);
      }
    })();
    loadRequests();
  }, [navigate, loadRequests]);

  // Debounced search
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (searchQuery.trim().length < 2) { setSearchResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await Rebate.searchCustomers(searchQuery.trim());
        setSearchResults(Array.isArray(results) ? results : []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [searchQuery]);

  const openPayDialog = (customer: CustomerRebateSearch, contractIdx: number) => {
    setPayTarget({ customer, contractIdx });
    setPayNotes("");
    setPayDialogOpen(true);
  };

  const handleDirectPay = async () => {
    if (!payTarget) return;
    const contract = payTarget.customer.contracts[payTarget.contractIdx];
    setPaying(true);
    try {
      // Get all orders for this contract, then pay them
      const calc = await Rebate.getCalculation(payTarget.customer.id, contract.id);
      const unpaidIds = calc.contracts
        .flatMap(c => c.orders)
        .filter(o => o.rebate_status !== 'paid')
        .map(o => o.id);
      if (unpaidIds.length === 0) {
        showError("No unpaid orders found for this contract.");
        return;
      }
      await Rebate.pay(unpaidIds, payNotes || undefined);
      showSuccess(`Rebate paid! ${unpaidIds.length} order(s) marked as paid.`, 5000);
      setPayDialogOpen(false);
      // Refresh search results
      if (searchQuery.trim().length >= 2) {
        const results = await Rebate.searchCustomers(searchQuery.trim());
        setSearchResults(Array.isArray(results) ? results : []);
      }
      loadRequests();
    } catch (error: any) {
      showError(error?.message || "Failed to pay rebate. Please try again.");
    } finally {
      setPaying(false);
    }
  };

  const openApproveDialog = (req: RebateRequest, isReject = false) => {
    setApproveTarget(req);
    setApproveNotes("");
    setRejectMode(isReject);
    setApproveDialogOpen(true);
  };

  const handleApproveOrReject = async () => {
    if (!approveTarget) return;
    setApproving(true);
    try {
      if (rejectMode) {
        await Rebate.rejectRequest(approveTarget.id, approveNotes || undefined);
        showSuccess("Rebate request rejected.");
      } else {
        await Rebate.approveRequest(approveTarget.id, approveNotes || undefined);
        showSuccess("Rebate approved and paid! Contract marked as expired.", 5000);
      }
      setApproveDialogOpen(false);
      loadRequests();
      // Refresh search if active
      if (searchQuery.trim().length >= 2) {
        const results = await Rebate.searchCustomers(searchQuery.trim());
        setSearchResults(Array.isArray(results) ? results : []);
      }
    } catch (error: any) {
      showError(error?.message || "Failed. Please try again.");
    } finally {
      setApproving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400" />
      </div>
    );
  }

  const payContract = payTarget ? payTarget.customer.contracts[payTarget.contractIdx] : null;

  return (
    <div className="min-h-screen p-6 md:p-8 bg-slate-50 dark:bg-slate-900">
      <div className="max-w-5xl mx-auto space-y-8">

        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-slate-100 mb-2 flex items-center gap-3">
            <Calculator className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            Rebate Calculator
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Search a customer to view their rebate breakdown and process payments
          </p>
        </div>

        {/* ─── Pending Redemption Requests ─── */}
        {pendingRequests.length > 0 && (
          <Card className="border-amber-200 dark:border-amber-800 dark:bg-slate-800">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="w-5 h-5 text-amber-500" />
                Pending Redemption Requests
                <Badge className="ml-1 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                  {pendingRequests.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {requestsLoading ? (
                <div className="flex items-center gap-2 text-slate-500 text-sm py-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading...
                </div>
              ) : (
                pendingRequests.map(req => (
                  <div key={req.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-amber-50 dark:bg-amber-900/10 rounded-lg border border-amber-200 dark:border-amber-800"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-slate-900 dark:text-slate-100 text-sm">
                          {req.customer_name}
                        </span>
                        <span className="text-slate-400 text-xs">{req.customer_email}</span>
                        <Badge variant="outline" className="text-xs">
                          Contract #{req.contract_number}
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                        Requested <strong className="text-green-700 dark:text-green-400">
                          Tsh {parseFloat(String(req.total_rebate_amount)).toFixed(2)}
                        </strong>
                        {' '}&bull;{' '}
                        {new Date(req.requested_at).toLocaleDateString()}
                      </p>
                      {req.customer_notes && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 italic">
                          "{req.customer_notes}"
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openApproveDialog(req, true)}
                        className="text-red-600 border-red-300 hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        <XCircle className="w-4 h-4 mr-1" />Reject
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => openApproveDialog(req, false)}
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />Approve & Pay
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        )}

        {/* ─── Customer Search ─── */}
        <Card className="dark:bg-slate-800 dark:border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Search className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              Customer Rebate Calculator
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search customer by name or email..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9"
              />
              {searching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 animate-spin" />
              )}
            </div>

            {searchQuery.trim().length > 0 && searchQuery.trim().length < 2 && (
              <p className="text-xs text-slate-500 dark:text-slate-400">Type at least 2 characters to search</p>
            )}

            {/* Search results */}
            {searchResults.length === 0 && searchQuery.trim().length >= 2 && !searching && (
              <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">No customers found</p>
            )}

            <div className="space-y-3">
              {searchResults.map(customer => (
                <div key={customer.id} className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                  {/* Customer header */}
                  <button
                    className="w-full flex items-center justify-between p-4 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-left"
                    onClick={() => setExpandedCustomer(expandedCustomer === customer.id ? null : customer.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                        <UserIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-900 dark:text-slate-100 text-sm">{customer.full_name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{customer.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right hidden sm:block">
                        <p className="text-xs text-slate-500">Total unpaid rebate</p>
                        <p className="font-semibold text-green-600 dark:text-green-400 text-sm">
                          Tsh {customer.contracts
                            .reduce((s, c) => s + parseFloat(String(c.unpaid_rebate || 0)), 0)
                            .toFixed(2)}
                        </p>
                      </div>
                      {expandedCustomer === customer.id
                        ? <ChevronUp className="w-4 h-4 text-slate-400" />
                        : <ChevronDown className="w-4 h-4 text-slate-400" />
                      }
                    </div>
                  </button>

                  {/* Expanded contracts */}
                  {expandedCustomer === customer.id && (
                    <div className="border-t border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700">
                      {customer.contracts.length === 0 ? (
                        <p className="text-sm text-slate-500 dark:text-slate-400 p-4">No contracts found</p>
                      ) : customer.contracts.map((contract, idx) => (
                        <div key={contract.id} className="p-4 bg-slate-50 dark:bg-slate-800/50">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                                  Contract #{contract.contract_number}
                                </span>
                                <Badge variant="outline" className={
                                  contract.status === 'active' || contract.status === 'approved'
                                    ? 'text-green-700 border-green-300'
                                    : contract.status === 'expired'
                                    ? 'text-slate-500 border-slate-300'
                                    : 'text-amber-600 border-amber-300'
                                }>
                                  {contract.status}
                                </Badge>
                                {contract.pending_request_id && (
                                  <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 text-xs">
                                    <Clock className="w-3 h-3 mr-1" />Redemption pending
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                {new Date(contract.start_date).toLocaleDateString()} – {new Date(contract.end_date).toLocaleDateString()}
                                {' '}&bull;{' '}{contract.order_count} order(s)
                              </p>
                              <div className="flex items-center gap-4 mt-2">
                                <span className="text-xs text-slate-500">
                                  Unpaid: <strong className="text-green-600 dark:text-green-400">
                                    Tsh {parseFloat(String(contract.unpaid_rebate || 0)).toFixed(2)}
                                  </strong>
                                </span>
                                <span className="text-xs text-slate-500">
                                  Paid: <strong className="text-slate-700 dark:text-slate-300">
                                    Tsh {parseFloat(String(contract.paid_rebate || 0)).toFixed(2)}
                                  </strong>
                                </span>
                              </div>
                            </div>
                            {parseFloat(String(contract.unpaid_rebate || 0)) > 0 && !contract.pending_request_id && (
                              <Button
                                size="sm"
                                onClick={() => openPayDialog(customer, idx)}
                                className="bg-green-600 hover:bg-green-700 text-white shrink-0"
                              >
                                <CreditCard className="w-4 h-4 mr-1.5" />
                                Pay Rebate
                              </Button>
                            )}
                            {parseFloat(String(contract.unpaid_rebate || 0)) === 0 && parseFloat(String(contract.paid_rebate || 0)) > 0 && (
                              <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 shrink-0">
                                <CheckCircle className="w-3 h-3 mr-1" />Fully Paid
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ─── Direct Pay Dialog ─── */}
      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-green-600" />
              Pay Rebate
            </DialogTitle>
          </DialogHeader>
          {payContract && payTarget && (
            <div className="space-y-4 py-2">
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">
                  Customer: <strong className="text-slate-900 dark:text-slate-100">{payTarget.customer.full_name}</strong>
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                  Contract: <strong>#{payContract.contract_number}</strong>
                </p>
                <p className="text-xs text-green-700 dark:text-green-400 mb-1">Total to pay</p>
                <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                  Tsh {parseFloat(String(payContract.unpaid_rebate || 0)).toFixed(2)}
                </p>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                This will mark all unpaid orders under this contract as paid and expire the contract.
              </p>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Payment notes (optional)
                </label>
                <Textarea
                  placeholder="Payment method, reference number, etc."
                  value={payNotes}
                  onChange={e => setPayNotes(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayDialogOpen(false)} disabled={paying}>
              Cancel
            </Button>
            <Button
              onClick={handleDirectPay}
              disabled={paying}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {paying
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing...</>
                : <><CreditCard className="w-4 h-4 mr-2" />Confirm Payment</>
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Approve / Reject Dialog ─── */}
      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {rejectMode
                ? <><XCircle className="w-5 h-5 text-red-600" />Reject Request</>
                : <><CheckCircle className="w-5 h-5 text-green-600" />Approve & Pay Rebate</>
              }
            </DialogTitle>
          </DialogHeader>
          {approveTarget && (
            <div className="space-y-4 py-2">
              <div className={`rounded-lg p-4 border ${rejectMode ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'}`}>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{approveTarget.customer_name}</p>
                <p className="text-xs text-slate-500 mt-0.5">Contract #{approveTarget.contract_number}</p>
                {!rejectMode && (
                  <>
                    <p className="text-xs text-green-700 dark:text-green-400 mt-2">Rebate amount</p>
                    <p className="text-xl font-bold text-green-700 dark:text-green-400">
                      Tsh {parseFloat(String(approveTarget.total_rebate_amount)).toFixed(2)}
                    </p>
                  </>
                )}
              </div>
              {approveTarget.customer_notes && (
                <p className="text-sm text-slate-600 dark:text-slate-400 italic">
                  Customer note: "{approveTarget.customer_notes}"
                </p>
              )}
              {!rejectMode && (
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Approving will mark all orders under this contract as paid and expire the contract.
                </p>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Staff notes (optional)
                </label>
                <Textarea
                  placeholder={rejectMode ? "Reason for rejection..." : "Payment notes..."}
                  value={approveNotes}
                  onChange={e => setApproveNotes(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveDialogOpen(false)} disabled={approving}>
              Cancel
            </Button>
            <Button
              onClick={handleApproveOrReject}
              disabled={approving}
              className={rejectMode
                ? "bg-red-600 hover:bg-red-700 text-white"
                : "bg-green-600 hover:bg-green-700 text-white"
              }
            >
              {approving
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing...</>
                : rejectMode
                ? <><XCircle className="w-4 h-4 mr-2" />Reject</>
                : <><CheckCircle className="w-4 h-4 mr-2" />Approve & Pay</>
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
