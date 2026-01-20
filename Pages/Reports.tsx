import React, { useState, useEffect } from 'react';
import { Admin } from '@/entities/Admin';
import { User } from '@/entities/User';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/card';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { Label } from '@/Components/ui/label';
import { Calendar, Download, TrendingUp, DollarSign } from 'lucide-react';
import { format, subDays, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { createPageUrl } from '@/utils';
import { useNavigate } from 'react-router-dom';
import RevenueChart from '@/Components/reports/RevenueChart';
import OrderTrendsChart from '@/Components/reports/OrderTrendsChart';

export default function Reports() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [revenueData, setRevenueData] = useState<any>(null);
  const [orderTrendsData, setOrderTrendsData] = useState<any>(null);
  const [summaryStats, setSummaryStats] = useState<any>(null);
  const [startDate, setStartDate] = useState<string>(format(subMonths(new Date(), 1), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [groupBy, setGroupBy] = useState<'day' | 'week' | 'month'>('day');
  const navigate = useNavigate();

  useEffect(() => {
    const loadUser = async () => {
      try {
        const user = await User.me();
        setCurrentUser(user);
        
        if (!['admin', 'manager'].includes(user.role || '')) {
          navigate(createPageUrl('Dashboard'));
          return;
        }
        
        await loadReports();
      } catch (error) {
        console.error('Error loading user:', error);
        navigate(createPageUrl('Home'));
      }
    };
    
    loadUser();
  }, [navigate]);

  const loadReports = async () => {
    try {
      setLoading(true);
      setError(null);
      const [revenue, trends, summary] = await Promise.all([
        Admin.getRevenueReport(startDate, endDate),
        Admin.getOrderTrends(startDate, endDate, groupBy),
        Admin.getSummaryStats(startDate, endDate)
      ]);
      
      setRevenueData(revenue);
      setOrderTrendsData(trends);
      setSummaryStats(summary);
    } catch (error: any) {
      console.error('Error loading reports:', error);
      setError(error.message || 'Failed to load reports');
      setRevenueData(null);
      setOrderTrendsData(null);
      setSummaryStats(null);
    } finally {
      setLoading(false);
    }
  };

  const handleDateRangeChange = (range: '7d' | '30d' | '90d' | '1y' | 'custom') => {
    const today = new Date();
    let newStartDate: string;
    
    switch (range) {
      case '7d':
        newStartDate = format(subDays(today, 7), 'yyyy-MM-dd');
        break;
      case '30d':
        newStartDate = format(subDays(today, 30), 'yyyy-MM-dd');
        break;
      case '90d':
        newStartDate = format(subDays(today, 90), 'yyyy-MM-dd');
        break;
      case '1y':
        newStartDate = format(subMonths(today, 12), 'yyyy-MM-dd');
        break;
      default:
        return;
    }
    
    setStartDate(newStartDate);
    setEndDate(format(today, 'yyyy-MM-dd'));
  };

  useEffect(() => {
    if (currentUser) {
      loadReports();
    }
  }, [startDate, endDate, groupBy, currentUser]);

  if (loading || !currentUser) {
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
              Reports & Analytics
            </h1>
            <p className="text-slate-600 dark:text-slate-400">
              View revenue trends, order statistics, and customer insights
            </p>
          </div>
        </div>

        {error && (
          <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-900/20">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <div className="text-red-600 dark:text-red-400 font-semibold">Error:</div>
                <p className="text-red-700 dark:text-red-300">{error}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Date Range Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filter Options</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4 items-end">
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="start-date" className="mb-2 block">Start Date</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
                <div>
                  <Label htmlFor="end-date" className="mb-2 block">End Date</Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>
              <div className="w-full md:w-48">
                <Label htmlFor="group-by" className="mb-2 block">Group By</Label>
                <select
                  id="group-by"
                  value={groupBy}
                  onChange={(e) => setGroupBy(e.target.value as 'day' | 'week' | 'month')}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="day">Day</option>
                  <option value="week">Week</option>
                  <option value="month">Month</option>
                </select>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDateRangeChange('7d')}
                  className="dark:border-slate-600 dark:text-slate-300"
                >
                  7 Days
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDateRangeChange('30d')}
                  className="dark:border-slate-600 dark:text-slate-300"
                >
                  30 Days
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDateRangeChange('90d')}
                  className="dark:border-slate-600 dark:text-slate-300"
                >
                  90 Days
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Stats */}
        {summaryStats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                    <DollarSign className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Total Revenue</p>
                    <p className="text-xl font-bold text-slate-900 dark:text-slate-100">
                      Tsh {summaryStats.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                    <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Total Orders</p>
                    <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{summaryStats.totalOrders}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                    <TrendingUp className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Confirmed Orders</p>
                    <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{summaryStats.confirmedOrders}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                    <TrendingUp className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Total Rebate</p>
                    <p className="text-xl font-bold text-green-600 dark:text-green-400">
                      Tsh {summaryStats.totalRebate.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Revenue Charts */}
        {revenueData && (
          <RevenueChart data={revenueData.data} totals={revenueData.totals} />
        )}

        {/* Order Trends Charts */}
        {orderTrendsData && (
          <OrderTrendsChart data={orderTrendsData.data} groupBy={orderTrendsData.groupBy} />
        )}
      </div>
    </div>
  );
}
