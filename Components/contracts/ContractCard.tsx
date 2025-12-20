import React, { useState } from "react";
import { Card, CardContent } from "@/Components/ui/card";
import { Badge } from "@/Components/ui/badge";
import { Button } from "@/Components/ui/button";
import { FileText, Calendar, CheckCircle, Clock, AlertCircle, Eye } from "lucide-react";
import { format } from "date-fns";
import { ContractPreviewDialog } from "./index";

export default function ContractCard({ contract }) {
  const [showPreview, setShowPreview] = useState(false);

  const handleClosePreview = () => {
    setShowPreview(false);
  };

  const getStatusIcon = () => {
    switch (contract.status) {
      case 'active':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-amber-600" />;
      case 'expired':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      default:
        return <Clock className="w-4 h-4 text-slate-600" />;
    }
  };

  const getStatusBadge = () => {
    switch (contract.status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-700">Active</Badge>;
      case 'pending':
        return <Badge className="bg-amber-100 text-amber-700">Pending</Badge>;
      case 'expired':
        return <Badge className="bg-red-100 text-red-700">Expired</Badge>;
      default:
        return <Badge className="bg-slate-100 text-slate-700">Unknown</Badge>;
    }
  };

  return (
    <Card className="border-0 shadow-xl hover:shadow-2xl transition-shadow duration-300">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="font-bold text-slate-900 text-lg">
                {contract.contract_number}
              </p>
              <div className="flex items-center gap-2 mt-1">
                {getStatusIcon()}
                {getStatusBadge()}
              </div>
            </div>
          </div>
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

        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Calendar className="w-4 h-4" />
            <span>
              {format(new Date(contract.start_date), 'MMM d, yyyy')} - {format(new Date(contract.end_date), 'MMM d, yyyy')}
            </span>
          </div>
          
          <div className="p-3 bg-slate-50 rounded-lg">
            <p className="text-xs text-slate-600 mb-1">Rebate Percentage</p>
            <p className="font-bold text-slate-900 text-lg">1%</p>
          </div>
        </div>
      </CardContent>

      {/* Contract Preview Dialog - Shows both customer and manager signatures */}
      <ContractPreviewDialog
        open={showPreview}
        onClose={handleClosePreview}
        onUpload={() => {}}
        user={null}
        contractData={contract}
      />
    </Card>
  );
}
