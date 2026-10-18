// Minimal React typings: the offline build image has React 19 but no @types/react.
// Replace with @types/react when installing from the npm registry.
declare module 'react' {
  export type ReactNode = any;
  export type FC<P = {}> = (props: P) => any;
  export type CSSProperties = { [key: string]: string | number | undefined };
  export type SetStateAction<T> = T | ((prev: T) => T);
  export type Dispatch<A> = (value: A) => void;
  export function useState<T>(init: T | (() => T)): [T, Dispatch<SetStateAction<T>>];
  export function useEffect(fn: () => void | (() => void), deps?: readonly unknown[]): void;
  export function useLayoutEffect(fn: () => void | (() => void), deps?: readonly unknown[]): void;
  export function useMemo<T>(fn: () => T, deps: readonly unknown[]): T;
  export function useCallback<T extends (...args: any[]) => any>(fn: T, deps: readonly unknown[]): T;
  export function useRef<T>(init: T): { current: T };
  export function useSyncExternalStore<T>(subscribe: (cb: () => void) => () => void, getSnapshot: () => T): T;
  export function useId(): string;
  export function createContext<T>(value: T): { Provider: any; _v?: T };
  export function useContext<T>(ctx: { _v?: T }): T;
  export const Fragment: any;
  export const StrictMode: any;
  export type KeyboardEvent<T = Element> = any;
  export type ChangeEvent<T = Element> = any;
  export type MouseEvent<T = Element> = any;
  export type FormEvent<T = Element> = any;
  const React: any;
  export default React;
}
declare module 'react/jsx-runtime' { export const jsx: any; export const jsxs: any; export const Fragment: any; }
declare module 'react-dom/client' { export function createRoot(el: Element): { render(node: any): void }; }
