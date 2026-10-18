export {};
declare global {
  namespace JSX {
    type Element = any;
    interface ElementChildrenAttribute { children: {} }
    interface IntrinsicAttributes { key?: string | number }
    interface IntrinsicElements { [name: string]: any }
  }
}
