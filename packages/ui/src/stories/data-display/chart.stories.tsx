import type { Meta, StoryObj } from '@storybook/react';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '../../chart';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';

const meta: Meta = {
  title: 'Data Display/Chart',
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

const monthlyVisits = [
  { month: 'Jan', visits: 42, vaccinations: 18 },
  { month: 'Feb', visits: 38, vaccinations: 22 },
  { month: 'Mar', visits: 55, vaccinations: 30 },
  { month: 'Apr', visits: 61, vaccinations: 25 },
  { month: 'May', visits: 47, vaccinations: 19 },
  { month: 'Jun', visits: 70, vaccinations: 35 },
];

const visitConfig = {
  visits: { label: 'Clinic Visits', color: 'var(--color-primary)' },
  vaccinations: { label: 'Vaccinations', color: 'var(--color-accent)' },
} satisfies ChartConfig;

export const BarChartExample: Story = {
  render: () => (
    <ChartContainer config={visitConfig} className="h-64 w-full">
      <BarChart data={monthlyVisits}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="month" tickLine={false} axisLine={false} />
        <YAxis tickLine={false} axisLine={false} />
        <ChartTooltip content={<ChartTooltipContent {...({} as any)} />} />
        <ChartLegend content={(props) => <ChartLegendContent {...(props as any)} />} />
        <Bar dataKey="visits" fill="var(--color-visits)" radius={4} />
        <Bar dataKey="vaccinations" fill="var(--color-vaccinations)" radius={4} />
      </BarChart>
    </ChartContainer>
  ),
};

export const LineChartExample: Story = {
  render: () => (
    <ChartContainer config={visitConfig} className="h-64 w-full">
      <LineChart data={monthlyVisits}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="month" tickLine={false} axisLine={false} />
        <YAxis tickLine={false} axisLine={false} />
        <ChartTooltip content={<ChartTooltipContent {...({} as any)} />} />
        <Line
          type="monotone"
          dataKey="visits"
          stroke="var(--color-visits)"
          strokeWidth={2}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="vaccinations"
          stroke="var(--color-vaccinations)"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ChartContainer>
  ),
};

export const AreaChartExample: Story = {
  render: () => (
    <ChartContainer config={visitConfig} className="h-64 w-full">
      <AreaChart data={monthlyVisits}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="month" tickLine={false} axisLine={false} />
        <YAxis tickLine={false} axisLine={false} />
        <ChartTooltip content={<ChartTooltipContent {...({ indicator: "line" } as any)} />} />
        <Area
          type="monotone"
          dataKey="visits"
          stroke="var(--color-visits)"
          fill="var(--color-visits)"
          fillOpacity={0.2}
          strokeWidth={2}
        />
        <Area
          type="monotone"
          dataKey="vaccinations"
          stroke="var(--color-vaccinations)"
          fill="var(--color-vaccinations)"
          fillOpacity={0.2}
          strokeWidth={2}
        />
      </AreaChart>
    </ChartContainer>
  ),
};
