import type { NextConfig } from "next";
import path from "path";
import { existsSync } from "fs";

// If file MAINTENANCE exists in project root, next build sets MAINTENANCE_MODE=1 (site shows offline in production).
let maintenanceMode = "0";
try {
  const maintenanceFile = path.join(process.cwd(), "MAINTENANCE");
  if (existsSync(maintenanceFile)) maintenanceMode = "1";
} catch {
  // ignore; default to off
}

const nextConfig: NextConfig = {
  env: {
    MAINTENANCE_MODE: process.env.MAINTENANCE_MODE ?? maintenanceMode,
  },
};

export default nextConfig;
