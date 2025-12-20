import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { routes } from "@/utils";
import { User } from "@/entities/User";
import { useToast } from "@/Context/ToastContext";
import { Button } from "@/Components/ui/button";
import { Input } from "@/Components/ui/input";
import { Label } from "@/Components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { Phone, Key, User as UserIcon, Mail, Lock, Eye, EyeOff } from "lucide-react";

export default function RegisterPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [requestedRole, setRequestedRole] = useState<string>("");
  const [verificationCode, setVerificationCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'details' | 'verify'>('details');
  const [codeSent, setCodeSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const { showError, showSuccess, showWarning } = useToast();

  // Prevent back button on register page
  useEffect(() => {
    window.history.pushState(null, "", window.location.href);
    const handlePopState = () => {
      window.history.pushState(null, "", window.location.href);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const handleSendVerificationCode = async () => {
    if (!email.trim()) {
      showWarning("Please enter your email address first");
      return;
    }

    if (!password || !fullName || !phone) {
      showWarning("Please fill in all required fields first");
      return;
    }

    setLoading(true);
    try {
      // Use email-based verification (Resend)
      const response = await User.sendEmailVerificationCode(email, 'registration');
      showSuccess(response.message || "Verification code sent to your email");
      setCodeSent(true);
      setStep('verify');
    } catch (error: any) {
      showError(error.message || "Failed to send verification code");
    }
    setLoading(false);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (step === 'details') {
      if (password !== confirm) {
        showWarning("Passwords do not match");
        return;
      }
      if (!email || !password || !fullName || !phone) {
        showWarning("Please fill in all required fields");
        return;
      }
      // Move to verification step
      await handleSendVerificationCode();
      return;
    }

    // Step: verify - submit registration
    if (!verificationCode || verificationCode.length !== 6) {
      showWarning("Please enter a valid 6-digit verification code");
      return;
    }

    if (password !== confirm) {
      showWarning("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const result = await User.register(
        email, 
        password, 
        fullName, 
        phone,
        requestedRole || undefined,
        verificationCode
      );
      
      if (result.role_requested) {
        showSuccess("Your account has been created. Your role request is pending approval.");
        navigate(routes.Login);
      } else {
        showSuccess("Account created successfully. Please login to continue.");
        navigate(routes.Login);
      }
    } catch (error: any) {
      showError(error.message || "Registration failed");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-6">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md p-8">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {step === 'details' ? 'Create your account' : 'Verify Your Email'}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
            {step === 'details' 
              ? 'Fill in your details to get started' 
              : 'Enter the verification code sent to your email'}
          </p>
        </div>

        {step === 'details' && (
          <form onSubmit={onSubmit} className="space-y-3">
            <div>
              <Label className="block text-sm mb-1 text-slate-700 dark:text-slate-300">
                Full Name
              </Label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input 
                  className="w-full h-10 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 pl-10" 
                  value={fullName} 
                  onChange={(e)=>setFullName(e.target.value)}
                  required
                  placeholder="Enter your full name"
                />
              </div>
            </div>
            <div>
              <Label className="block text-sm mb-1 text-slate-700 dark:text-slate-300">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input 
                  type="email"
                  className="w-full h-10 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 pl-10" 
                  value={email} 
                  onChange={(e)=>setEmail(e.target.value)}
                  required
                  placeholder="Enter your email"
                />
              </div>
            </div>
            <div>
              <Label className="block text-sm mb-1 text-slate-700 dark:text-slate-300">Phone Number *</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input 
                  type="tel"
                  className="w-full h-10 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 pl-10" 
                  value={phone} 
                  onChange={(e)=>setPhone(e.target.value)}
                  required
                  placeholder="+255 123 456 789 or 0712 345 678"
                />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Your phone number for account recovery
              </p>
            </div>
            <div>
              <Label className="block text-sm mb-1 text-slate-700 dark:text-slate-300">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input 
                  type={showPassword ? "text" : "password"}
                  className="w-full h-10 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 pl-10 pr-10" 
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
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <Label className="block text-sm mb-1 text-slate-700 dark:text-slate-300">Confirm Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input 
                  type={showConfirm ? "text" : "password"}
                  className="w-full h-10 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 pl-10 pr-10" 
                  value={confirm} 
                  onChange={(e)=>setConfirm(e.target.value)}
                  required
                  placeholder="Confirm your password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <Label className="block text-sm mb-1 text-slate-700 dark:text-slate-300">Request Role (Optional)</Label>
              <select
                className="w-full h-10 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 px-3"
                value={requestedRole}
                onChange={(e)=>setRequestedRole(e.target.value)}
              >
                <option value="">Regular User (Default)</option>
                <option value="staff">Staff</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </select>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {requestedRole 
                  ? "Your role request will be reviewed by an administrator."
                  : "You can request a higher role later from your profile."}
              </p>
            </div>
            <button 
              disabled={loading}
              type="submit"
              className="w-full h-10 rounded-md bg-slate-900 dark:bg-slate-700 text-white dark:text-slate-100 hover:bg-slate-800 dark:hover:bg-slate-600 disabled:opacity-50"
            >
              {loading ? "Sending code..." : "Continue to Verification"}
            </button>
          </form>
        )}

        {step === 'verify' && (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-300">
                📧 A verification code has been sent to <span className="font-medium">{email}</span>
              </p>
            </div>
            <div>
              <Label className="block text-sm mb-1 text-slate-700 dark:text-slate-300">
                Verification Code
              </Label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                <Input
                  type="text"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Enter 6-digit code"
                  className="pl-10 text-center text-2xl tracking-widest font-mono"
                  maxLength={6}
                  required
                />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Enter the 6-digit code sent to your email
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setStep('details');
                  setCodeSent(false);
                  setVerificationCode("");
                }}
                className="flex-1"
              >
                Back
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleSendVerificationCode}
                disabled={loading}
                className="flex-1"
              >
                Resend Code
              </Button>
              <Button 
                type="submit" 
                disabled={loading || verificationCode.length !== 6}
                className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700"
              >
                {loading ? "Creating..." : "Create Account"}
              </Button>
            </div>
          </form>
        )}

        <div className="text-right text-xs text-slate-600 dark:text-slate-400 mt-4">
          <Link to={routes.Login} className="hover:text-blue-600 dark:hover:text-blue-400">Back to sign in</Link>
        </div>
      </div>
    </div>
  );
}
