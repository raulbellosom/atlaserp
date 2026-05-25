import { defineAtlasModule } from "@atlas/module-engine";

export default defineAtlasModule({
  key: "custom.ledger",
  name: "Cuentas (Externalizado)",
  version: "0.0.1",
  kind: "FEATURE",
  description:
    "Modulo externalizado temporalmente. No disponible durante el cutover a AME3 custom.",
  summary: "Externalizado y desactivado temporalmente.",
  icon: "Wallet",
  color: "#f59e0b",
  dependencies: [{ key: "atlas.core" }],
  lifecycle: {
    installable: false,
    uninstallable: true,
    resettable: false,
    supportsDataPurge: false,
    defaultUninstallPolicy: "preserve-data",
    ownedEntities: [],
    sharedEntities: ["Company", "AuditLog"],
  },
  permissions: [],
  navigation: [],
});
