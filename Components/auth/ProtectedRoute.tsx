import React, { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { User } from "@/entities/User";
import { routes } from "@/utils";
import { useSession } from "@/Context/SessionContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: string[];
}

export default function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const location = useLocation();
  const { checkSession, logout } = useSession();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const verifyAuth = async () => {
      try {
        const authenticated = await checkSession();
        setIsAuthenticated(authenticated);

        if (authenticated) {
          try {
            const currentUser = await User.me();
            setUser(currentUser);

            // Check role requirement
            if (requiredRole && requiredRole.length > 0) {
              const userRole = currentUser.role || "user";
              if (!requiredRole.includes(userRole)) {
                // User doesn't have required role
                await logout();
                setIsAuthenticated(false);
              }
            }
          } catch (error) {
            setIsAuthenticated(false);
            await logout();
          }
        } else {
          await logout();
        }
      } catch (error) {
        setIsAuthenticated(false);
        await logout();
      } finally {
        setLoading(false);
      }
    };

    verifyAuth();
  }, [location.pathname, checkSession, logout, requiredRole]);

  // Prevent back navigation for protected routes
  useEffect(() => {
    if (isAuthenticated) {
      // Push current state to history
      window.history.pushState(null, "", window.location.href);

      const handlePopState = (e: PopStateEvent) => {
        // Prevent default back behavior
        e.preventDefault();
        // Push state again to stay on current page
        window.history.pushState(null, "", window.location.href);
      };

      window.addEventListener("popstate", handlePopState);

      return () => {
        window.removeEventListener("popstate", handlePopState);
      };
    }
  }, [location.pathname, isAuthenticated]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400" />
      </div>
    );
  }

  if (isAuthenticated === false) {
    return <Navigate to={routes.Login} state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

