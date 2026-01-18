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
  ResponsiveContainer,
  BarChart,
  Bar
} from 'recharts';
import { format, parseISO } from 'date-fns';

interface RevenueChartProps {
  data: Array<{
    date: string;
    orderCount: number;
    customerCount: number;
    totalRevenue: number;
    totalRebate: number;
    avgOrderValue: number;
  }>;
  totals: {
    totalOrders: number;
    totalCustomers: number;
    totalRevenue: number;
    totalRebate: number;
  };
}

export default function RevenueChart({ data, totals }: RevenueChartProps) {
  const chartData = data.map(item => ({
    ...item,
    date: format(parseISO(item.date), 'MMM d'),
    revenue: item.totalRevenue,
    rebate: item.totalRebate,
  })).reverse(); // Reverse to show oldest to newest

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Total Revenue</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              Tsh {totals.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Total Orders</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{totals.totalOrders}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Total Customers</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{totals.totalCustomers}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Total Rebate</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              Tsh {totals.totalRebate.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Line Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
              <XAxis 
                dataKey="date" 
                className="text-xs"
                stroke="#64748b"
              />
              <YAxis 
                className="text-xs"
                stroke="#64748b"
                tickFormatter={(value) => `Tsh ${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px'
                }}
                formatter={(value: number) => [`Tsh ${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 'Revenue']}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="revenue" 
                stroke="#3b82f6" 
                strokeWidth={2}
                name="Revenue"
                dot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Revenue and Rebate Bar Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue vs Rebate</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
              <XAxis 
                dataKey="date" 
                className="text-xs"
                stroke="#64748b"
              />
              <YAxis 
                className="text-xs"
                stroke="#64748b"
                tickFormatter={(value) => `Tsh ${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px'
                }}
                formatter={(value: number) => [`Tsh ${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, '']}
              />
              <Legend />
              <Bar dataKey="revenue" fill="#3b82f6" name="Revenue" />
              <Bar dataKey="rebate" fill="#10b981" name="Rebate" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
