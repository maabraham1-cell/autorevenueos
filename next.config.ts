import type { NextConfig } from "next";
import path from "path";
import { existsSync } from "fs";

// If file MAINTENANCE exists in project root, next build will set MAINTENANCE_MODE=1 (site shows offline page in production).
const maintenanceFile = path.join(process.cwd(), "MAINTENANCE");
const maintenanceMode = existsSync(maintenanceFile) ? "1" : "0";

const nextConfig: NextConfig = {
  env: {
    MAINTENANCE_MODE: process.env.MAINTENANCE_MODE ?? maintenanceMode,
  },
};

export default nextConfig;
