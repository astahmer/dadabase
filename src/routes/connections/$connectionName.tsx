import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/connections/$connectionName')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/connections/$connectionName"!</div>
}
