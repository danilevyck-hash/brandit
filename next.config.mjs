import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {};

export default withSentryConfig(nextConfig, {
  silent: true,
  org: "fashion-group",
  project: "brandit",
  widenClientFileUpload: true,
  disableLogger: true,
});
