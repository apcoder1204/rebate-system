import React, { useState } from "react";
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
  ShoppingCart
} from "lucide-react";
import { useToast } from "@/Context/ToastContext";

export default function Settings() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const { showSuccess } = useToast();
  const [notifications, setNotifications] = useState({
    email: true,
    push: false,
    orderUpdates: true,
    contractUpdates: true,
  });

  const handleThemeChange = (newTheme: "light" | "dark" | "system") => {
    setTheme(newTheme);
    if (newTheme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "Dark" : "Light";
      showSuccess(`Theme set to match system (${systemTheme})`);
    } else {
      showSuccess(`Theme changed to ${newTheme === "dark" ? "Dark" : "Light"} mode`);
    }
  };

  const handleNotificationChange = (key: string) => {
    setNotifications((prev) => ({
      ...prev,
      [key]: !prev[key as keyof typeof prev],
    }));
    showSuccess("Notification preferences updated");
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
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                    <Bell className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-900 dark:text-slate-100">Email Notifications</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Receive updates via email</p>
                  </div>
                </div>
                <button
                  onClick={() => handleNotificationChange("email")}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    notifications.email ? "bg-blue-600" : "bg-slate-300 dark:bg-slate-600"
                  }`}
                >
                  <span
                    className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                      notifications.email ? "translate-x-6" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-900/20">
                    <Bell className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-900 dark:text-slate-100">Push Notifications</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Get instant browser notifications</p>
                  </div>
                </div>
                <button
                  onClick={() => handleNotificationChange("push")}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    notifications.push ? "bg-blue-600" : "bg-slate-300 dark:bg-slate-600"
                  }`}
                >
                  <span
                    className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                      notifications.push ? "translate-x-6" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20">
                    <ShoppingCart className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-900 dark:text-slate-100">Order Updates</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Notifications about your orders</p>
                  </div>
                </div>
                <button
                  onClick={() => handleNotificationChange("orderUpdates")}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    notifications.orderUpdates ? "bg-blue-600" : "bg-slate-300 dark:bg-slate-600"
                  }`}
                >
                  <span
                    className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                      notifications.orderUpdates ? "translate-x-6" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-50 dark:bg-green-900/20">
                    <FileText className="w-4 h-4 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-900 dark:text-slate-100">Contract Updates</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Notifications about your contracts</p>
                  </div>
                </div>
                <button
                  onClick={() => handleNotificationChange("contractUpdates")}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    notifications.contractUpdates ? "bg-blue-600" : "bg-slate-300 dark:bg-slate-600"
                  }`}
                >
                  <span
                    className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                      notifications.contractUpdates ? "translate-x-6" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>
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

