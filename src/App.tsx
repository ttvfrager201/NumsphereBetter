import { Suspense } from "react";
import * as React from "react";
import {
  Navigate,
  Route,
  Routes,
  useRoutes,
  useNavigate,
} from "react-router-dom";
import routes from "tempo-routes";
import LoginForm from "./components/auth/LoginForm";
import SignUpForm from "./components/auth/SignUpForm";
import ForgotPasswordForm from "./components/auth/ForgotPasswordForm";
import ResetPasswordForm from "./components/auth/ResetPasswordForm";
import Dashboard from "./components/pages/dashboard";
import Success from "./components/pages/success";
import Home from "./components/pages/home";
import PlanSelection from "./components/pages/PlanSelection";
import { AuthProvider, useAuth } from "../supabase/auth";
import { Toaster } from "./components/ui/toaster";
import { LoadingScreen, LoadingSpinner } from "./components/ui/loading-spinner";

function PlanSelectionWrapper() {
  const { hasCompletedPayment, loading, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = React.useMemo(
    () => [new URLSearchParams(window.location.search)],
    [],
  );

  React.useEffect(() => {
    // Only check for payment cancellation, don't force payment status checks
    if (searchParams.get("cancelled") === "true") {
      // Clear any pending session data
      sessionStorage.removeItem("payment_session");
    }
  }, [searchParams]);

  // Show loading while auth is loading
  if (loading) {
    return <LoadingScreen text="Loading..." />;
  }

  // Redirect to home if no user
  if (!user) {
    return <Navigate to="/" replace />;
  }

  // If user has completed payment, redirect to dashboard
  if (hasCompletedPayment) {
    console.log(
      "[PlanSelection] User has completed payment, redirecting to dashboard",
    );
    return <Navigate to="/dashboard" replace />;
  }

  console.log("[PlanSelection] Showing plan selection page");
  return <PlanSelection hasActiveSubscription={hasCompletedPayment} />;
}

function PrivateRoute({
  children,
  requiresPayment = false,
}: {
  children: React.ReactNode;
  requiresPayment?: boolean;
}) {
  const { user, loading, hasCompletedPayment, checkPaymentStatus } = useAuth();
  const [isCheckingPayment, setIsCheckingPayment] = React.useState(false);

  // Additional payment status check for routes that require payment
  React.useEffect(() => {
    if (user && requiresPayment && !hasCompletedPayment && !loading) {
      console.log(
        "[PrivateRoute] Double-checking payment status before redirect",
      );
      setIsCheckingPayment(true);
      checkPaymentStatus().finally(() => {
        setIsCheckingPayment(false);
      });
    }
  }, [user, requiresPayment, hasCompletedPayment, loading, checkPaymentStatus]);

  if (loading || isCheckingPayment) {
    return <LoadingScreen text="Loading..." />;
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (requiresPayment && !hasCompletedPayment) {
    console.log(
      "[PrivateRoute] Redirecting to plan selection - payment required but not completed",
    );
    return <Navigate to="/plan-selection" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <>
      {/* Tempo routes first to prevent conflicts */}
      {import.meta.env.VITE_TEMPO === "true" && useRoutes(routes)}

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<LoginForm />} />
        <Route path="/signup" element={<SignUpForm />} />
        <Route
          path="/dashboard"
          element={
            <PrivateRoute requiresPayment={true}>
              <Dashboard />
            </PrivateRoute>
          }
        />
        <Route
          path="/plan-selection"
          element={
            <PrivateRoute requiresPayment={false}>
              <PlanSelectionWrapper />
            </PrivateRoute>
          }
        />
        <Route path="/success" element={<Success />} />
        <Route path="/forgot-password" element={<ForgotPasswordForm />} />
        <Route path="/reset-password" element={<ResetPasswordForm />} />

        {/* Tempo catchall route */}
        {import.meta.env.VITE_TEMPO === "true" && (
          <Route path="/tempobook/*" element={<div />} />
        )}
      </Routes>
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <Suspense fallback={<LoadingScreen text="Loading application..." />}>
        <AppRoutes />
      </Suspense>
      <Toaster />
    </AuthProvider>
  );
}

export default App;
