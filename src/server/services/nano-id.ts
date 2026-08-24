import { Context, Effect, Layer } from "effect";
import { customAlphabet, nanoid as defaultNanoId, urlAlphabet } from "nanoid";

const nanoid = customAlphabet(urlAlphabet, 12);
const generate = (prefix: string) => `${prefix}-${nanoid()}`;

export interface NanoIdService {
  unsafeGenerate: (prefix: string) => string;
  unsafeNanoId: typeof defaultNanoId;
  generate: (prefix: string) => Effect.Effect<string>;
  generateMany: (prefix: string, count: number) => Effect.Effect<Array<string>>;
}

export class NanoId extends Context.Service<NanoId, NanoIdService>()("NanoId") {
  static readonly Default: Layer.Layer<NanoId> = Layer.succeed(NanoId, {
    unsafeGenerate: generate,
    unsafeNanoId: defaultNanoId,
    generate: (prefix: string) => Effect.sync(() => generate(prefix)),
    generateMany: (prefix: string, count: number) =>
      Effect.sync(() => Array.from({ length: count }, () => generate(prefix))),
  });

  // static Test = Layer.succeed(
  // 	NanoId,
  // 	{
  // 		unsafeGenerate: (prefix: string) => `${prefix}-test-nanoId`,
  // 		unsafeNanoId: defaultNanoId,
  // 		generate: (prefix: string) => Effect.succeed(`${prefix}-test-nanoId`),
  // 		generateMany: (prefix: string, count: number) =>
  // 			Effect.succeed(Array.from({ length: count }, () => `${prefix}-test-nanoId`)),
  // 	},
  // );
}
