import base44 from "@base44/vite-plugin"
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'vite'

// Wallets and explorers read the asset registry at /.well-known/stellar.toml,
// which the platform serves as a plain file from the app's public folder — that
// path is reserved, so it cannot be redirected to the live function endpoint.
// Instead the file is rebuilt from that endpoint on every build, so each
// publish ships every token and NFT collection launched so far.
const REGISTRY_ENDPOINT = 'https://stellarlaunch.base44.app/functions/stellarToml'
const REGISTRY_FILE = '.well-known/stellar.toml'

function stellarTomlRegistry() {
  return {
    name: 'stellar-toml-registry',
    apply: 'build',
    async generateBundle() {
      const committed = path.resolve(process.cwd(), 'public', REGISTRY_FILE)
      let source
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 10000)
      try {
        const response = await fetch(REGISTRY_ENDPOINT, { signal: controller.signal })
        if (response.ok) {
          const text = await response.text()
          if (text.includes('[[CURRENCIES]]')) source = text
        }
      } catch {
        // Offline build: fall through and ship the registry already in the repo.
      } finally {
        clearTimeout(timer)
      }

      if (!source) {
        try {
          source = fs.readFileSync(committed, 'utf8')
        } catch {
          return
        }
      } else {
        try {
          fs.writeFileSync(committed, source)
        } catch {
          // A read-only checkout is fine: the built file below is what ships.
        }
      }

      this.emitFile({ type: 'asset', fileName: REGISTRY_FILE, source })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    stellarTomlRegistry(),
    base44({
      // Support for legacy code that imports the base44 SDK with @/integrations, @/entities, etc.
      // can be removed if the code has been updated to use the new SDK imports from @base44/sdk
      legacySDKImports: process.env.BASE44_LEGACY_SDK_IMPORTS === 'true',
      hmrNotifier: true,
      navigationNotifier: true,
      analyticsTracker: true,
      visualEditAgent: true
    }),
    react(),
  ]
});