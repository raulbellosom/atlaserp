// Explicit named re-exports for React.
// Using 'export *' for CJS modules is unreliable across bundlers — Rolldown may
// not synthesize named exports from module.exports when used in a shim entry.
// Explicit listing guarantees every hook and utility is available to AME3 bundles.
export {
  Children,
  Component,
  Fragment,
  Profiler,
  PureComponent,
  StrictMode,
  Suspense,
  cloneElement,
  createContext,
  createElement,
  createRef,
  forwardRef,
  isValidElement,
  lazy,
  memo,
  startTransition,
  useCallback,
  useContext,
  useDebugValue,
  useDeferredValue,
  useEffect,
  useId,
  useImperativeHandle,
  useInsertionEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
  version,
} from 'react'
export { default } from 'react'
