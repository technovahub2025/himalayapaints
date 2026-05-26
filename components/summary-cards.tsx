import { Badge, Card, CardBody } from "@/components/ui";

type SummaryProps = {
  items: Array<{ label: string; value: string; hint: string }>;
};

export function SummaryCards({ items }: SummaryProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <Card key={item.label}>
          <CardBody>
            <Badge>{item.label}</Badge>
            <p className="mt-4 text-3xl font-semibold text-ink">{item.value}</p>
            <p className="mt-1 text-sm text-muted">{item.hint}</p>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}
