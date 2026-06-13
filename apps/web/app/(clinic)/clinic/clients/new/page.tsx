import ClientCreateClient from './client-create-client';

export default function RegisterClientPage() {
  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Register Client</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Register a walk-in pet owner as a clinic customer.
        </p>
      </div>
      <ClientCreateClient />
    </div>
  );
}
