export interface InstallOptions {
  /** Replace native implementations even when present. Default: false. */
  forceReplace?: boolean;
}

export interface CapabilityReport {
  /** ExtendScript engine version, e.g. "4.5.6". */
  engine: string;
  /** Methods already provided natively (install skips these). */
  nativeList: string[];
  /** Methods absent natively (install gap-fills these). */
  missing: string[];
  /** Native-gate state (see native-lane.ts). Absent until enableNativeGate
   *  is consulted. */
  native?: EsarrNativeCaps;
}

export interface BenchItem {
  lane: string;
  n: number;
  iterations: number;
  medianUs: number;
  minUs: number;
  p95Us: number;
  elemUs: number;
}

/** Native-gate capability snapshot (mirrors ESON's EsonNativeCaps shape). */
export interface EsarrNativeCaps {
  /** The engine has ExternalObject at all. */
  present: boolean;
  /** Gate active: the ESARR DLL is loaded and at least one lane certified. */
  enabled: boolean;
  /** Last failure reason ('' when healthy). */
  reason: string;
  /** DLL name/path the gate loaded (informational). */
  dll: string;
  /** DLL-reported version banner (string, design doc §1.3 version_s). */
  dllVersion: string;
  /** Native-backed method names currently active (subset of the surface). */
  lanes: string[];
  /** Corpus cases the gate certified against the JSX authority. */
  certified: number;
}

export interface NativeGateOptions {
  /** DLL directory; prepended to ExternalObject.searchFolders. */
  dir?: string;
  /** Default 'ESARR'; used when loading internally. */
  libName?: string;
  /** Externally loaded ExternalObject instance (e.g. via ESPAK / espack
   *  load()); skips internal loading, keeps smoke + certification. */
  lib?: any;
  /** Informational: where lib came from (reported in dll). */
  dllPath?: string;
  /** Expected ping smoke value. Default 42 (ESON convention). */
  ping?: number;
  /** TEST HOOK ONLY: injects a fake lib in Node tests. */
  provideLib?: () => any;
}
