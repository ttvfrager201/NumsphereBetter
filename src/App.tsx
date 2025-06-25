import { Suspense } from "react";
import * as React from "react";
import { Navigate, Route, Routes, useRoutes } from "react-router-dom";
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

function PrivateRoute({
  children,
  requiresPayment = false,
}: {
  children: React.ReactNode;
  requiresPayment?: boolean;
}) {
  const { user, loading, hasCompletedPayment, checkPaymentStatus } = useAuth();
  const [paymentChecked, setPaymentChecked] = React.useState(false);

  // Force a payment status check when component mounts
  React.useEffect(() => {
    if (user && requiresPayment && !paymentChecked) {
      console.log("PrivateRoute: Checking payment status for user:", user.id);
      console.log(
        "PrivateRoute: Current hasCompletedPayment:",
        hasCompletedPayment,
      );
      checkPaymentStatus().then(() => {
        setPaymentChecked(true);
      });
    } else if (!requiresPayment) {
      setPaymentChecked(true);
    }
  }, [
    user,
    requiresPayment,
    checkPaymentStatus,
    hasCompletedPayment,
    paymentChecked,
  ]);

  if (loading || (requiresPayment && !paymentChecked)) {
    return <LoadingScreen text="Authenticating..." />;
  }

  if (!user) {
    console.log("PrivateRoute: No user, redirecting to home");
    return <Navigate to="/" />;
  }

  if (requiresPayment && !hasCompletedPayment && paymentChecked) {
    console.log(
      "PrivateRoute: Payment required but not completed, redirecting to plan selection",
    );
    return <Navigate to="/plan-selection" />;
  }

  console.log("PrivateRoute: Access granted", {
    requiresPayment,
    hasCompletedPayment,
    paymentChecked,
  });
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
            <PrivateRoute>
              <PlanSelection />
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
