import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { routes } from "@/utils";
import { User } from "@/entities/User";
import { useToast } from "@/Context/ToastContext";
import { Button } from "@/Components/ui/button";
import { Input } from "@/Components/ui/input";
import { Label } from "@/Components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { ArrowLeft, Mail, Key, Shield, Eye, EyeOff, Lock } from "lucide-react";

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const { showError, showSuccess, showWarning } = useToast();
  
  const [step, setStep] = useState<'email' | 'verify' | 'reset'>('email');
  const [email, setEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Prevent back button on forgot password page
  useEffect(() => {
    window.history.pushState(null, "", window.location.href);
    const handlePopState = () => {
      window.history.pushState(null, "", window.location.href);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      showWarning("Please enter your email address");
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      showWarning("Please enter a valid email address");
      return;
    }

    setLoading(true);
    try {
      const response = await User.sendEmailVerificationCode(email.trim(), 'password_reset');
      showSuccess(response.message || "Verification code sent to your email");
      setCodeSent(true);
      setStep('verify');
    } catch (error: any) {
      showError(error.message || "Failed to send verification code");
    }
    setLoading(false);
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verificationCode.trim()) {
      showWarning("Please enter the verification code");
      return;
    }

    setLoading(true);
    try {
      await User.verifyEmailCode(email.trim(), verificationCode, 'password_reset');
      showSuccess("Code verified successfully");
      setStep('reset');
    } catch (error: any) {
      showError(error.message || "Invalid verification code");
    }
    setLoading(false);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newPassword || !confirmPassword) {
      showWarning("Please fill in all fields");
      return;
    }

    if (newPassword !== confirmPassword) {
      showWarning("Passwords do not match");
      return;
    }

    if (newPassword.length < 6) {
      showWarning("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    try {
      await User.resetPasswordByEmail(email.trim(), verificationCode, newPassword);
      showSuccess("Password reset successfully! Please login with your new password.");
      navigate(routes.Login);
    } catch (error: any) {
      showError(error.message || "Failed to reset password");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-6">
      <div className="w-full max-w-md">
        <Link 
          to={routes.Login}
          className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Login
        </Link>

        <Card className="bg-white dark:bg-slate-800 shadow-xl">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400">
                <Shield className="w-6 h-6" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              Reset Password
            </CardTitle>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
              {step === 'email' && "Enter your email address to receive a verification code"}
              {step === 'verify' && "Enter the verification code sent to your email"}
              {step === 'reset' && "Enter your new password"}
            </p>
          </CardHeader>
          <CardContent>
            {step === 'email' && (
              <form onSubmit={handleSendCode} className="space-y-4">
                <div>
                  <Label htmlFor="email" className="text-slate-700 dark:text-slate-300">
                    Email Address
                  </Label>
                  <div className="relative mt-1">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email address"
                      className="pl-10"
                      required
                    />
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    We'll send a verification code to this email
                  </p>
                </div>
                <Button 
                  type="submit" 
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-blue-600 to-blue-700"
                >
                  {loading ? "Sending..." : "Send Verification Code"}
                </Button>
              </form>
            )}

            {step === 'verify' && (
              <form onSubmit={handleVerifyCode} className="space-y-4">
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg mb-4">
                  <p className="text-sm text-blue-800 dark:text-blue-300">
                    We've sent a verification code to <strong>{email}</strong>. Please check your inbox (and spam folder).
                  </p>
                </div>
                <div>
                  <Label htmlFor="code" className="text-slate-700 dark:text-slate-300">
                    Verification Code
                  </Label>
                  <div className="relative mt-1">
                    <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <Input
                      id="code"
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
                      setStep('email');
                      setCodeSent(false);
                      setVerificationCode("");
                    }}
                    className="flex-1"
                  >
                    Change Email
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={loading || verificationCode.length !== 6}
                    className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700"
                  >
                    {loading ? "Verifying..." : "Verify Code"}
                  </Button>
                </div>
              </form>
            )}

            {step === 'reset' && (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <Label htmlFor="newPassword" className="text-slate-700 dark:text-slate-300">
                    New Password
                  </Label>
                  <div className="relative mt-1">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <Input
                      id="newPassword"
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                      className="pl-10 pr-10"
                      minLength={6}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                    >
                      {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
                <div>
                  <Label htmlFor="confirmPassword" className="text-slate-700 dark:text-slate-300">
                    Confirm New Password
                  </Label>
                  <div className="relative mt-1">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                      className="pl-10 pr-10"
                      minLength={6}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                    >
                      {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
                <Button 
                  type="submit" 
                  disabled={loading || newPassword !== confirmPassword || newPassword.length < 6}
                  className="w-full bg-gradient-to-r from-green-600 to-green-700"
                >
                  {loading ? "Resetting..." : "Reset Password"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
