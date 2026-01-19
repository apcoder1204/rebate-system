import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { Badge } from "@/Components/ui/badge";
import { FileText, ShoppingCart, User, Clock } from "lucide-react";
import { format } from "date-fns";

interface ActivityItem {
  id: string;
  type: 'contract' | 'order' | 'user';
  title: string;
  description: string;
  timestamp: string;
  status?: string;
}

interface RecentActivityProps {
  activities?: ActivityItem[];
}

export default function RecentActivity({ activities }: RecentActivityProps) {
  const safeActivities = Array.isArray(activities) ? activities : [];

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'contract':
        return <FileText className="w-4 h-4 text-blue-600" />;
      case 'order':
        return <ShoppingCart className="w-4 h-4 text-green-600" />;
      case 'user':
        return <User className="w-4 h-4 text-purple-600" />;
      default:
        return <Clock className="w-4 h-4 text-slate-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-700">Active</Badge>;
      case 'pending':
        return <Badge className="bg-amber-100 text-amber-700">Pending</Badge>;
      case 'completed':
        return <Badge className="bg-blue-100 text-blue-700">Completed</Badge>;
      default:
        return null;
    }
  };

  return (
    <Card className="border-0 shadow-lg bg-white dark:bg-slate-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        {safeActivities.length === 0 ? (
          <div className="text-center py-8 text-slate-500 dark:text-slate-400">
            <Clock className="w-12 h-12 mx-auto mb-4 text-slate-300 dark:text-slate-600" />
            <p>No recent activity</p>
          </div>
        ) : (
          <div className="space-y-4">
            {safeActivities.map((activity) => (
              <div key={activity.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                <div className="w-8 h-8 bg-slate-100 dark:bg-slate-700 rounded-lg flex items-center justify-center flex-shrink-0">
                  {getActivityIcon(activity.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium text-slate-900 dark:text-slate-100 truncate">{activity.title}</p>
                    {activity.status && getStatusBadge(activity.status)}
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">{activity.description}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-500">
                    {format(new Date(activity.timestamp), 'MMM d, yyyy \'at\' h:mm a')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
