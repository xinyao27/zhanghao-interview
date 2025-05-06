// lodash
declare module "lodash" {
  export function throttle(
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    func: (...args: any[]) => void,
    wait: number
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  ): (...args: any[]) => void;
}
