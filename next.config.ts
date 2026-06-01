import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    // Expose the commit SHA so the UI can display the deployed build id.
    // Vercel sets VERCEL_GIT_COMMIT_SHA automatically on every deploy.
    NEXT_PUBLIC_BUILD_ID:
      process.env.NEXT_PUBLIC_BUILD_ID ||
      process.env.VERCEL_GIT_COMMIT_SHA ||
      'local',
  },
};

export default nextConfig;
