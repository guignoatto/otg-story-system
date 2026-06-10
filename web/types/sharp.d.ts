// sharp 0.35 não declara a condição "types" no campo `exports`, então sob
// moduleResolution "bundler" o TS não encontra os tipos. Declaramos aqui o
// subconjunto que usamos, sem remapear o módulo (o runtime continua usando o
// pacote nativo real, evitando "(void 0) is not a function").
declare module "sharp" {
  type RGBA = { r: number; g: number; b: number; alpha?: number };

  interface CompositeInput {
    input: Buffer | Uint8Array;
    left: number;
    top: number;
  }

  interface CreateOptions {
    create: {
      width: number;
      height: number;
      channels: 3 | 4;
      background: RGBA;
    };
  }

  interface Metadata {
    width?: number;
    height?: number;
    format?: string;
  }

  interface SharpInstance {
    rotate(): SharpInstance;
    resize(
      width?: number,
      height?: number,
      options?: {
        fit?: "cover" | "contain" | "fill" | "inside" | "outside";
        withoutEnlargement?: boolean;
      }
    ): SharpInstance;
    resize(options: {
      width?: number;
      height?: number;
      fit?: "cover" | "contain" | "fill" | "inside" | "outside";
      withoutEnlargement?: boolean;
    }): SharpInstance;
    flatten(options: { background?: string }): SharpInstance;
    composite(items: CompositeInput[]): SharpInstance;
    png(): SharpInstance;
    metadata(): Promise<Metadata>;
    toBuffer(): Promise<Buffer>;
  }
  function sharp(input?: Buffer | Uint8Array | CreateOptions): SharpInstance;
  export default sharp;
}
