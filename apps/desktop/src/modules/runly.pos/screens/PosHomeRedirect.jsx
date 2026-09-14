import { Navigate } from "react-router-dom";
import { useAuth } from "../../../auth/AuthProvider";

const POSTS = [
  { perm: "pos.caja.read", to: "/app/m/runly.pos/pos/caja" },
  { perm: "pos.comandas.read", to: "/app/m/runly.pos/pos/comandero" },
  { perm: "pos.cocina.read", to: "/app/m/runly.pos/pos/cocina" },
  { perm: "pos.orders.read", to: "/app/m/runly.pos/pos/orders" },
  { perm: "pos.admin.read", to: "/app/m/runly.pos/pos/admin" },
];

export default function PosHomeRedirect() {
  const { userProfile } = useAuth();
  const permissions = userProfile?.permissions ?? [];
  const hasPermission = (key) =>
    Boolean(userProfile?.isAdmin || permissions.includes(key));
  const target = POSTS.find((p) => hasPermission(p.perm));
  return <Navigate to={target?.to ?? "/app/m/runly.pos/pos/orders"} replace />;
}
