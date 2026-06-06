import { Badge, Card, CardBody } from "@/components/ui";

type SummaryProps = {
  items: Array<{ label: string; value: string; hint: string }>;
};

export function SummaryCards({ items }: SummaryProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <Card key={item.label} className="shadow-sm">
          <CardBody className="space-y-3">
            <Badge className="rounded-full px-3 py-1 text-[0.65rem] tracking-[0.16em]">{item.label}</Badge>
            <p className="text-3xl font-semibold text-ink tracking-tight">{item.value}</p>
            <p className="text-sm leading-5 text-muted">{item.hint}</p>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}
