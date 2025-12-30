import React, { useState, useEffect } from "react";
import { Contract } from "@/entities/Contract";
import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { Button } from "@/Components/ui/button";
import { Input } from "@/Components/ui/input";
import { Badge } from "@/Components/ui/badge";
import { Search, FileText, Calendar, User, Mail, Eye, Edit, Percent, Trash2, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { ContractPreviewDialog, ManagerApprovalDialog } from "@/Components/contracts";
import { User as UserEntity } from "@/entities/User";
import { useToast } from "@/Context/ToastContext";

interface ContractsListProps {
  contracts: any[];
  onRefresh: () => void;
  onEdit: (contract: any) => void;
  currentUserRole?: string;
}

export default function ContractsList({ contracts, onRefresh, onEdit, currentUserRole }: ContractsListProps) {
  const { showSuccess, showError, showWarning } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedContract, setSelectedContract] = useState<any>(null);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [approvalContract, setApprovalContract] = useState<any>(null);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const canModify = currentUserRole === 'admin';
  const canApprove = ['admin', 'manager', 'staff'].includes(currentUserRole || '');

  // Load current user for approval
  React.useEffect(() => {
    const loadUser = async () => {
      try {
        const user = await UserEntity.me();
        setCurrentUser(user);
      } catch (error) {
        console.error("Error loading user:", error);
      }
    };
    if (canApprove) {
      loadUser();
    }
  }, [canApprove]);


  const filteredContracts = contracts.filter((contract: any) =>
    contract.contract_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    contract.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    contract.customer_email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-700">Active</Badge>;
      case 'approved':
        return <Badge className="bg-blue-100 text-blue-700">Approved</Badge>;
      case 'pending_approval':
        return <Badge className="bg-yellow-100 text-yellow-700">Pending Approval</Badge>;
      case 'pending':
        return <Badge className="bg-amber-100 text-amber-700">Pending</Badge>;
      case 'rejected':
        return <Badge className="bg-red-100 text-red-700">Rejected</Badge>;
      default:
        return <Badge className="bg-slate-100 text-slate-700">Unknown</Badge>;
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
    
    // Refresh contracts to get updated data with manager signature
    await onRefresh();
    
    // If we were viewing the same contract that was just approved, update it
    if (selectedContract && selectedContract.id === approvedContractId) {
      try {
        const updatedContracts = await Contract.list('-created_date');
        const updatedContract = updatedContracts.find((c: any) => c.id === approvedContractId);
        if (updatedContract) {
          setSelectedContract(updatedContract);
        }
      } catch (error) {
        console.error("Error refreshing contract:", error);
      }
    }
  };

  const handleViewDetails = async (contract: any) => {
    // Fetch the latest contract data to ensure we have manager signature if it was just approved
    try {
      const updatedContract = await Contract.list('-created_date');
      const latestContract = updatedContract.find((c: any) => c.id === contract.id);
      setSelectedContract(latestContract || contract);
    } catch (error) {
      console.error("Error fetching contract:", error);
      setSelectedContract(contract);
    }
    setShowPreviewDialog(true);
  };

  const handleClosePreview = () => {
    setShowPreviewDialog(false);
    setSelectedContract(null);
  };

  const handleDelete = async (contractId: string) => {
    if (currentUserRole !== 'admin') {
      showWarning("Only admins can delete contracts.");
      return;
    }
    if (window.confirm("Are you sure you want to delete this contract?")) {
      try {
        await Contract.delete(contractId);
        showSuccess("Contract deleted successfully.");
        onRefresh();
      } catch (error) {
        console.error("Error deleting contract:", error);
        showError("Failed to delete contract. Please try again.");
      }
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <CardTitle>All Contracts</CardTitle>
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
        </CardHeader>
        <CardContent>
          {filteredContracts.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              No contracts found
            </div>
          ) : (
            <div className="space-y-4">
              {filteredContracts.map((contract: any) => (
                <div
                  key={contract.id}
                  className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors gap-4"
                >
                  <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30 flex-shrink-0">
                      <FileText className="w-6 h-6 text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <p className="font-bold text-slate-900 truncate">{contract.contract_number}</p>
                        {getStatusBadge(contract.status)}
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-sm text-slate-600">
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
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full md:w-auto">
                    <div className="text-left sm:text-right w-full sm:w-auto">
                      <div className="flex items-center gap-1 text-sm text-slate-600">
                        <Calendar className="w-3 h-3 flex-shrink-0" />
                        <span>
                          {contract.start_date && format(new Date(contract.start_date), 'MMM d, yyyy')} → 
                          {contract.end_date && format(new Date(contract.end_date), 'MMM d, yyyy')}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                      {contract.status === 'pending_approval' && canApprove && (
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

      {/* Contract Preview Dialog */}
      <ContractPreviewDialog
        open={showPreviewDialog}
        onClose={handleClosePreview}
        onUpload={() => { /* No upload action when viewing existing contract */ }}
        user={null}
        contractData={selectedContract}
      />

      {/* Manager Approval Dialog */}
      {approvalContract && (
        <ManagerApprovalDialog
          open={showApprovalDialog}
          onClose={() => {
            setShowApprovalDialog(false);
            setApprovalContract(null);
          }}
          onSuccess={handleApprovalSuccess}
          contract={approvalContract}
          currentUser={currentUser}
        />
      )}
    </>
  );
}
