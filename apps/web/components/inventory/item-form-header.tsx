import Link from 'next/link';

interface Props {
  title: string;
  backHref: string;
  backLabel?: string;
  code?: string;
}

export default function ItemFormHeader({ title, backHref, backLabel = 'Back to Inventory', code }: Props) {
  return (
    <div className="mb-6">
      <Link href={backHref} className="text-sm text-gray-500 hover:text-gray-700 mb-2 inline-block">
        ← {backLabel}
      </Link>
      <div className="flex items-baseline gap-3">
        <h1 className="text-2xl font-bold">{title}</h1>
        {code && (
          <span className="text-sm font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{code}</span>
        )}
      </div>
    </div>
  );
}
