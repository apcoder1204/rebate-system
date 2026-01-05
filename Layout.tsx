import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { User } from "@/entities/User";
import { FileText, ShoppingCart, LayoutDashboard, Users, LogOut, Menu, FileSignature, Settings } from "lucide-react";
import { useSession } from "@/Context/SessionContext";

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout: sessionLogout, resetActivityTimer } = useSession();
  const [user, setUser] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [userMenuOpen, setUserMenuOpen] = React.useState(false);

  React.useEffect(() => {
    loadUser();
  }, []);

  // Reset activity timer on any user interaction
  React.useEffect(() => {
    resetActivityTimer();
  }, [location.pathname, resetActivityTimer]);

  const loadUser = async () => {
    try {
      const currentUser = await (User as any).me();
      setUser(currentUser);
    } catch (error) {
      console.log("User not authenticated");
      // If not authenticated, redirect to login
      if (!location.pathname.includes('/login') && !location.pathname.includes('/register') && !location.pathname.includes('/forgot-password')) {
        await sessionLogout();
      }
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    await sessionLogout();
  };

  const getNavigationItems = () => {
    const userRole = user?.role || "user";
    const isStaff = ["admin", "manager", "staff"].includes(userRole);

    const items: Array<{ title: string; url: string; icon: any }> = [];

    items.push({
      title: "Dashboard",
      url: createPageUrl("Dashboard" as any),
      icon: LayoutDashboard,
    });

    if (!isStaff) {
      items.push({ title: "My Contracts", url: createPageUrl("MyContracts" as any), icon: FileText });
      items.push({ title: "My Orders", url: createPageUrl("MyOrders" as any), icon: ShoppingCart });
    }

    if (isStaff) {
      items.push({ title: "Manage Orders", url: createPageUrl("ManageOrders" as any), icon: ShoppingCart });
    }

    if (["admin", "manager", "staff"].includes(userRole)) {
      items.push({ title: "Contracts", url: createPageUrl("ManageContracts" as any), icon: FileText });
    }

    if (["admin", "manager"].includes(userRole)) {
      items.push({ title: "Users", url: createPageUrl("ManageUsers" as any), icon: Users });
    }

    if (userRole === 'admin') {
      items.push({ title: "System", url: "/admin/system-settings", icon: Settings });
    }

    // Settings available for all authenticated users
    items.push({ title: "Settings", url: createPageUrl("Settings" as any), icon: Settings });
    
    return items;
  };

  const getRoleBadgeColor = () => {
    switch (user?.role) {
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400" />
      </div>
    );
  }

  const navigationItems = getNavigationItems();

  return (
    <div className="min-h-screen flex w-full bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border-r border-slate-200/60 dark:border-slate-700/60 transition-transform duration-300 ease-in-out`}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="border-b border-slate-200/60 dark:border-slate-700/60 p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-800 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                <FileSignature className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-slate-900 dark:text-slate-100 text-lg">Rebate System</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">cctvpoint.org</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex-1 p-3">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-3 py-2">Navigation</p>
              {navigationItems.map((item) => {
                const isActive = location.pathname === item.url;
                return (
                  <Link
                    key={item.title}
                    to={item.url}
                    className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 font-medium mb-1 ${
                      isActive 
                        ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 shadow-sm" 
                        : "hover:bg-blue-50 dark:hover:bg-blue-900/10 hover:text-blue-700 dark:hover:text-blue-400 text-slate-700 dark:text-slate-300"
                    }`}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <item.icon className="w-4 h-4" />
                    <span>{item.title}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-slate-200/60 dark:border-slate-700/60 p-4">
            <div className="text-xs text-center text-slate-400 dark:text-slate-500">
              &copy; {new Date().getFullYear()} Rebate System
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Top Header */}
        <header className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border-b border-slate-200/60 dark:border-slate-700/60 px-6 py-3 flex items-center justify-between z-10">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="hover:bg-slate-100 dark:hover:bg-slate-700 p-2 rounded-lg transition-colors duration-200 lg:hidden"
            >
              <Menu className="w-5 h-5 text-slate-900 dark:text-slate-100" />
            </button>
            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100 lg:hidden">Rebate System</h1>
          </div>

          <div className="flex items-center gap-4 ml-auto">
            {user ? (
              <div className="relative">
                <button 
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-700 p-2 rounded-xl transition-all duration-200"
                >
                  <div className="text-right hidden md:block">
                    <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm">{user.full_name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">{user.role}</p>
                  </div>
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full flex items-center justify-center shadow-md text-white font-semibold">
                    {user.full_name?.charAt(0) || "U"}
                  </div>
                </button>

                {/* Dropdown Menu */}
                {userMenuOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setUserMenuOpen(false)}
                    />
                    <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-100 dark:border-slate-700 p-2 z-50">
                      <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-700 mb-1">
                        <p className="font-medium text-slate-900 dark:text-slate-100 text-sm truncate">{user.full_name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user.email}</p>
                      </div>
                      
                      <Link 
                        to={createPageUrl('Profile')} 
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-100 rounded-lg"
                      >
                        <Users className="w-4 h-4" />
                        Profile
                      </Link>
                      
                      <Link 
                        to={createPageUrl('ChangePassword')} 
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-100 rounded-lg"
                      >
                        <FileSignature className="w-4 h-4" />
                        Change Password
                      </Link>
                      
                      <div className="border-t border-slate-100 dark:border-slate-700 my-1"></div>
                      
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                      >
                        <LogOut className="w-4 h-4" />
                        Sign Out
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <Link to="/login" className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300">
                Sign In
              </Link>
            )}
          </div>
        </header>

        {/* Main Content Area */}
        <div className="flex-1 overflow-auto">{children}</div>
      </div>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}