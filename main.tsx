import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./Layout";
import Home from "./Pages/Home";
import Dashboard from "./Pages/Dashboard";
import MyContracts from "./Pages/MyContracts";
import MyOrders from "./Pages/MyOrders";
import ManageContracts from "./Pages/ManageContracts";
import ManageOrders from "./Pages/ManageOrdes";
import ManageUsers from "./Pages/ManageUsers";
import Login from "./Pages/Login";
import Register from "./Pages/Register";
import ForgotPassword from "./Pages/ForgotPassword";
import Profile from "./Pages/Profile";
import ChangePassword from "./Pages/ChangePassword";
import Settings from "./Pages/Settings";
import SystemSettingsPage from "./Pages/SystemSettings";
import Reports from "./Pages/Reports";
import { routes } from "./utils";
import { ErrorBoundary } from "./ErrorBoundary";
import { ToastProvider } from "./Context/ToastContext";
import { ThemeProvider } from "./Context/ThemeContext";
import { SessionProvider } from "./Context/SessionContext";
import ProtectedRoute from "./Components/auth/ProtectedRoute";

import "./styles.css";

const App = () => (
  <ErrorBoundary>
    <ThemeProvider>
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <ToastProvider>
          <SessionProvider>
            <Routes>
          {/* Home without sidebar */}
          <Route path={routes.Home} element={<Home />} />
          {/* Auth pages */}
          <Route path={routes.Login} element={<Login />} />
          <Route path={routes.Register} element={<Register />} />
          <Route path={routes.ForgotPassword} element={<ForgotPassword />} />
          {/* App pages with sidebar layout - Protected Routes */}
          <Route 
            path={routes.Dashboard} 
            element={
              <ProtectedRoute>
                <Layout><Dashboard /></Layout>
              </ProtectedRoute>
            } 
          />
          <Route 
            path={routes.MyContracts} 
            element={
              <ProtectedRoute>
                <Layout><MyContracts /></Layout>
              </ProtectedRoute>
            } 
          />
          <Route 
            path={routes.MyOrders} 
            element={
              <ProtectedRoute>
                <Layout><MyOrders /></Layout>
              </ProtectedRoute>
            } 
          />
          <Route 
            path={routes.ManageContracts} 
            element={
              <ProtectedRoute requiredRole={['admin', 'manager', 'staff']}>
                <Layout><ManageContracts /></Layout>
              </ProtectedRoute>
            } 
          />
          <Route 
            path={routes.ManageOrders} 
            element={
              <ProtectedRoute requiredRole={['admin', 'manager', 'staff']}>
                <Layout><ManageOrders /></Layout>
              </ProtectedRoute>
            } 
          />
          <Route 
            path={routes.ManageUsers} 
            element={
              <ProtectedRoute requiredRole={['admin', 'manager']}>
                <Layout><ManageUsers /></Layout>
              </ProtectedRoute>
            } 
          />
          <Route 
            path={routes.Profile} 
            element={
              <ProtectedRoute>
                <Layout><Profile /></Layout>
              </ProtectedRoute>
            } 
          />
          <Route 
            path={routes.ChangePassword} 
            element={
              <ProtectedRoute>
                <Layout><ChangePassword /></Layout>
              </ProtectedRoute>
            } 
          />
          <Route 
            path={routes.Settings} 
            element={
              <ProtectedRoute>
                <Layout><Settings /></Layout>
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/admin/system-settings"
            element={
              <ProtectedRoute requiredRole={['admin']}>
                <Layout><SystemSettingsPage /></Layout>
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/reports"
            element={
              <ProtectedRoute requiredRole={['admin', 'manager']}>
                <Layout><Reports /></Layout>
              </ProtectedRoute>
            } 
          />
          <Route path="*" element={<Navigate to={routes.Home} replace />} />
            </Routes>
          </SessionProvider>
        </ToastProvider>
      </BrowserRouter>
    </ThemeProvider>
  </ErrorBoundary>
);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
