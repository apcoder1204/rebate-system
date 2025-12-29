import React, { useState, useEffect } from "react";
import { User } from "@/entities/User";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { routes } from "@/utils";
import cctvpointLogo from '../cctvpointLogo.png';
import { useToast } from "@/Context/ToastContext";
import { useSession } from "@/Context/SessionContext";
import { Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { resetActivityTimer } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { showError, showSuccess } = useToast();

  // Prevent back navigation from login page if already logged in
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem("rebate_token");
        if (token) {
          // User is already logged in, redirect to dashboard
          navigate(routes.Dashboard, { replace: true });
        }
      } catch (error) {
        // Not authenticated, stay on login page
      }
    };
    checkAuth();
  }, [navigate]);

  // Prevent back button on login page
  useEffect(() => {
    window.history.pushState(null, "", window.location.href);
    const handlePopState = () => {
      window.history.pushState(null, "", window.location.href);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await User.login(email, password);
      showSuccess("Login successful! Welcome back.");
      
      // Reset activity timer
      resetActivityTimer();
      
      // Clear browser history to prevent back navigation
      window.history.replaceState(null, "", routes.Dashboard);
      
      // Navigate and prevent back button
      navigate(routes.Dashboard, { replace: true });
      
      // Push state again to prevent back navigation
      setTimeout(() => {
        window.history.pushState(null, "", routes.Dashboard);
      }, 100);
    } catch (error: any) {
      console.error('Login error:', error);
      // Show more detailed error message
      const errorMessage = error?.message || 'Unknown error occurred';
      if (errorMessage.includes('rate limit') || errorMessage.includes('Too many')) {
        showError("Too many login attempts. Please wait 15 minutes and try again.");
      } else if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
        showError("Cannot connect to server. Please check if the backend is running.");
      } else if (errorMessage.includes('Invalid credentials') || errorMessage.includes('Invalid email')) {
        showError("Invalid email or password");
      } else {
        showError(errorMessage || "Login failed. Please try again.");
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-6">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md p-8">
        <div className="text-center mb-6">
          <div className="flex justify-center mb-4">
            <img src={cctvpointLogo} alt="CCTV Point Logo" className="h-20 md:h-24 object-contain" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Welcome to RebateFlow</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Sign in to continue</p>
        </div>

        <button className="w-full h-10 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-600 mb-4">Continue with Google</button>
        <div className="text-center text-xs text-slate-400 dark:text-slate-500 mb-4">OR</div>
        
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className="block text-sm mb-1 text-slate-700 dark:text-slate-300">Email</label>
            <input 
              className="w-full h-10 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 px-3" 
              value={email} 
              onChange={(e)=>setEmail(e.target.value)}
              required
              placeholder="Enter your email"
            />
          </div>
          <div>
            <label className="block text-sm mb-1 text-slate-700 dark:text-slate-300">Password</label>
            <div className="relative">
              <input 
                type={showPassword ? "text" : "password"}
                className="w-full h-10 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 px-3 pr-10" 
                value={password} 
                onChange={(e)=>setPassword(e.target.value)}
                required
                placeholder="Enter your password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>
          <button disabled={loading} className="w-full h-10 rounded-md bg-slate-900 dark:bg-slate-700 text-white dark:text-slate-100 hover:bg-slate-800 dark:hover:bg-slate-600 disabled:opacity-50">
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
        
        <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 mt-4">
          <Link to={routes.ForgotPassword} className="hover:text-blue-600 dark:hover:text-blue-400">Forgot password?</Link>
          <Link to={routes.Register} className="hover:text-blue-600 dark:hover:text-blue-400">Need an account? Sign up</Link>
        </div>
      </div>
    </div>
  );
}