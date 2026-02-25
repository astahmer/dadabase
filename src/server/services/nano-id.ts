import { Effect } from "effect";
import { customAlphabet, nanoid as defaultNanoId, urlAlphabet } from "nanoid";

const nanoid = customAlphabet(urlAlphabet, 12);
const generate = (prefix: string) => `${prefix}-${nanoid()}`;

export class NanoId extends Effect.Service<NanoId>()("NanoId", {
  succeed: {
    unsafeGenerate: generate,
    unsafeNanoId: defaultNanoId,
    generate: (prefix: string) => Effect.sync(() => generate(prefix)),
    generateMany: (prefix: string, count: number) =>
      Effect.sync(() => Array.from({ length: count }, () => generate(prefix))),
  },
}) {
  // static Test = Layer.succeed(
  // 	NanoId,
  // 	new NanoId({
  // 		generate: (prefix: string) => Effect.succeed(`${prefix}-test-nanoId`),
  // 	}),
  // );
}
