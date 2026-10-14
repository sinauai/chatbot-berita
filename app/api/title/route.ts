import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), 'title.json');
    const fileData = await fs.readFile(filePath, 'utf-8');
    const titleData = JSON.parse(fileData);

    // Return the first title object from the array
    const title = titleData[0] || { title: '', subtitle: '' };

    return NextResponse.json(title);
  } catch (error) {
    console.error('Error reading title data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch title data' }, 
      { status: 500 }
    );
  }
}