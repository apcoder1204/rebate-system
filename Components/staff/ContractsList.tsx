import React, { useState } from "react";
import { Contract } from "@/entities/Contract";
import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { Button } from "@/Components/ui/button";
import { Input } from "@/Components/ui/input";
import { Badge } from "@/Components/ui/badge";
import { Search, FileText, Calendar, User, Mail, Eye, Edit, Percent, Trash2, CheckCircle, RefreshCw, CreditCard } from "lucide-react";
import { format } from "date-fns";
import { ContractPreviewDialog, ManagerApprovalDialog } from "@/Components/contracts";
import { User as UserEntity } from "@/entities/User";
import { useToast } from "@/Context/ToastContext";

interface ContractsListProps {
  contracts: any[];
  onRefresh: () => void;
  onEdit: (contract: any) => void;
  currentUserRole?: string;
  onPayRebate?: (contract: any) => void;
}

const CURRENT_STATUSES = ['active', 'approved', 'pending_approval', 'pending'];
const EXPIRED_STATUSES = ['expired', 'rejected', 'cancelled'];

export default function ContractsList({ contracts, onRefresh, onEdit, currentUserRole, onPayRebate }: ContractsListProps) {
  const { showSuccess, showError, showWarning } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [tab, setTab] = useState<'current' | 'expired' | 'all'>('current');
  const [selectedContract, setSelectedContract] = useState<any>(null);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [approvalContract, setApprovalContract] = useState<any>(null);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const canApprove = ['admin', 'manager', 'staff'].includes(currentUserRole || '');
  const canModify = ['admin', 'manager'].includes(currentUserRole || '');
  const canPayRebate = ['admin', 'manager', 'staff'].includes(currentUserRole || '');

  React.useEffect(() => {
    if (canApprove) {
      UserEntity.me().then(setCurrentUser).catch(console.error);
    }
  }, [canApprove]);

  const safeContracts = Array.isArray(contracts) ? contracts : [];

  const currentCount = safeContracts.filter(c => CURRENT_STATUSES.includes(c.status)).length;
  const expiredCount = safeContracts.filter(c => EXPIRED_STATUSES.includes(c.status)).length;

  const filteredContracts = safeContracts.filter((contract: any) => {
    const matchesTab =
      tab === 'all' ||
      (tab === 'current' && CURRENT_STATUSES.includes(contract.status)) ||
      (tab === 'expired' && EXPIRED_STATUSES.includes(contract.status));
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      contract.contract_number?.toLowerCase().includes(q) ||
      contract.customer_name?.toLowerCase().includes(q) ||
      contract.customer_email?.toLowerCase().includes(q);
    return matchesTab && matchesSearch;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">Active</Badge>;
      case 'approved':
        return <Badge className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">Approved</Badge>;
      case 'pending_approval':
        return <Badge className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300">Pending Approval</Badge>;
      case 'pending':
        return <Badge className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">Pending</Badge>;
      case 'expired':
        return <Badge className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">Expired</Badge>;
      case 'rejected':
        return <Badge className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">Rejected</Badge>;
      case 'cancelled':
        return <Badge className="bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300">Cancelled</Badge>;
      default:
        return <Badge className="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">{status}</Badge>;
    }
  };

  const handleApprove = (contract: any) => {
    setApprovalContract(contract);
    setShowApprovalDialog(true);
  };

  const handleApprovalSuccess = async () => {
    setShowApprovalDialog(false);
    const approvedContractId = approvalContract?.id;
    setApprovalContract(null);
    await onRefresh();
    if (selectedContract && selectedContract.id === approvedContractId) {
      try {
        const resp = await Contract.list('-created_date');
        const updated = (resp?.data || []).find((c: any) => c.id === approvedContractId);
        if (updated) setSelectedContract(updated);
      } catch {}
    }
  };

  const handleViewDetails = async (contract: any) => {
    try {
      const resp = await Contract.list('-created_date');
      const latest = (resp?.data || []).find((c: any) => c.id === contract.id);
      setSelectedContract(latest || contract);
    } catch {
      setSelectedContract(contract);
    }
    setShowPreviewDialog(true);
  };

  const handleDelete = async (contractId: string) => {
    if (currentUserRole !== 'admin') { showWarning("Only admins can delete contracts."); return; }
    if (window.confirm("Are you sure you want to delete this contract?")) {
      try {
        await Contract.delete(contractId);
        showSuccess("Contract deleted successfully.");
        onRefresh();
      } catch (error) {
        showError("Failed to delete contract. Please try again.");
      }
    }
  };

  const handleRenew = async (contract: any) => {
    if (window.confirm(`Renew contract ${contract.contract_number} for ${contract.customer_name}?\n\nA new contract will be created carrying forward all signatures, valid until the program cycle end date (December 31, 2026). You can then approve it with one click.`)) {
      try {
        await Contract.renew(contract.id);
        showSuccess(`Renewal created for ${contract.customer_name}. Use "Approve Renewal" to activate it.`);
        onRefresh();
      } catch (error: any) {
        showError(error?.message || "Failed to renew contract.");
      }
    }
  };

  const handleApproveRenewal = async (contract: any) => {
    if (window.confirm(`Approve renewal ${contract.contract_number} for ${contract.customer_name}?\n\nThis activates the contract immediately. No new signature is required.`)) {
      try {
        await Contract.approveRenewal(contract.id);
        showSuccess(`Renewal ${contract.contract_number} is now active.`);
        onRefresh();
      } catch (error: any) {
        showError(error?.message || "Failed to approve renewal.");
      }
    }
  };

  const TabBtn = ({ value, label, count }: { value: typeof tab; label: string; count: number }) => (
    <button
      onClick={() => setTab(value)}
      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
        tab === value
          ? 'bg-blue-600 text-white'
          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
      }`}
    >
      {label}
      <span className={`ml-2 px-1.5 py-0.5 text-xs rounded-full ${
        tab === value ? 'bg-blue-500 text-white' : 'bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300'
      }`}>
        {count}
      </span>
    </button>
  );

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <CardTitle>Contracts</CardTitle>
              <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <Input
                  placeholder="Search contracts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex items-center gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg w-fit">
              <TabBtn value="current" label="Current" count={currentCount} />
              <TabBtn value="expired" label="Expired" count={expiredCount} />
              <TabBtn value="all" label="All" count={safeContracts.length} />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredContracts.length === 0 ? (
            <div className="text-center py-8 text-slate-500 dark:text-slate-400">
              No {tab !== 'all' ? tab : ''} contracts found
            </div>
          ) : (
            <div className="space-y-4">
              {filteredContracts.map((contract: any) => (
                <div
                  key={contract.id}
                  className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors gap-4"
                >
                  <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0 ${
                      EXPIRED_STATUSES.includes(contract.status)
                        ? 'bg-gradient-to-br from-slate-400 to-slate-500 shadow-slate-400/30'
                        : 'bg-gradient-to-br from-blue-500 to-blue-600 shadow-blue-500/30'
                    }`}>
                      <FileText className="w-6 h-6 text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <p className="font-bold text-slate-900 dark:text-slate-100 truncate">{contract.contract_number}</p>
                        {getStatusBadge(contract.status)}
                        {contract.renewed_from_id && (
                          <Badge className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs">
                            Renewal
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-sm text-slate-600 dark:text-slate-400">
                        <div className="flex items-center gap-1 truncate">
                          <User className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{contract.customer_name}</span>
                        </div>
                        <div className="flex items-center gap-1 truncate">
                          <Mail className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{contract.customer_email}</span>
                        </div>
                        {contract.rebate_percentage && (
                          <div className="flex items-center gap-1">
                            <Percent className="w-3 h-3 flex-shrink-0" />
                            <span>{contract.rebate_percentage}%</span>
                          </div>
                        )}
                        {(['admin', 'manager', 'staff'].includes(currentUserRole || '') && contract.creator_name) && (
                          <span className="text-xs text-slate-500 dark:text-slate-400">Created by: {contract.creator_name}</span>
                        )}
                        {(['admin', 'manager'].includes(currentUserRole || '') && contract.approver_name) && (
                          <span className="text-xs text-green-600 dark:text-green-400">Approved by: {contract.approver_name}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full md:w-auto">
                    <div className="text-left sm:text-right w-full sm:w-auto">
                      <div className="flex items-center gap-1 text-sm text-slate-600 dark:text-slate-400">
                        <Calendar className="w-3 h-3 flex-shrink-0" />
                        <span>
                          {contract.start_date && format(new Date(contract.start_date), 'MMM d, yyyy')} →{' '}
                          {contract.end_date && format(new Date(contract.end_date), 'MMM d, yyyy')}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                      {/* New contract approval (not a renewal) */}
                      {contract.status === 'pending_approval' && !contract.renewed_from_id && canApprove && (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleApprove(contract)}
                          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 flex-1 sm:flex-none"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Approve
                        </Button>
                      )}
                      {/* Renewal approval — works for both pending and pending_approval */}
                      {contract.renewed_from_id && ['pending', 'pending_approval'].includes(contract.status) && canApprove && (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleApproveRenewal(contract)}
                          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 flex-1 sm:flex-none"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Approve Renewal
                        </Button>
                      )}
                      {onEdit && canModify && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onEdit(contract)}
                          className="flex items-center gap-2 flex-1 sm:flex-none"
                        >
                          <Edit className="w-4 h-4" />
                          Edit
                        </Button>
                      )}
                      {contract.status === 'expired' && canPayRebate && onPayRebate && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onPayRebate(contract)}
                          className="flex items-center gap-2 flex-1 sm:flex-none border-green-300 text-green-700 hover:bg-green-50 dark:border-green-700 dark:text-green-400 dark:hover:bg-green-900/20"
                        >
                          <CreditCard className="w-4 h-4" />
                          Pay Rebate
                        </Button>
                      )}
                      {contract.status === 'expired' && !contract.renewed_from_id && canModify && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRenew(contract)}
                          className="flex items-center gap-2 flex-1 sm:flex-none border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-400 dark:hover:bg-blue-900/20"
                        >
                          <RefreshCw className="w-4 h-4" />
                          Renew
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewDetails(contract)}
                        className="flex items-center gap-2 flex-1 sm:flex-none"
                      >
                        <Eye className="w-4 h-4" />
                        View
                      </Button>
                      {currentUserRole === 'admin' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(contract.id)}
                          className="flex items-center gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 flex-1 sm:flex-none"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ContractPreviewDialog
        open={showPreviewDialog}
        onClose={() => { setShowPreviewDialog(false); setSelectedContract(null); }}
        onUpload={() => {}}
        user={null}
        contractData={selectedContract}
      />

      {approvalContract && (
        <ManagerApprovalDialog
          open={showApprovalDialog}
          onClose={() => { setShowApprovalDialog(false); setApprovalContract(null); }}
          onSuccess={handleApprovalSuccess}
          contract={approvalContract}
          currentUser={currentUser}
        />
      )}
    </>
  );
}
