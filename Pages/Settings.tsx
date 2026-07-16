import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { Button } from "@/Components/ui/button";
import { useTheme } from "@/Context/ThemeContext";
import {
  Settings as SettingsIcon,
  Moon,
  Sun,
  Palette,
  Bell,
  Shield,
  Globe,
  Monitor,
  Check,
  FileText,
  ShoppingCart,
  Loader2
} from "lucide-react";
import { useToast } from "@/Context/ToastContext";
import { Notification, type NotificationPreferences } from "@/entities/Notification";
import { usePushNotifications } from "@/hooks/usePushNotifications";

export default function Settings() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const { showSuccess, showError } = useToast();
  const [prefs, setPrefs] = useState<NotificationPreferences>({
    email_notifications: true,
    push_notifications: true,
    order_updates: true,
    contract_updates: true,
  });
  const [prefsLoading, setPrefsLoading] = useState(true);

  usePushNotifications(prefs.push_notifications && !prefsLoading);

  useEffect(() => {
    Notification.getPreferences()
      .then(setPrefs)
      .catch(() => {})
      .finally(() => setPrefsLoading(false));
  }, []);

  const handleThemeChange = (newTheme: "light" | "dark" | "system") => {
    setTheme(newTheme);
    if (newTheme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "Dark" : "Light";
      showSuccess(`Theme set to match system (${systemTheme})`);
    } else {
      showSuccess(`Theme changed to ${newTheme === "dark" ? "Dark" : "Light"} mode`);
    }
  };

  const handleNotificationChange = async (key: keyof NotificationPreferences) => {
    const prev = prefs;
    const updated = { ...prefs, [key]: !prefs[key] };
    setPrefs(updated); // optimistic
    try {
      await Notification.updatePreferences(updated);
      showSuccess("Preference saved");
    } catch {
      setPrefs(prev); // revert
      showError("Failed to save preference. Please try again.");
    }
  };

  return (
    <div className="min-h-screen p-6 md:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-slate-100 mb-2">
            Settings
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Manage your preferences and account settings
          </p>
        </div>

        {/* Appearance Settings */}
        <Card className="border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          <CardHeader className="border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400">
                <Palette className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-slate-900 dark:text-slate-100">Appearance</CardTitle>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Customize the look and feel of the application
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                  Theme
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <button
                    onClick={() => handleThemeChange("light")}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      theme === "light"
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                        : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-800"
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <Sun className={`w-5 h-5 ${theme === "light" ? "text-blue-600 dark:text-blue-400" : "text-slate-400"}`} />
                      {theme === "light" && <Check className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
                    </div>
                    <p className={`text-sm font-medium ${theme === "light" ? "text-blue-900 dark:text-blue-100" : "text-slate-700 dark:text-slate-300"}`}>
                      Light
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Bright and clean interface
                    </p>
                  </button>

                  <button
                    onClick={() => handleThemeChange("dark")}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      theme === "dark"
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                        : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-800"
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <Moon className={`w-5 h-5 ${theme === "dark" ? "text-blue-600 dark:text-blue-400" : "text-slate-400"}`} />
                      {theme === "dark" && <Check className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
                    </div>
                    <p className={`text-sm font-medium ${theme === "dark" ? "text-blue-900 dark:text-blue-100" : "text-slate-700 dark:text-slate-300"}`}>
                      Dark
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Easy on the eyes
                    </p>
                  </button>

                  <button
                    onClick={() => handleThemeChange("system")}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      theme === "system"
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                        : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-800"
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <Monitor className={`w-5 h-5 ${theme === "system" ? "text-blue-600 dark:text-blue-400" : "text-slate-400"}`} />
                      {theme === "system" && <Check className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
                    </div>
                    <p className={`text-sm font-medium ${theme === "system" ? "text-blue-900 dark:text-blue-100" : "text-slate-700 dark:text-slate-300"}`}>
                      System
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Match your device
                    </p>
                  </button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notifications Settings */}
        <Card className="border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          <CardHeader className="border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-slate-900 dark:text-slate-100">Notifications</CardTitle>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Choose what notifications you want to receive
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {prefsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
              </div>
            ) : (
            <div className="space-y-4">
              {([
                { key: 'email_notifications' as const, label: 'Email Notifications', desc: 'Receive updates via email', icon: Bell, color: 'blue' },
                { key: 'push_notifications' as const, label: 'Push Notifications', desc: 'Get instant browser notifications', icon: Bell, color: 'purple' },
                { key: 'order_updates' as const, label: 'Order Updates', desc: 'Notifications about your orders', icon: ShoppingCart, color: 'amber' },
                { key: 'contract_updates' as const, label: 'Contract Updates', desc: 'Notifications about your contracts', icon: FileText, color: 'green' },
              ]).map(({ key, label, desc, icon: Icon, color }) => (
                <div key={key} className="flex items-center justify-between p-4 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg bg-${color}-50 dark:bg-${color}-900/20`}>
                      <Icon className={`w-4 h-4 text-${color}-600 dark:text-${color}-400`} />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900 dark:text-slate-100">{label}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{desc}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleNotificationChange(key)}
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                      prefs[key] ? "bg-blue-600" : "bg-slate-300 dark:bg-slate-600"
                    }`}
                    aria-label={`Toggle ${label}`}
                  >
                    <span
                      className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                        prefs[key] ? "translate-x-6" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>
            )}
          </CardContent>
        </Card>

        {/* Privacy & Security */}
        <Card className="border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          <CardHeader className="border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-slate-900 dark:text-slate-100">Privacy & Security</CardTitle>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Manage your privacy and security settings
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50">
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-2">
                  Data Privacy
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Your data is encrypted and stored securely. We never share your information with third parties.
                </p>
              </div>
              <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50">
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-2">
                  Session Management
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Your session is automatically secured with HTTPS encryption. Log out when using shared devices.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Language & Region */}
        <Card className="border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          <CardHeader className="border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400">
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-slate-900 dark:text-slate-100">Language & Region</CardTitle>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Customize language and regional settings
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Language
                </label>
                <select className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                  <option value="en">English</option>
                  <option value="sw">Swahili</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Date Format
                </label>
                <select className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                  <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                  <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

