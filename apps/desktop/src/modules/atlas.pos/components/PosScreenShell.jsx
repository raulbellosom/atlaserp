import { Card, CardContent, EmptyState, PageHeader } from "@atlas/ui";

export default function PosScreenShell({ title, description, children }) {
  return (
    <div className="min-h-full bg-[hsl(var(--background))] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <PageHeader title={title} description={description} />
        {children ?? (
          <Card>
            <CardContent className="p-6">
              <EmptyState
                title="Vista en preparacion"
                description="La base del modulo POS ya esta registrada. La interfaz operativa tactil se construira en el siguiente plan."
              />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
