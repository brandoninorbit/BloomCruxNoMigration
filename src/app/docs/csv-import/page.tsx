import fs from 'fs/promises';
import path from 'path';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'BloomCrux CSV Import Guide',
};

export default async function CsvImportGuidePage() {
  let content = '';
  try {
    const filePath = path.join(process.cwd(), 'docs', 'csv-import.md');
    content = await fs.readFile(filePath, 'utf8');
  } catch (_err) {
    content = '# CSV Import Guide\n\nUnable to load docs/csv-import.md. Please ensure the file exists.';
  }
  return (
    <div className="px-6 py-8">
      <article className="prose max-w-none">
        {/* Render as plain text; markdown styling not applied without a parser */}
        <pre className="whitespace-pre-wrap">{content}</pre>
      </article>
    </div>
  );
}
