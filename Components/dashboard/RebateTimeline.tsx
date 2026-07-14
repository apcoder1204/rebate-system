import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { Badge } from "@/Components/ui/badge";
import { Calendar, DollarSign, Clock, CheckCircle } from "lucide-react";
import { format } from "date-fns";

interface RebateTimelineProps {
  orders?: Array<{
    id: string;
    order_number: string;
    order_date: string;
    total_amount: number;
    rebate_amount: number;
    customer_status: string;
    contract_status?: string;
    rebate_status?: string;
  }>;
}

export default function RebateTimeline({ orders }: RebateTimelineProps) {
  const safeOrders = Array.isArray(orders) ? orders : [];

  const getRebateStatus = (order: any) => {
    const contractExpired = order.contract_status === 'expired';
    if (contractExpired && order.rebate_status === 'paid') {
      return { status: 'paid', label: 'Rebate Paid', color: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' };
    }
    if (contractExpired) {
      return { status: 'pending_payment', label: 'Pending Payment', color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' };
    }
    if (order.customer_status === 'disputed') {
      return { status: 'disputed', label: 'Disputed', color: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' };
    }
    return { status: 'in_progress', label: 'In Progress', color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' };
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid':
        return <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />;
      case 'pending_payment':
        return <DollarSign className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
      case 'disputed':
        return <Clock className="w-4 h-4 text-red-600 dark:text-red-400" />;
      default:
        return <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
    }
  };

  return (
    <Card className="border-0 shadow-lg bg-white dark:bg-slate-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          Rebate Timeline
        </CardTitle>
      </CardHeader>
      <CardContent>
        {safeOrders.length === 0 ? (
          <div className="text-center py-8 text-slate-500 dark:text-slate-400">
            <Calendar className="w-12 h-12 mx-auto mb-4 text-slate-300 dark:text-slate-600" />
            <p>No orders found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {safeOrders.slice(0, 5).map((order) => {
              const rebateStatus = getRebateStatus(order);
              return (
                <div key={order.id} className="flex items-center gap-4 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                  <div className="w-8 h-8 bg-slate-100 dark:bg-slate-700 rounded-lg flex items-center justify-center flex-shrink-0">
                    {getStatusIcon(rebateStatus.status)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-slate-900 dark:text-slate-100">Order #{order.order_number}</p>
                      <Badge className={rebateStatus.color}>{rebateStatus.label}</Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-400">
                      <span>{format(new Date(order.order_date), 'MMM d, yyyy')}</span>
                      <span>Tsh {parseFloat(String(order.total_amount || 0)).toFixed(2)}</span>
                      <span className="text-green-600 dark:text-green-400">+Tsh {parseFloat(String(order.rebate_amount || 0)).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
