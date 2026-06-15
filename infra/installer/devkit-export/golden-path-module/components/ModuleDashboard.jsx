import { Button, Card, CardContent, CardHeader, CardTitle, PageHeader } from '@atlas/ui'
import { toast } from 'sonner'

export default function ModuleDashboard() {
  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Dashboard Golden Path"
        description="Fixture minimo para validar installer mode."
        actions={<Button onClick={() => toast.success('Golden path listo')}>Probar toast</Button>}
      />

      <Card>
        <CardHeader>
          <CardTitle>Bundle dinamico</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Este componente se sirve desde GET /modules/custom.goldenpath/bundle.js.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
