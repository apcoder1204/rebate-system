import React, { useState, useEffect, useCallback } from "react";
import { User, UserType } from "@/entities/User";
import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { Badge } from "@/Components/ui/badge";
import { Input } from "@/Components/ui/input";
import { Button } from "@/Components/ui/button";
import { 
  Search, 
  Users as UsersIcon, 
  Shield, 
  User as UserIcon,
  CheckCircle,
  XCircle,
  AlertCircle,
  Settings,
  Trash2
} from "lucide-react";
import { format } from "date-fns";
import { createPageUrl } from "@/utils";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/Context/ToastContext";

export default function ManageUsers() {
  const { showSuccess, showError, showWarning } = useToast();
  const [activeTab, setActiveTab] = useState<'users' | 'requests'>('users');
  const [users, setUsers] = useState<UserType[]>([]);
  const [roleRequests, setRoleRequests] = useState<any[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserType[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<UserType | null>(null);
  const [editingRole, setEditingRole] = useState<{userId: string, newRole: string} | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const navigate = useNavigate();

  const loadData = useCallback(async () => {
    try {
      const user = await User.me();
      setCurrentUser(user);
      
      // Only admin and manager can access this page
      if (!['admin', 'manager'].includes(user.role || '')) {
        navigate(createPageUrl('Dashboard'));
        return;
      }
      
      const allUsers = await User.list();
      setUsers(allUsers);
      setFilteredUsers(allUsers);
      
      // Load role requests if admin or manager
      if (['admin', 'manager'].includes(user.role || '')) {
        try {
          const requests = await User.getRoleRequests('pending');
          setRoleRequests(requests);
        } catch (err) {
          console.error("Error loading role requests:", err);
        }
      }
    } catch (error) {
      console.error("Error loading users:", error);
      navigate(createPageUrl('Home'));
    }
    setLoading(false);
  }, [navigate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (searchQuery) {
      const filtered = users.filter(user =>
        user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredUsers(filtered);
    } else {
      setFilteredUsers(users);
    }
  }, [searchQuery, users]);

  const handleRoleChange = async (userId: string, newRole: string) => {
    setError(null);
    setEditingRole({ userId, newRole });
    
    try {
      // Check if trying to demote the last admin
      if (newRole !== 'admin') {
        const userToChange = users.find(u => u.id === userId);
        if (userToChange?.role === 'admin') {
          const adminCount = users.filter(u => u.role === 'admin').length;
          if (adminCount <= 1) {
            setError('Cannot remove the last admin. Please promote another user to admin first.');
            setEditingRole(null);
            return;
          }
        }
      }
      
      await User.updateUserRole(userId, newRole);
      await loadData(); // Reload data
      setEditingRole(null);
      showSuccess('User role updated successfully!');
    } catch (error: any) {
      setError(error.message || 'Failed to update user role');
      setEditingRole(null);
    }
  };

  const handleReviewRequest = async (requestId: string, action: 'approve' | 'reject') => {
    setError(null);
    
    try {
      await User.reviewRoleRequest(requestId, action);
      await loadData(); // Reload data
      showSuccess(`Role request ${action}d successfully!`);
    } catch (error: any) {
      setError(error.message || `Failed to ${action} role request`);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!isAdmin) {
      setError('Only admins can delete users');
      return;
    }

    if (userId === currentUser?.id) {
      setError('You cannot delete your own account');
      return;
    }

    const userToDelete = users.find(u => u.id === userId);
    if (userToDelete?.role === 'admin' && stats.admins <= 1) {
      setError('Cannot delete the last admin. Promote another admin first.');
      return;
    }

    const confirmed = window.confirm('Are you sure you want to delete this user? This action cannot be undone.');
    if (!confirmed) return;

    setDeletingUserId(userId);
    setError(null);
    try {
      await User.delete(userId);
      await loadData();
    } catch (error: any) {
      setError(error.message || 'Failed to delete user');
    }
    setDeletingUserId(null);
  };

  const getRoleStats = () => {
    const admins = users.filter(u => u.role === 'admin').length;
    const managers = users.filter(u => u.role === 'manager').length;
    const staff = users.filter(u => u.role === 'staff').length;
    const customers = users.filter(u => !['admin', 'manager', 'staff'].includes(u.role || 'user')).length;
    return { admins, managers, staff, customers };
  };

  const stats = getRoleStats();
  const isAdmin = currentUser?.role === 'admin';

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
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-slate-100 mb-2">Manage Users</h1>
          <p className="text-slate-600 dark:text-slate-400">View and manage system users and role requests</p>
        </div>

        {/* Error Message */}
        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-red-800">
                <AlertCircle className="w-5 h-5" />
                <p>{error}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="bg-gradient-to-br from-red-500 to-red-600 text-white border-0 shadow-xl">
            <CardContent className="p-6">
              <Shield className="w-8 h-8 mb-3 opacity-80" />
              <p className="text-red-100 text-sm mb-1">Administrators</p>
              <p className="text-3xl font-bold">{stats.admins}</p>
              {stats.admins === 1 && (
                <p className="text-xs text-red-200 mt-2">⚠️ Last admin</p>
              )}
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white border-0 shadow-xl">
            <CardContent className="p-6">
              <Shield className="w-8 h-8 mb-3 opacity-80" />
              <p className="text-purple-100 text-sm mb-1">Managers</p>
              <p className="text-3xl font-bold">{stats.managers}</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-500 to-amber-600 text-white border-0 shadow-xl">
            <CardContent className="p-6">
              <UsersIcon className="w-8 h-8 mb-3 opacity-80" />
              <p className="text-amber-100 text-sm mb-1">Staff</p>
              <p className="text-3xl font-bold">{stats.staff}</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white border-0 shadow-xl">
            <CardContent className="p-6">
              <UserIcon className="w-8 h-8 mb-3 opacity-80" />
              <p className="text-green-100 text-sm mb-1">Customers</p>
              <p className="text-3xl font-bold">{stats.customers}</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-slate-200">
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'users'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Users ({users.length})
          </button>
          {['admin', 'manager'].includes(currentUser?.role || '') && (
            <button
              onClick={() => setActiveTab('requests')}
              className={`px-4 py-2 font-medium transition-colors relative ${
                activeTab === 'requests'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Role Requests ({roleRequests.length})
              {roleRequests.length > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {roleRequests.length}
                </span>
              )}
            </button>
          )}
        </div>

        {/* Users Tab */}
        {activeTab === 'users' && (
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <CardTitle>All Users</CardTitle>
                <div className="relative w-full md:w-64">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <Input
                    placeholder="Search users..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredUsers.map((user) => {
                  const userRole = user.role || 'user';
                  let badgeColor = 'bg-blue-100 text-blue-700';
                  if (userRole === 'admin') badgeColor = 'bg-red-100 text-red-700';
                  else if (userRole === 'manager') badgeColor = 'bg-purple-100 text-purple-700';
                  else if (userRole === 'staff') badgeColor = 'bg-amber-100 text-amber-700';
                  
                  const isLastAdmin = userRole === 'admin' && stats.admins === 1;
                  const canChangeRole = isAdmin && !isLastAdmin; // Only show button if not last admin
                  const isEditing = editingRole?.userId === user.id;
                  const canDelete = isAdmin && user.id !== currentUser?.id && !(userRole === 'admin' && stats.admins === 1);
                  
                  return (
                    <div
                      key={user.id}
                      className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors gap-4"
                    >
                      <div className="flex items-center gap-4 w-full md:w-auto">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-white font-semibold">
                            {user.full_name?.charAt(0) || 'U'}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 truncate">{user.full_name}</p>
                          <p className="text-sm text-slate-600 truncate">{user.email}</p>
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full md:w-auto">
                        {isEditing ? (
                          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full">
                            <select
                              value={editingRole?.newRole || userRole}
                              onChange={(e) => setEditingRole({ userId: user.id, newRole: e.target.value })}
                              className="px-3 py-1 border border-slate-300 rounded-md text-sm w-full sm:w-auto"
                              disabled={!isAdmin}
                            >
                              <option value="user">Customer</option>
                              <option value="staff">Staff</option>
                              <option value="manager">Manager</option>
                              <option value="admin">Admin</option>
                            </select>
                            <div className="flex gap-2 w-full sm:w-auto">
                              <Button
                                size="sm"
                                onClick={() => handleRoleChange(user.id, editingRole!.newRole)}
                                disabled={editingRole?.newRole === userRole}
                                className="flex-1 sm:flex-none"
                              >
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setEditingRole(null)}
                                className="flex-1 sm:flex-none"
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-start md:justify-end">
                            <Badge variant="secondary" className={`${badgeColor} mr-2`}>
                              {userRole === 'user' ? 'customer' : userRole}
                            </Badge>
                            <div className="flex items-center gap-2 flex-wrap">
                              {canChangeRole && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setEditingRole({ userId: user.id, newRole: userRole })}
                                >
                                  <Settings className="w-4 h-4 mr-1" />
                                  Change Role
                                </Button>
                              )}
                              {canDelete && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleDeleteUser(user.id)}
                                  disabled={deletingUserId === user.id}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  <Trash2 className="w-4 h-4 mr-1" />
                                  {deletingUserId === user.id ? 'Deleting...' : 'Delete'}
                                </Button>
                              )}
                              {isLastAdmin && (
                                <span className="text-xs text-slate-500 italic" title="Cannot change role of last admin">
                                  Last Admin
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                        <p className="text-sm text-slate-500 whitespace-nowrap hidden md:block">
                          {user.created_date ? format(new Date(user.created_date), 'MMM d, yyyy') : 'N/A'}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Role Requests Tab */}
        {activeTab === 'requests' && (
          <Card>
            <CardHeader>
              <CardTitle>Pending Role Requests</CardTitle>
            </CardHeader>
            <CardContent>
              {roleRequests.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4 opacity-50" />
                  <p className="text-slate-600">No pending role requests</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {roleRequests.map((request: any) => {
                    const roleColors: Record<string, string> = {
                      admin: 'bg-red-100 text-red-700',
                      manager: 'bg-purple-100 text-purple-700',
                      staff: 'bg-amber-100 text-amber-700',
                    };
                    
                    return (
                      <div
                        key={request.id}
                        className="p-4 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex flex-col md:flex-row items-start justify-between gap-4">
                          <div className="flex-1 w-full">
                            <div className="flex items-center gap-3 mb-2">
                              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full flex items-center justify-center flex-shrink-0">
                                <span className="text-white font-semibold text-sm">
                                  {request.user_name?.charAt(0) || 'U'}
                                </span>
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold text-slate-900 truncate">{request.user_name}</p>
                                <p className="text-sm text-slate-600 truncate">{request.user_email}</p>
                              </div>
                            </div>
                            <div className="ml-0 md:ml-13 space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-slate-600">Requested Role:</span>
                                <Badge className={roleColors[request.requested_role] || 'bg-blue-100 text-blue-700'}>
                                  {request.requested_role}
                                </Badge>
                              </div>
                              <p className="text-xs text-slate-500">
                                Requested on {format(new Date(request.requested_date), 'MMM d, yyyy h:mm a')}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2 w-full md:w-auto mt-2 md:mt-0">
                            <Button
                              size="sm"
                              onClick={() => handleReviewRequest(request.id, 'approve')}
                              className="bg-green-600 hover:bg-green-700 flex-1 md:flex-none"
                            >
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleReviewRequest(request.id, 'reject')}
                              className="border-red-300 text-red-600 hover:bg-red-50 flex-1 md:flex-none"
                            >
                              <XCircle className="w-4 h-4 mr-1" />
                              Reject
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
