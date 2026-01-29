
import React, { useState, useEffect, useCallback } from "react";
import { Contract, ContractFilters } from "@/entities/Contract";
import { User } from "@/entities/User";
import { Button } from "@/Components/ui/button";
import { Plus, Download } from "lucide-react";
import { createPageUrl } from "@/utils";
import { useNavigate } from "react-router-dom";
import { Pagination } from "@/Components/ui/pagination";
import { Card } from "@/Components/ui/card";

import ContractsList from "@/Components/staff/ContractsList";
import CreateContractDialog from "@/Components/staff/CreateContractDialog";

export default function ManageContracts() {
  const [contracts, setContracts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingContract, setEditingContract] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const navigate = useNavigate();

  const loadContracts = useCallback(async (currentPage?: number, currentPageSize?: number) => {
    try {
      setError(null);
      const response = await Contract.list('-created_date', undefined, currentPage || page, currentPageSize || pageSize);
      const data = Array.isArray(response?.data) ? response.data : [];
      const pagination = response?.pagination || {
        page: currentPage || page,
        pageSize: currentPageSize || pageSize,
        total: data.length,
        totalPages: data.length === 0 ? 0 : Math.max(1, Math.ceil(data.length / (currentPageSize || pageSize))),
      };

      // Ensure totalPages is at least 1 if there's data
      const safeTotalPages = pagination.total > 0 && pagination.totalPages === 0 
        ? Math.max(1, Math.ceil(pagination.total / pagination.pageSize))
        : pagination.totalPages;

      setContracts(data as never[]);
      setTotal(pagination.total || 0);
      setTotalPages(safeTotalPages || 0);
      setPage(pagination.page || (currentPage || page));
      setPageSize(pagination.pageSize || (currentPageSize || pageSize));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load contracts';
      setError(errorMessage);
      console.error("Error loading contracts:", error);
    }
  }, [page, pageSize]);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);
      const user = await User.me();
      const userRole = user.role || 'user';
      if (!['admin', 'manager', 'staff'].includes(userRole)) {
        navigate(createPageUrl('Dashboard'));
        return;
      }
      setCurrentUserRole(userRole);
      const allUsersResponse = await User.list();
      const customerUsers = allUsersResponse.data.filter(u => !['admin', 'manager', 'staff'].includes(u.role || 'user'));
      
      setCustomers(customerUsers);
      await loadContracts(page, pageSize);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load data';
      setError(errorMessage);
      console.error("Error loading data:", error);
      navigate(createPageUrl('Home'));
    } finally {
      setLoading(false);
    }
  }, [navigate, page, pageSize, loadContracts]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    loadContracts(page, pageSize);
  }, [page, pageSize, loadContracts]);

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
        {error && (
          <Card className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
            <div className="p-4">
              <p className="text-red-800 dark:text-red-200">{error}</p>
              <button
                onClick={() => loadData()}
                className="mt-2 text-sm text-red-700 dark:text-red-300 underline hover:no-underline"
              >
                Try Again
              </button>
            </div>
          </Card>
        )}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-slate-100 mb-2">Manage Contracts</h1>
            <p className="text-slate-600 dark:text-slate-400">Oversee all customer rebate contracts</p>
          </div>
          <Button 
            variant="outline" 
            onClick={async () => {
              try {
                const blob = await Contract.exportCSV();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `contracts_${new Date().toISOString().split('T')[0]}.csv`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
              } catch (error) {
                console.error('Export failed:', error);
                alert('Failed to export contracts. Please try again.');
              }
            }}
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>

        <ContractsList 
          contracts={contracts} 
          onRefresh={() => {
            setPage(1);
            loadContracts(1, pageSize);
          }}
          currentUserRole={currentUserRole || undefined}
          onEdit={(contract) => {
            setEditingContract(contract);
            setShowCreateDialog(true);
          }}
        />

        {total > 0 && (
          <Card>
            <Pagination
              page={page}
              pageSize={pageSize}
              total={total}
              totalPages={totalPages > 0 ? totalPages : Math.max(1, Math.ceil(total / pageSize))}
              onPageChange={(newPage) => {
                setPage(newPage);
                loadContracts(newPage, pageSize);
              }}
              onPageSizeChange={(newPageSize) => {
                setPageSize(newPageSize);
                setPage(1);
                loadContracts(1, newPageSize);
              }}
            />
          </Card>
        )}

        <CreateContractDialog
          open={showCreateDialog}
          onClose={() => {
            setShowCreateDialog(false);
            setEditingContract(null);
          }}
          onSuccess={() => {
            setPage(1);
            loadContracts(1, pageSize);
            setEditingContract(null);
          }}
          customers={customers}
          editingContract={editingContract}
        />
      </div>
    </div>
  );
}
