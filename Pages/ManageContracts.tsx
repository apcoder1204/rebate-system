
import React, { useState, useEffect, useCallback } from "react";
import { Contract } from "@/entities/Contract";
import { User } from "@/entities/User";
import { Button } from "@/Components/ui/button";
import { Plus } from "lucide-react";
import { createPageUrl } from "@/utils";
import { useNavigate } from "react-router-dom";

import ContractsList from "@/Components/staff/ContractsList";
import CreateContractDialog from "@/Components/staff/CreateContractDialog";

export default function ManageContracts() {
  const [contracts, setContracts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingContract, setEditingContract] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const navigate = useNavigate();

  const loadData = useCallback(async () => {
    try {
      const user = await User.me();
      const userRole = user.role || 'user';
      if (!['admin', 'manager', 'staff'].includes(userRole)) {
        navigate(createPageUrl('Dashboard'));
        return;
      }
      setCurrentUserRole(userRole);
      const allContracts = await Contract.list('-created_date');
      const allUsers = await User.list();
      const customerUsers = allUsers.filter(u => !['admin', 'manager', 'staff'].includes(u.role || 'user'));
      
      setContracts(allContracts);
      setCustomers(customerUsers);
    } catch (error) {
      console.error("Error loading contracts:", error);
      navigate(createPageUrl('Home'));
    }
    setLoading(false);
  }, [navigate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
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
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-slate-100 mb-2">Manage Contracts</h1>
            <p className="text-slate-600 dark:text-slate-400">Oversee all customer rebate contracts</p>
          </div>
          {/* Create Contract button hidden for all roles as requested */}
        </div>

        <ContractsList 
          contracts={contracts} 
          onRefresh={loadData}
          currentUserRole={currentUserRole || undefined}
          onEdit={(contract) => {
            setEditingContract(contract);
            setShowCreateDialog(true);
          }}
        />

        <CreateContractDialog
          open={showCreateDialog}
          onClose={() => {
            setShowCreateDialog(false);
            setEditingContract(null);
          }}
          onSuccess={() => {
            loadData();
            setEditingContract(null);
          }}
          customers={customers}
          editingContract={editingContract}
        />
      </div>
    </div>
  );
}
