import { defineConfig } from 'vite';
import devCerts from 'office-addin-dev-certs';

// Word only loads a task pane over HTTPS, even from localhost. office-addin-dev-certs
// installs a locally-trusted CA on first run so Word doesn't reject the certificate.
export default defineConfig(async () => ({
  server: {
    port: 3001, // 3000 is taken by the Gotenberg container
    https: await devCerts.getHttpsServerOptions(),
    strictPort: true,
  },
}));
