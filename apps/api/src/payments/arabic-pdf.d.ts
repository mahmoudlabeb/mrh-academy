declare module 'arabic-reshaper' {
  const arabicReshaper: (text: string) => string;
  export default arabicReshaper;
}

declare module 'bidi-js' {
  interface BidiInstance {
    getReorderedString(text: string): string;
    getReorderedIndices(text: string): number[];
    getReorderSegments(text: string): [number, number][];
  }
  const _b: BidiInstance;
  export default _b;
}
