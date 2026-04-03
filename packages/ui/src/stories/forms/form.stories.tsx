import type { Meta, StoryObj } from '@storybook/react';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '../../form';
import { Input } from '../../input';
import { Button } from '../../button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../select';
import { Checkbox } from '../../checkbox';

const meta: Meta = {
  title: 'Forms/Form',
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const PetRegistration: Story = {
  render: () => {
    const form = useForm({
      defaultValues: { petName: '', species: '', ownerEmail: '' },
    });

    return (
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit((data) => console.log(data))}
          className="space-y-4 w-80"
        >
          <FormField
            control={form.control}
            name="petName"
            rules={{ required: 'Pet name is required' }}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Pet Name</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Luna" {...field} />
                </FormControl>
                <FormDescription>The name your pet goes by.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="ownerEmail"
            rules={{ required: 'Email is required' }}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Owner Email</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="owner@example.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit">Register Pet</Button>
        </form>
      </Form>
    );
  },
};

export const WithValidationErrors: Story = {
  render: () => {
    const form = useForm({
      defaultValues: { petName: '', species: '' },
    });

    React.useEffect(() => {
      form.setError('petName', { type: 'required', message: 'Pet name is required' });
      form.setError('species', { type: 'required', message: 'Please select a species' });
    }, [form]);

    return (
      <Form {...form}>
        <form className="space-y-4 w-80">
          <FormField
            control={form.control}
            name="petName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Pet Name</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Mochi" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="species"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Species</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select species" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="dog">Dog</SelectItem>
                    <SelectItem value="cat">Cat</SelectItem>
                    <SelectItem value="bird">Bird</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </form>
      </Form>
    );
  },
};

export const WithCheckbox: Story = {
  render: () => {
    const form = useForm({ defaultValues: { vaccinated: false } });

    return (
      <Form {...form}>
        <form className="space-y-4 w-80">
          <FormField
            control={form.control}
            name="vaccinated"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>Up-to-date vaccinations</FormLabel>
                  <FormDescription>
                    Confirm the pet has received all required vaccines.
                  </FormDescription>
                </div>
              </FormItem>
            )}
          />
        </form>
      </Form>
    );
  },
};
