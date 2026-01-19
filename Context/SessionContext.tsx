import React, { createContext, useContext, useEffect, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { User } from "@/entities/User";
import { routes } from "@/utils";
import { useToast } from "./ToastContext";

interface SessionContextType {
  isAuthenticated: boolean;
  checkSession: () => Promise<boolean>;
  resetActivityTimer: () => void;
  logout: () => Promise<void>;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

// Session timeout: 10 minutes = 600000 milliseconds
const SESSION_TIMEOUT = 10 * 60 * 1000; // 10 minutes in milliseconds
const WARNING_TIME = 3 * 60 * 1000; // Show warning 3 minutes before timeout

// ============================================================
// MAINTENANCE MODE
// Toggle via Vite env var:
// - VITE_MAINTENANCE_MODE=true  (enabled)
// - VITE_MAINTENANCE_MODE=false (disabled)
//
// IMPORTANT: Remember to disable/comment this after maintenance.
// ============================================================
const MAINTENANCE_MODE =
  (import.meta as any)?.env?.VITE_MAINTENANCE_MODE === "true";

function MaintenanceOverlay({ onLogout }: { onLogout: () => void }) {
  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-xl rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800">
        <div className="p-6 md:p-8 space-y-4">
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100">
              Taarifa ya Matengenezo
            </h2>
            <p className="mt-2 text-slate-700 dark:text-slate-300 leading-relaxed">
              Mfumo upo kwenye matengenezo kwa siku chache. Kwa sasa huwezi kufanya
              shughuli nyingine yoyote. Tafadhali <span className="font-semibold">toka (logout)</span> na
              ujaribu tena baada ya matengenezo kukamilika.
            </p>
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
              Asante kwa uvumilivu wako.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              onClick={onLogout}
              className="inline-flex items-center justify-center h-10 px-4 rounded-md bg-red-600 hover:bg-red-700 text-white font-medium"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { showWarning, showError } = useToast();
  
  const activityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const isAuthenticatedRef = useRef<boolean>(false);
  const warningShownRef = useRef<boolean>(false);

  // Check if user is authenticated
  const checkSession = useCallback(async (): Promise<boolean> => {
    try {
      const token = localStorage.getItem("rebate_token");
      if (!token) {
        return false;
      }

      // Try to get user info from API
      try {
        await User.me();
        isAuthenticatedRef.current = true;
        return true;
      } catch (error) {
        // Token expired or invalid
        isAuthenticatedRef.current = false;
        return false;
      }
    } catch (error) {
      isAuthenticatedRef.current = false;
      return false;
    }
  }, []);

  // Logout function
  const logout = useCallback(async () => {
    try {
      await User.logout();
      isAuthenticatedRef.current = false;
      
      // Clear all timers
      if (activityTimerRef.current) {
        clearTimeout(activityTimerRef.current);
        activityTimerRef.current = null;
      }
      if (warningTimerRef.current) {
        clearTimeout(warningTimerRef.current);
        warningTimerRef.current = null;
      }
      
      // Clear session storage
      sessionStorage.clear();
      
      // Navigate to login
      navigate(routes.Login, { replace: true });
      
      // Prevent back navigation
      window.history.pushState(null, "", routes.Login);
    } catch (error) {
      console.error("Logout error:", error);
    }
  }, [navigate]);

  // Reset activity timer
  const resetActivityTimer = useCallback(() => {
    // Clear existing timers
    if (activityTimerRef.current) {
      clearTimeout(activityTimerRef.current);
    }
    if (warningTimerRef.current) {
      clearTimeout(warningTimerRef.current);
    }
    
    warningShownRef.current = false;
    lastActivityRef.current = Date.now();

    // Set warning timer (3 minutes before timeout)
    warningTimerRef.current = setTimeout(() => {
      if (isAuthenticatedRef.current && !warningShownRef.current) {
        warningShownRef.current = true;
        showWarning(
          "Your session will expire in 3 minutes due to inactivity. Please interact with the page to stay logged in.",
          10000
        );
      }
    }, SESSION_TIMEOUT - WARNING_TIME);

    // Set logout timer
    activityTimerRef.current = setTimeout(() => {
      if (isAuthenticatedRef.current) {
        showError("Your session has expired due to inactivity. Please login again.");
        logout();
      }
    }, SESSION_TIMEOUT);
  }, [logout, showWarning, showError]);

  // Track user activity
  useEffect(() => {
    const activityEvents = [
      "mousedown",
      "mousemove",
      "keypress",
      "scroll",
      "touchstart",
      "click",
      "keydown",
    ];

    const handleActivity = () => {
      if (isAuthenticatedRef.current) {
        resetActivityTimer();
      }
    };

    // Add event listeners
    activityEvents.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      activityEvents.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [resetActivityTimer]);

  // Check session on mount and route changes
  useEffect(() => {
    const initSession = async () => {
      const authenticated = await checkSession();
      isAuthenticatedRef.current = authenticated;

      if (authenticated) {
        resetActivityTimer();
      } else {
        // If not authenticated and on protected route, redirect to login
        const protectedRoutes = [
          routes.Dashboard,
          routes.MyContracts,
          routes.MyOrders,
          routes.ManageOrders,
          routes.ManageContracts,
          routes.ManageUsers,
          routes.Profile,
          routes.ChangePassword,
          routes.Settings,
        ];

        // Defensive check for mobile browsers where pathname might be undefined
        const pathname = location?.pathname || '';
        if (pathname && protectedRoutes.includes(pathname)) {
          await logout();
        }
      }
    };

    initSession();
  }, [location.pathname, checkSession, resetActivityTimer, logout]);

  // Prevent back button navigation for authenticated routes
  useEffect(() => {
    const protectedRoutes = [
      routes.Dashboard,
      routes.MyContracts,
      routes.MyOrders,
      routes.ManageOrders,
      routes.ManageContracts,
      routes.ManageUsers,
      routes.Profile,
      routes.ChangePassword,
      routes.Settings,
    ];

    // Defensive check for mobile browsers where pathname might be undefined
    const pathname = location?.pathname || '';
    const isProtectedRoute = pathname && protectedRoutes.includes(pathname);

    if (isProtectedRoute && isAuthenticatedRef.current) {
      // Push current state to history to prevent back navigation
      window.history.pushState(null, "", window.location.href);

      const handlePopState = (e: PopStateEvent) => {
        // Prevent default back behavior
        e.preventDefault();
        // Push state again to stay on current page
        window.history.pushState(null, "", window.location.href);
      };

      // Listen for popstate (back/forward button)
      window.addEventListener("popstate", handlePopState);

      return () => {
        window.removeEventListener("popstate", handlePopState);
      };
    }
  }, [location.pathname]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (activityTimerRef.current) {
        clearTimeout(activityTimerRef.current);
      }
      if (warningTimerRef.current) {
        clearTimeout(warningTimerRef.current);
      }
    };
  }, []);

  return (
    <SessionContext.Provider
      value={{
        isAuthenticated: isAuthenticatedRef.current,
        checkSession,
        resetActivityTimer,
        logout,
      }}
    >
      {children}
      {MAINTENANCE_MODE && isAuthenticatedRef.current && (
        <MaintenanceOverlay onLogout={() => logout()} />
      )}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return context;
}

