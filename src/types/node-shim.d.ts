// vite.config.ts runs in Node but the project does not install @types/node. These cover only what the config uses
// (stamping dist/sw.js after a build). Delete this file if @types/node is ever added.
declare module 'node:fs' {
  export function existsSync(path: string): boolean
  export function readFileSync(path: string, encoding: 'utf-8'): string
  export function writeFileSync(path: string, data: string): void
}
declare module 'node:url' {
  export function fileURLToPath(url: URL): string
}
