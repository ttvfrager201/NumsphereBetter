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
  const [hasCheckedOnMount, setHasCheckedOnMount] = React.useState(false);

  // Single check on mount to prevent loops
  React.useEffect(() => {
    if (user && !hasCheckedOnMount) {
      setHasCheckedOnMount(true);
      if (hasCompletedPayment) {
        console.log("User has completed payment, redirecting to dashboard");
        navigate("/dashboard", { replace: true });
      }
    }
  }, [user, hasCompletedPayment, navigate, hasCheckedOnMount]);

  // If user is not logged in, redirect to home
  if (!loading && !user) {
    return <Navigate to="/" replace />;
  }

  // If user has already completed payment, redirect immediately
  if (!loading && user && hasCompletedPayment) {
    return <Navigate to="/dashboard" replace />;
  }

  if (loading) {
    return <LoadingScreen text="Checking subscription status..." />;
  }

  // Pass hasCompletedPayment to PlanSelection component
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
    return <LoadingScreen text="Authenticating..." />;
  }

  if (!user) {
    // No user, redirecting to home
    return <Navigate to="/" replace />;
  }

  // If payment is required but user hasn't completed payment, redirect to plan selection
  // But only redirect if we're not already on the plan selection page to avoid loops
  if (requiresPayment && !hasCompletedPayment) {
    // Payment required but not completed, redirecting to plan selection
    return <Navigate to="/plan-selection" replace />;
  }

  // Access granted
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
        <Route
          path="/success"
          element={
            <PrivateRoute>
              <Success />
            </PrivateRoute>
          }
        />
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
