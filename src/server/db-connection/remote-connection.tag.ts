import { Context, Layer, Schema } from "effect";

export const RemoteConnectionId = Schema.String.pipe(
	Schema.brand("ConnectionId"),
);

export class RemoteConnection extends Context.Tag("@dadabase/ConnectionId")<
	RemoteConnection,
	typeof RemoteConnectionId.Type
>() {}

export const makeRemoteConnectionLayer = (
	connectionId: typeof RemoteConnectionId.Type,
) => Layer.succeed(RemoteConnection, connectionId);
