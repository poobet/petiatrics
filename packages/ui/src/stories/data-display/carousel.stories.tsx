import type { Meta, StoryObj } from '@storybook/react';
import { Card, CardContent } from '../../card';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '../../carousel';

const meta = {
  title: 'Data Display/Carousel',
  component: Carousel,
  tags: ['autodocs'],
  argTypes: {
    orientation: { control: 'select', options: ['horizontal', 'vertical'] },
  },
} satisfies Meta<typeof Carousel>;

export default meta;
type Story = StoryObj<typeof meta>;

const petCards = [
  { name: 'Luna', species: 'Dog', breed: 'Labrador' },
  { name: 'Mochi', species: 'Cat', breed: 'Persian' },
  { name: 'Nemo', species: 'Fish', breed: 'Clownfish' },
  { name: 'Buddy', species: 'Dog', breed: 'Beagle' },
  { name: 'Whiskers', species: 'Cat', breed: 'Siamese' },
];

export const Default: Story = {
  render: () => (
    <Carousel className="w-full max-w-sm mx-auto">
      <CarouselContent>
        {petCards.map((pet, i) => (
          <CarouselItem key={i}>
            <Card>
              <CardContent className="flex aspect-square items-center justify-center p-6">
                <div className="text-center">
                  <p className="text-2xl font-bold">{pet.name}</p>
                  <p className="text-muted-foreground">{pet.species} · {pet.breed}</p>
                </div>
              </CardContent>
            </Card>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious />
      <CarouselNext />
    </Carousel>
  ),
};

export const MultipleItems: Story = {
  render: () => (
    <Carousel
      opts={{ align: 'start' }}
      className="w-full max-w-lg mx-auto"
    >
      <CarouselContent>
        {petCards.map((pet, i) => (
          <CarouselItem key={i} className="md:basis-1/2 lg:basis-1/3">
            <Card>
              <CardContent className="flex flex-col items-center justify-center p-4 gap-1">
                <p className="font-semibold">{pet.name}</p>
                <p className="text-xs text-muted-foreground">{pet.breed}</p>
              </CardContent>
            </Card>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious />
      <CarouselNext />
    </Carousel>
  ),
};

export const Vertical: Story = {
  render: () => (
    <Carousel orientation="vertical" className="w-full max-w-xs mx-auto">
      <CarouselContent className="h-56">
        {petCards.map((pet, i) => (
          <CarouselItem key={i} className="basis-1/3">
            <Card>
              <CardContent className="flex items-center justify-center p-4">
                <p className="font-medium">{pet.name}</p>
              </CardContent>
            </Card>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious />
      <CarouselNext />
    </Carousel>
  ),
};
