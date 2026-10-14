import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export async function GET() {
  const filePath = path.join(process.cwd(), 'questions.json');
  const fileData = await fs.readFile(filePath, 'utf-8');
  const questions = JSON.parse(fileData);

  // Ambil 3 pertanyaan acak
  const shuffled = questions.sort(() => 0.5 - Math.random());
  const selected = shuffled.slice(0, 3).map((q: any) => q.questions);

  return NextResponse.json({ questions: selected });
}
