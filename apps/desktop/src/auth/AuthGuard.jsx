import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./AuthProvider";
import { LoadingState } from "@atlas/ui";

export function AuthGuard() {
  const { session, loading } = useAuth();

  if (loading) {
    return <LoadingState variant="page" />;
  }

  if (!session) {
    return <Navigate to="/app/login" replace />;
  }

  return <Outlet />;
}
