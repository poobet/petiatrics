import type { Meta, StoryObj } from '@storybook/react';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '../../accordion';

const meta = {
  title: 'Data Display/Accordion',
  component: Accordion,
  tags: ['autodocs'],
} satisfies Meta<typeof Accordion>;

export default meta;
// Use unparameterized StoryObj — Accordion has a discriminated union (type: "single" | "multiple")
type Story = StoryObj;

export const Single: Story = {
  render: () => (
    <Accordion type="single" collapsible className="w-100">
      <AccordionItem value="vaccination">
        <AccordionTrigger>Vaccination History</AccordionTrigger>
        <AccordionContent>
          Last vaccination: Rabies (Dec 2025). Next due: Jun 2026.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="allergies">
        <AccordionTrigger>Known Allergies</AccordionTrigger>
        <AccordionContent>
          No known drug allergies. Mild reaction to certain flea treatments noted.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="diet">
        <AccordionTrigger>Diet & Nutrition</AccordionTrigger>
        <AccordionContent>
          Currently on a grain-free diet. Weight management program since Jan 2026.
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  ),
};

export const Multiple: Story = {
  render: () => (
    <Accordion type="multiple" defaultValue={['info', 'contact']} className="w-100">
      <AccordionItem value="info">
        <AccordionTrigger>Patient Info</AccordionTrigger>
        <AccordionContent>Luna, Female, Domestic Shorthair, 3 years old</AccordionContent>
      </AccordionItem>
      <AccordionItem value="contact">
        <AccordionTrigger>Owner Contact</AccordionTrigger>
        <AccordionContent>S. Patel — 081-234-5678 — s.patel@email.com</AccordionContent>
      </AccordionItem>
      <AccordionItem value="insurance">
        <AccordionTrigger>Insurance</AccordionTrigger>
        <AccordionContent>PetPlan Gold — Policy #PP-2025-1234</AccordionContent>
      </AccordionItem>
    </Accordion>
  ),
};
