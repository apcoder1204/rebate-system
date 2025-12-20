import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { User, UserType } from "@/entities/User";
import { routes, createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { Input } from "@/Components/ui/input";
import { Button } from "@/Components/ui/button";
import { Badge } from "@/Components/ui/badge";
import { Phone, Mail, ShieldCheck, ArrowLeft } from "lucide-react";

export default function Profile() {
  const navigate = useNavigate();
  const [user, setUser] = useState<UserType | null>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    setError(null);
    try {
      const currentUser = await User.me();
      setUser(currentUser);
      setFullName(currentUser.full_name || "");
      setPhone(currentUser.phone || "");
    } catch (err) {
      navigate(routes.Login);
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const result = await User.updateProfile({
        full_name: fullName,
        phone: phone || undefined,
      });
      setUser(result);
      setMessage(result.message || "Profile updated successfully");
    } catch (err: any) {
      setError(err.message || "Failed to update profile");
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const roleBadgeColor = () => {
    switch (user.role) {
      case "admin":
        return "bg-red-100 text-red-700";
      case "manager":
        return "bg-purple-100 text-purple-700";
      case "staff":
        return "bg-amber-100 text-amber-700";
      default:
        return "bg-blue-100 text-blue-700";
    }
  };

  return (
    <div className="min-h-screen p-6 md:p-8 bg-slate-50 dark:bg-slate-900">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <Button
            variant="outline"
            onClick={() => navigate(createPageUrl('Dashboard'))}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-slate-100 mb-2">
            My Profile
          </h1>
          <p className="text-slate-600 dark:text-slate-400">View and update your account details</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
            </CardHeader>
            <CardContent>
              {error && (
                <div className="mb-4 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}
              {message && (
                <div className="mb-4 text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 rounded-lg px-3 py-2">
                  {message}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Full Name
                  </label>
                  <Input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Phone
                  </label>
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Email
                  </label>
                  <Input value={user.email} disabled />
                </div>
                <Button disabled={saving} className="w-full md:w-auto">
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Account Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Email</p>
                  <p className="font-medium text-slate-900 dark:text-slate-100 break-all">
                    {user.email}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="p-3 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400">
                  <Phone className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Phone</p>
                  <p className="font-medium text-slate-900 dark:text-slate-100">
                    {user.phone || "Not set"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="p-3 rounded-full bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Role</p>
                  <Badge className={roleBadgeColor()}>
                    {user.role === "user" || !user.role ? "customer" : user.role}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

