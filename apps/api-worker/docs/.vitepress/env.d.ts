// Type shim so `tsconfig.docs.json` can follow `theme/index.ts` into the SFC
// imports. The components themselves are compiled (not type-checked) by the
// VitePress build; their `<script setup>` blocks are not covered by tsc.
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default component
}
