import React, { useState, useEffect } from "react";
import { Order } from "@/entities/Order";
import { Admin } from "@/entities/Admin";
import { Card, CardContent } from "@/Components/ui/card";
import { Badge } from "@/Components/ui/badge";
import { Button } from "@/Components/ui/button";
import { Textarea } from "@/Components/ui/textarea";
import { ShoppingCart, Calendar, DollarSign, Package, CheckCircle, Clock, XCircle, MessageSquare, AlertTriangle, Lock } from "lucide-react";
import { format, addMonths, isAfter, differenceInDays, addDays } from "date-fns";
import { useToast } from "@/Context/ToastContext";
import { OrderType } from "@/entities/Order";

interface OrderCardProps {
  order: OrderType;
  onRefresh: () => void;
}

export default function OrderCard({ order, onRefresh }: OrderCardProps) {
  const { showSuccess, showError, showWarning } = useToast();
  const [confirming, setConfirming] = useState(false);
  const [comment, setComment] = useState(order.customer_comment || "");
  const [showComment, setShowComment] = useState(false);
  const [autoLockDays, setAutoLockDays] = useState<number>(3); // Default to 3 days

  // Fetch auto-lock days setting
  useEffect(() => {
    const fetchAutoLockDays = async () => {
      try {
        const settingValue = await Admin.getSetting('auto_lock_days');
        if (settingValue) {
          const days = parseInt(settingValue, 10);
          if (!isNaN(days) && days > 0) {
            setAutoLockDays(days);
          }
        }
      } catch (error) {
        console.error('Error fetching auto_lock_days setting:', error);
        // Keep default value of 3
      }
    };
    fetchAutoLockDays();
  }, []);

  const eligibleDate = addMonths(new Date(order.order_date), 6);
  const isEligible = isAfter(new Date(), eligibleDate);
  
  // Calculate days since order creation and lock status using configured auto_lock_days
  const orderDate = new Date(order.order_date);
  const daysSinceOrder = differenceInDays(new Date(), orderDate);
  const lockDeadline = addDays(orderDate, autoLockDays);
  const daysUntilLock = differenceInDays(lockDeadline, new Date());
  
  // Use backend status for locking
  const isLocked = !!order.is_locked;
  // Show reminder 3 days before the auto-lock deadline (when daysUntilLock is between 1 and 3)
  const shouldShowReminder = order.customer_status === 'pending' && !isLocked && daysUntilLock <= 3 && daysUntilLock > 0;

  const handleConfirm = async (status: 'confirmed' | 'disputed') => {
    if (isLocked) {
      showWarning("This order is locked. Please visit the office for assistance.");
      return;
    }
    
    setConfirming(true);
    try {
      await Order.update(order.id, {
        customer_status: status,
        customer_comment: comment || null
      });
      
      // If disputed, notify staff/admin/manager (this will be handled on backend)
      if (status === 'disputed') {
        showSuccess("Your dispute has been submitted. Staff will review and take action.", 6000);
      } else {
        showSuccess("Order confirmed successfully!", 5000);
      }
      // Refresh order data to get latest status
      await onRefresh();
    } catch (error: any) {
      console.error("Error updating order:", error);
      // Check if error is due to locked order
      if (error?.message?.includes('locked') || error?.response?.data?.error?.includes('locked')) {
        showWarning("This order is locked. Please refresh the page or contact support for assistance.");
        // Refresh to get latest order status
        await onRefresh();
      } else {
        showError(error?.response?.data?.error || "Failed to update order status. Please try again.");
      }
    }
    setConfirming(false);
  };

  const getStatusBadge = () => {
    switch (order.customer_status) {
      case 'confirmed':
        return (
          <Badge className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
            <CheckCircle className="w-3 h-3 mr-1" />
            Confirmed
          </Badge>
        );
      case 'disputed':
        return (
          <Badge className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
            <XCircle className="w-3 h-3 mr-1" />
            Disputed
          </Badge>
        );
      default:
        return (
          <Badge className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
            <Clock className="w-3 h-3 mr-1" />
            Awaiting Confirmation
          </Badge>
        );
    }
  };

  return (
    <Card className="border-0 shadow-xl hover:shadow-2xl transition-shadow duration-300 dark:bg-slate-800 dark:border-slate-700">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/30">
              <ShoppingCart className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="font-bold text-slate-900 dark:text-slate-100 text-lg">
                Order #{order.order_number}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <Calendar className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {format(new Date(order.order_date), 'MMM d, yyyy')}
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            {getStatusBadge()}
            <Badge
              variant="secondary"
              className={isEligible ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300'}
            >
              {isEligible ? 'Rebate Ready' : 'Rebate Pending'}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Order Total</p>
            <p className="font-bold text-slate-900 dark:text-slate-100 text-lg">
              Tsh {parseFloat(String(order.total_amount || 0)).toFixed(2)}
            </p>
          </div>
          <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <p className="text-xs text-green-700 dark:text-green-400 mb-1">Rebate (1%)</p>
            <p className="font-bold text-green-700 dark:text-green-400 text-lg">
              Tsh {parseFloat(String(order.rebate_amount || 0)).toFixed(2)}
            </p>
          </div>
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <p className="text-xs text-blue-700 dark:text-blue-400 mb-1">Items</p>
            <p className="font-bold text-blue-700 dark:text-blue-400 text-lg">
              {order.items?.length || 0}
            </p>
          </div>
        </div>

        {!isEligible && (
          <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg mb-4">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              <Clock className="w-4 h-4 inline mr-2" />
              Rebate available on {format(eligibleDate, 'MMMM d, yyyy')}
            </p>
          </div>
        )}

        {isLocked && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border-2 border-red-300 dark:border-red-700 rounded-lg mb-4">
            <div className="flex items-start gap-3">
              <Lock className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-900 dark:text-red-100 mb-1">
                  Order Locked
                </p>
                <p className="text-sm text-red-800 dark:text-red-200">
                  This order has been locked because it was not confirmed within {autoLockDays} day{autoLockDays !== 1 ? 's' : ''}. Please visit the office for further assistance.
                </p>
                {order.locked_date && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                    Locked on: {format(new Date(order.locked_date), 'MMM d, yyyy')}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {shouldShowReminder && (
          <div className="p-4 bg-orange-50 dark:bg-orange-900/20 border-2 border-orange-300 dark:border-orange-700 rounded-lg mb-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-orange-900 dark:text-orange-100 mb-1">
                  Reminder: Confirm Your Order
                </p>
                <p className="text-sm text-orange-800 dark:text-orange-200">
                  {daysUntilLock === 1 
                    ? "You have 1 day left to confirm this order. After that, it will be locked and you'll need to visit the office for assistance."
                    : `You have ${daysUntilLock} days left to confirm this order. After that, it will be locked and you'll need to visit the office for assistance.`}
                </p>
                <p className="text-xs text-orange-700 dark:text-orange-300 mt-2">
                  Deadline: {format(lockDeadline, 'MMMM d, yyyy')}
                </p>
              </div>
            </div>
          </div>
        )}

        {order.items && order.items.length > 0 && (
          <div className="mb-4 pt-4 border-t border-slate-100 dark:border-slate-700">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">Order Items</p>
            <div className="space-y-2">
              {order.items.map((item: any, index: number) => (
                <div key={index} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                    <span className="text-slate-900 dark:text-slate-100">{item.product_name}</span>
                    <span className="text-slate-500 dark:text-slate-400">x{item.quantity}</span>
                  </div>
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    Tsh {parseFloat(String(item.total_price || 0)).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {order.customer_status === 'pending' && !isLocked && (
          <div className="pt-4 border-t border-slate-100 dark:border-slate-700 space-y-3">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Confirm Order Details</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Please review the order details above and confirm they are correct, or dispute if there are any issues.
            </p>
            
            {showComment && (
              <Textarea
                placeholder="Add a comment (optional for confirmation, required for dispute)..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="min-h-20"
              />
            )}
            
            {!showComment && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowComment(true)}
                className="w-full"
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                Add Comment
              </Button>
            )}
            
            <div className="flex gap-3">
              <Button
                onClick={() => handleConfirm('confirmed')}
                disabled={confirming}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Confirm Order
              </Button>
              <Button
                onClick={() => {
                  if (!comment && !showComment) {
                    setShowComment(true);
                    return;
                  }
                  if (!comment) {
                    showWarning("Please add a comment explaining the issue");
                    return;
                  }
                  handleConfirm('disputed');
                }}
                disabled={confirming}
                variant="destructive"
                className="flex-1"
              >
                <XCircle className="w-4 h-4 mr-2" />
                Dispute Order
              </Button>
            </div>
          </div>
        )}

        {order.customer_status !== 'pending' && order.customer_comment && (
          <div className="pt-4 border-t border-slate-100 dark:border-slate-700">
            <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Customer Comment</p>
              </div>
              <p className="text-sm text-slate-700 dark:text-slate-300">{order.customer_comment}</p>
              {order.customer_confirmed_date && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                  {format(new Date(order.customer_confirmed_date), 'MMM d, yyyy \'at\' h:mm a')}
                </p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
