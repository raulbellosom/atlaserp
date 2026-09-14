// F3: Caja post — the real terminal experience with caja-specific tools
// (waiter shift reception, session history) enabled via the cajaTools prop.
import PosTerminalScreen from "./PosTerminalScreen.jsx";

export default function CajaScreen() {
  return <PosTerminalScreen cajaTools />;
}
