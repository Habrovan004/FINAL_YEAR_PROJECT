import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

// Explicit (rather than relying on `globals: true`, which we deliberately
// don't enable) — Testing Library's own auto-cleanup only registers itself
// against a global `afterEach`, which doesn't exist without that flag.
afterEach(() => {
  cleanup()
})
