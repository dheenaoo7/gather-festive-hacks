/** @type {import('next').NextConfig} */
export default {
  // Allow phones on the LAN to load dev assets (HMR) from the Mac's IP.
  allowedDevOrigins: ['192.168.*.*', '10.*.*.*', '172.16.*.*', '*.trycloudflare.com'],
};
