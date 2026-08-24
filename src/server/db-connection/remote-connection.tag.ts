import { Context, Layer, Schema } from "effect";

export const RemoteConnectionId = Schema.String.pipe(Schema.brand("ConnectionId"));
export type RemoteConnectionIdType = typeof RemoteConnectionId.Type;

export class RemoteConnection extends Context.Service<
  RemoteConnection,
  typeof RemoteConnectionId.Type
>()("@dadabase/ConnectionId") {}

export const makeRemoteConnectionLayer = (connectionId: typeof RemoteConnectionId.Type) =>
  Layer.succeed(RemoteConnection, connectionId);
