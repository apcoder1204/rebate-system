import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/card';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { format, parseISO } from 'date-fns';

interface OrderTrendsChartProps {
  data: Array<{
    period: string;
    orderCount: number;
    uniqueCustomers: number;
    pendingCount: number;
    confirmedCount: number;
    disputedCount: number;
    totalAmount: number;
    totalRebate: number;
  }>;
  groupBy: 'day' | 'week' | 'month';
}

export default function OrderTrendsChart({ data, groupBy }: OrderTrendsChartProps) {
  const formatPeriod = (period: string) => {
    const date = parseISO(period);
    switch (groupBy) {
      case 'month':
        return format(date, 'MMM yyyy');
      case 'week':
        return format(date, 'MMM d');
      default:
        return format(date, 'MMM d');
    }
  };

  const chartData = data.map(item => ({
    ...item,
    period: formatPeriod(item.period),
    orders: item.orderCount,
    pending: item.pendingCount,
    confirmed: item.confirmedCount,
    disputed: item.disputedCount,
  })).reverse(); // Reverse to show oldest to newest

  return (
    <div className="space-y-6">
      {/* Order Status Trends */}
      <Card>
        <CardHeader>
          <CardTitle>Order Status Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
              <XAxis 
                dataKey="period" 
                className="text-xs"
                stroke="#64748b"
              />
              <YAxis 
                className="text-xs"
                stroke="#64748b"
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px'
                }}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="pending" 
                stroke="#f59e0b" 
                strokeWidth={2}
                name="Pending"
                dot={{ r: 4 }}
              />
              <Line 
                type="monotone" 
                dataKey="confirmed" 
                stroke="#10b981" 
                strokeWidth={2}
                name="Confirmed"
                dot={{ r: 4 }}
              />
              <Line 
                type="monotone" 
                dataKey="disputed" 
                stroke="#ef4444" 
                strokeWidth={2}
                name="Disputed"
                dot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Total Orders Trend */}
      <Card>
        <CardHeader>
          <CardTitle>Total Orders Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
              <XAxis 
                dataKey="period" 
                className="text-xs"
                stroke="#64748b"
              />
              <YAxis 
                className="text-xs"
                stroke="#64748b"
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px'
                }}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="orders" 
                stroke="#3b82f6" 
                strokeWidth={2}
                name="Total Orders"
                dot={{ r: 4 }}
              />
              <Line 
                type="monotone" 
                dataKey="uniqueCustomers" 
                stroke="#8b5cf6" 
                strokeWidth={2}
                name="Unique Customers"
                dot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
