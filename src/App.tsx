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
  const { hasCompletedPayment, loading, user, checkPaymentStatus } = useAuth();
  const navigate = useNavigate();
  const [isCheckingSubscription, setIsCheckingSubscription] =
    React.useState(true);
  const [searchParams] = React.useMemo(
    () => [new URLSearchParams(window.location.search)],
    [],
  );

  React.useEffect(() => {
    // Check for payment cancellation
    if (searchParams.get("cancelled") === "true") {
      // Clear any pending session data
      sessionStorage.removeItem("payment_session");
      setIsCheckingSubscription(false);
      return;
    }

    // Enhanced subscription check
    const checkSubscriptionStatus = async () => {
      if (!user || loading) return;

      try {
        setIsCheckingSubscription(true);
        const hasValidPayment = await checkPaymentStatus();

        if (hasValidPayment) {
          navigate("/dashboard", { replace: true });
        }
      } catch (error) {
        console.error("Error checking subscription status:", error);
      } finally {
        setIsCheckingSubscription(false);
      }
    };

    checkSubscriptionStatus();
  }, [user, loading, navigate, searchParams, checkPaymentStatus]);

  if (!loading && !user) {
    return <Navigate to="/" replace />;
  }

  if (loading || isCheckingSubscription) {
    return <LoadingScreen text="Checking subscription status..." />;
  }

  if (!loading && user && hasCompletedPayment) {
    return <Navigate to="/dashboard" replace />;
  }

  return <PlanSelection hasActiveSubscription={hasCompletedPayment} />;
}

function PrivateRoute({
  children,
  requiresPayment = false,
}: {
  children: React.ReactNode;
  requiresPayment?: boolean;
}) {
  const { user, loading, hasCompletedPayment } = useAuth();

  if (loading) {
    return <LoadingScreen text="Loading..." />;
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (requiresPayment && !hasCompletedPayment) {
    return <Navigate to="/plan-selection" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <>
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
      </Routes>
      {import.meta.env.VITE_TEMPO === "true" && useRoutes(routes)}
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
