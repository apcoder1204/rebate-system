import React, { useState, useEffect } from "react";
import { Admin, SystemSetting, AuditLog } from "@/entities/Admin";
import { User } from "@/entities/User";
import { Button } from "@/Components/ui/button";
import { Input } from "@/Components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/Components/ui/tabs";
import { useToast } from "@/Context/ToastContext";
import { Settings, Activity, Save, RefreshCw, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { createPageUrl } from "@/utils";
import { useNavigate } from "react-router-dom";

export default function SystemSettingsPage() {
  const { showSuccess, showError } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);

  // Settings form state
  const [editValues, setEditValues] = useState<Record<string, string>>({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const user = await User.me();
      if (user.role !== 'admin') {
        navigate(createPageUrl('Dashboard'));
        return;
      }
      setCurrentUserRole(user.role);

      const [settingsData, logsData] = await Promise.all([
        Admin.getSettings(),
        Admin.getLogs(50)
      ]);

      setSettings(settingsData);
      setLogs(logsData);
      
      // Init edit values
      const initialValues: Record<string, string> = {};
      settingsData.forEach(s => {
        initialValues[s.key] = s.value;
      });
      setEditValues(initialValues);
      
    } catch (error) {
      console.error("Error loading system data:", error);
      showError("Failed to load system data");
    } finally {
      setLoading(false);
    }
  };

  const handleSettingChange = (key: string, value: string) => {
    setEditValues(prev => ({ ...prev, [key]: value }));
  };

  const handleSaveSetting = async (key: string) => {
    try {
      await Admin.updateSetting(key, editValues[key]);
      showSuccess("Setting updated successfully");
      // Refresh to get updated timestamp
      const updatedSettings = await Admin.getSettings();
      setSettings(updatedSettings);
    } catch (error) {
      console.error("Error updating setting:", error);
      showError("Failed to update setting");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 md:p-8 bg-slate-50 dark:bg-slate-900">
      <div className="max-w-6xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">System Administration</h1>
          <p className="text-slate-600 dark:text-slate-400">Manage global settings and view audit logs</p>
        </div>

        <Tabs defaultValue="settings" className="space-y-6">
          <TabsList>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              System Settings
            </TabsTrigger>
            <TabsTrigger value="logs" className="flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Audit Logs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle>Global Configuration</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {settings.map((setting) => (
                    <div key={setting.id} className="flex flex-col md:flex-row gap-4 p-4 border rounded-lg bg-white dark:bg-slate-800 items-start md:items-center justify-between">
                      <div className="flex-1">
                        <label className="text-sm font-medium text-slate-900 dark:text-slate-100 block mb-1">
                          {setting.key.replace(/_/g, ' ').toUpperCase()}
                        </label>
                        <p className="text-sm text-slate-500">{setting.description}</p>
                        <p className="text-xs text-slate-400 mt-1">Last updated: {format(new Date(setting.updated_at), 'MMM d, yyyy HH:mm')}</p>
                      </div>
                      
                      <div className="flex items-center gap-3 w-full md:w-auto">
                        <Input 
                          value={editValues[setting.key] || ''}
                          onChange={(e) => handleSettingChange(setting.key, e.target.value)}
                          className="w-full md:w-48"
                        />
                        <Button 
                          onClick={() => handleSaveSetting(setting.key)}
                          disabled={editValues[setting.key] === setting.value}
                          size="sm"
                        >
                          <Save className="w-4 h-4 mr-2" />
                          Save
                        </Button>
                      </div>
                    </div>
                  ))}
                  
                  {settings.length === 0 && (
                     <div className="text-center py-8 text-slate-500">No settings found. Run migration.</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="logs">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Recent Activity</CardTitle>
                <Button variant="outline" size="sm" onClick={loadData}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh
                </Button>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-800 text-left">
                      <tr>
                        <th className="p-3 font-medium text-slate-500">Date</th>
                        <th className="p-3 font-medium text-slate-500">User</th>
                        <th className="p-3 font-medium text-slate-500">Action</th>
                        <th className="p-3 font-medium text-slate-500">Entity</th>
                        <th className="p-3 font-medium text-slate-500">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {logs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="p-3 whitespace-nowrap text-slate-600">
                            {format(new Date(log.created_at), 'MMM d, HH:mm')}
                          </td>
                          <td className="p-3">
                            <div className="font-medium text-slate-900">{log.user_name || 'Unknown'}</div>
                            <div className="text-xs text-slate-500">{log.user_email}</div>
                          </td>
                          <td className="p-3">
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                              {log.action.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="p-3 text-slate-600">
                            {log.entity_type} #{log.entity_id?.substring(0, 8)}
                          </td>
                          <td className="p-3 text-slate-600 max-w-xs truncate" title={JSON.stringify(log.details, null, 2)}>
                            {JSON.stringify(log.details)}
                          </td>
                        </tr>
                      ))}
                      {logs.length === 0 && (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-slate-500">No audit logs found</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

