import { Badge, Card, CardBody } from "@/components/ui";
export function SummaryCards({ items }) {
    return (<div className="grid gap-3 sm:grid-cols-2 lg:gap-4 xl:grid-cols-4">
      {items.map((item) => (<Card key={item.label} className="shadow-sm">
          <CardBody className="space-y-2 p-4 sm:space-y-3 sm:p-6">
            <Badge className="rounded-full px-3 py-1 text-[0.6rem] tracking-[0.14em] sm:text-[0.65rem]">{item.label}</Badge>
            <p className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{item.value}</p>
            <p className="text-xs leading-5 text-muted sm:text-sm">{item.hint}</p>
          </CardBody>
        </Card>))}
    </div>);
}
