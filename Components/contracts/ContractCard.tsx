import React, { useState } from "react";
import { Card, CardContent } from "@/Components/ui/card";
import { Badge } from "@/Components/ui/badge";
import { Button } from "@/Components/ui/button";
import { FileText, Calendar, CheckCircle, Clock, AlertCircle, Eye, RefreshCw, XCircle, Ban } from "lucide-react";
import { format } from "date-fns";
import { ContractPreviewDialog } from "./index";

interface ContractCardProps {
  contract: any;
  onRenew?: () => void;
}

export default function ContractCard({ contract, onRenew }: ContractCardProps) {
  const [showPreview, setShowPreview] = useState(false);

  const getStatusIcon = () => {
    switch (contract.status) {
      case 'active':
        return <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />;
      case 'approved':
        return <CheckCircle className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
      case 'pending':
      case 'pending_approval':
        return <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
      case 'expired':
        return <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />;
      case 'cancelled':
        return <Ban className="w-4 h-4 text-slate-500 dark:text-slate-400" />;
      case 'rejected':
        return <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />;
      default:
        return <Clock className="w-4 h-4 text-slate-600 dark:text-slate-400" />;
    }
  };

  const getStatusBadge = () => {
    switch (contract.status) {
      case 'active':
        return <Badge className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">Active</Badge>;
      case 'approved':
        return <Badge className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">Approved</Badge>;
      case 'pending_approval':
        return <Badge className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300">Pending Approval</Badge>;
      case 'pending':
        return <Badge className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">Pending</Badge>;
      case 'expired':
        return <Badge className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">Expired</Badge>;
      case 'cancelled':
        return <Badge className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">Cancelled</Badge>;
      case 'rejected':
        return <Badge className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">Rejected</Badge>;
      default:
        return <Badge className="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">Unknown</Badge>;
    }
  };

  return (
    <Card className="border-0 shadow-xl hover:shadow-2xl transition-shadow duration-300 dark:bg-slate-800 dark:border-slate-700">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="font-bold text-slate-900 dark:text-slate-100 text-lg">
                {contract.contract_number}
              </p>
              {contract.renewal_count > 0 && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Renewal #{contract.renewal_count}
                </p>
              )}
              <div className="flex items-center gap-2 mt-1">
                {getStatusIcon()}
                {getStatusBadge()}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {contract.status === 'expired' && onRenew && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRenew}
                className="flex items-center gap-2 border-green-300 text-green-700 hover:bg-green-50 dark:border-green-700 dark:text-green-400 dark:hover:bg-green-900/20"
              >
                <RefreshCw className="w-4 h-4" />
                Renew
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPreview(true)}
              className="flex items-center gap-2"
            >
              <Eye className="w-4 h-4" />
              View
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <Calendar className="w-4 h-4" />
            <span>
              {contract.start_date && format(new Date(contract.start_date), 'MMM d, yyyy')}
              {contract.end_date && ` — ${format(new Date(contract.end_date), 'MMM d, yyyy')}`}
            </span>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Rebate Percentage</p>
            <p className="font-bold text-slate-900 dark:text-slate-100 text-lg">
              {contract.rebate_percentage ?? 1}%
            </p>
          </div>

          {contract.status === 'expired' && (
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-700">
              <p className="text-xs text-amber-700 dark:text-amber-400">
                This contract has expired. {onRenew ? 'Click "Renew" to start a new 6-month contract.' : 'Contact staff to renew.'}
              </p>
            </div>
          )}
        </div>
      </CardContent>

      <ContractPreviewDialog
        open={showPreview}
        onClose={() => setShowPreview(false)}
        onUpload={() => {}}
        user={null}
        contractData={contract}
      />
    </Card>
  );
}
