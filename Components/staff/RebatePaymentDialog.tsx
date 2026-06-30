import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/Components/ui/dialog";
import { Button } from "@/Components/ui/button";
import { Badge } from "@/Components/ui/badge";
import { Rebate, RebateContractGroup } from "@/entities/Rebate";
import { useToast } from "@/Context/ToastContext";
import { CreditCard, CheckCircle, AlertCircle } from "lucide-react";
import { format } from "date-fns";

interface RebatePaymentDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  customerId: string;
  contractId: string;
  customerName?: string;
  contractNumber?: string;
}

export default function RebatePaymentDialog({
  open,
  onClose,
  onSuccess,
  customerId,
  contractId,
  customerName,
  contractNumber,
}: RebatePaymentDialogProps) {
  const { showSuccess, showError } = useToast();
  const [loading, setLoading] = useState(false);
  const [paying, setPaying] = useState(false);
  const [paymentNotes, setPaymentNotes] = useState("");
  const [group, setGroup] = useState<RebateContractGroup | null>(null);

  useEffect(() => {
    if (open && customerId && contractId) {
      setLoading(true);
      setPaymentNotes("");
      Rebate.getCalculation(customerId, contractId)
        .then((data) => {
          setGroup(data.contracts[0] ?? null);
        })
        .catch(() => showError("Failed to load rebate details."))
        .finally(() => setLoading(false));
    }
  }, [open, customerId, contractId]);

  const unpaidOrders = group?.orders.filter((o) => o.rebate_status !== 'paid') ?? [];
  const unpaidTotal = group?.unpaid_rebate_amount ?? 0;
  const allPaid = group && group.orders.length > 0 && unpaidOrders.length === 0;

  const handlePay = async () => {
    if (unpaidOrders.length === 0) return;
    setPaying(true);
    try {
      const result = await Rebate.pay(unpaidOrders.map((o) => o.id), paymentNotes || undefined);
      showSuccess(`Rebate paid! Tsh ${result.total_paid.toFixed(2)} for ${result.order_count} order(s).`, 6000);
      onSuccess();
      onClose();
    } catch (error: any) {
      showError(error?.message || "Failed to process rebate payment.");
    } finally {
      setPaying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-green-600" />
            Pay Rebate — {contractNumber || 'Contract'}
          </DialogTitle>
          {customerName && (
            <p className="text-sm text-slate-500 dark:text-slate-400">Customer: {customerName}</p>
          )}
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
          </div>
        ) : !group ? (
          <p className="text-center text-slate-500 py-8">No rebate data found.</p>
        ) : (
          <div className="space-y-4">
            {/* Summary box */}
            {allPaid ? (
              <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-700">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                <p className="text-green-700 dark:text-green-300 font-medium">
                  Rebate for this contract has already been fully paid.
                </p>
              </div>
            ) : (
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
                <p className="text-xs text-blue-600 dark:text-blue-400 mb-1">Total Unpaid Rebate</p>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                  Tsh {unpaidTotal.toFixed(2)}
                </p>
                <p className="text-xs text-blue-500 dark:text-blue-400 mt-1">
                  {unpaidOrders.length} order(s) to be paid
                </p>
              </div>
            )}

            {/* Orders table */}
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800">
                  <tr>
                    <th className="text-left p-3 font-medium text-slate-600 dark:text-slate-400">Order #</th>
                    <th className="text-left p-3 font-medium text-slate-600 dark:text-slate-400">Date</th>
                    <th className="text-right p-3 font-medium text-slate-600 dark:text-slate-400">Amount</th>
                    <th className="text-right p-3 font-medium text-slate-600 dark:text-slate-400">Rebate</th>
                    <th className="text-left p-3 font-medium text-slate-600 dark:text-slate-400">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {group.orders.map((order) => (
                    <tr key={order.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="p-3 font-mono text-xs text-slate-700 dark:text-slate-300">{order.order_number}</td>
                      <td className="p-3 text-slate-600 dark:text-slate-400">
                        {format(new Date(order.order_date), 'MMM d, yyyy')}
                      </td>
                      <td className="p-3 text-right text-slate-700 dark:text-slate-300">
                        Tsh {parseFloat(String(order.total_amount)).toFixed(2)}
                      </td>
                      <td className="p-3 text-right font-medium text-blue-700 dark:text-blue-300">
                        Tsh {parseFloat(String(order.rebate_amount)).toFixed(2)}
                      </td>
                      <td className="p-3">
                        {order.rebate_status === 'paid' ? (
                          <Badge className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                            Paid
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                            Unpaid
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Payment notes */}
            {!allPaid && (
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Payment Notes (optional)
                </label>
                <textarea
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="e.g. Payment via bank transfer ref #12345"
                  rows={2}
                  maxLength={500}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            {/* Action buttons */}
            <div className="flex justify-end gap-3 pt-2 border-t border-slate-200 dark:border-slate-700">
              <Button variant="outline" onClick={onClose} disabled={paying}>
                {allPaid ? 'Close' : 'Cancel'}
              </Button>
              {!allPaid && (
                <Button
                  onClick={handlePay}
                  disabled={paying || unpaidOrders.length === 0}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  {paying ? 'Processing…' : `Confirm Payment — Tsh ${unpaidTotal.toFixed(2)}`}
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
