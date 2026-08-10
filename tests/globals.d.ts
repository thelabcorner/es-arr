// Test-harness globals (Node side; not part of the library).
declare var console: {
  log(...args: any[]): void;
  error(...args: any[]): void;
};

declare var process: any;

interface Math {
  imul(x: number, y: number): number;
}
