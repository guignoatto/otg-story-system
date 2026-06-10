// sharp 0.35 não declara a condição "types" no campo `exports`, então sob
// moduleResolution "bundler" o TS não encontra os tipos. Declaramos aqui o
// subconjunto que usamos, sem remapear o módulo (o runtime continua usando o
// pacote nativo real, evitando "(void 0) is not a function").
declare module "sharp" {
  interface SharpInstance {
    rotate(): SharpInstance;
    resize(options: {
      width?: number;
      height?: number;
      fit?: "cover" | "contain" | "fill" | "inside" | "outside";
      withoutEnlargement?: boolean;
    }): SharpInstance;
    flatten(options: { background?: string }): SharpInstance;
    png(): SharpInstance;
    toBuffer(): Promise<Buffer>;
  }
  function sharp(input?: Buffer | Uint8Array): SharpInstance;
  export default sharp;
}
