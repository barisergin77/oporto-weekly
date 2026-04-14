import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import path from 'path';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // Allow ample time for image generation and posting

export async function GET() {
  try {
    const scriptPath = path.join(process.cwd(), 'scripts', 'generate-instagram.mjs');
    console.log(`[cron/instagram] Executing script: ${scriptPath}`);

    // Execute the Node.js script
    const { stdout, stderr } = await new Promise((resolve, reject) => {
      exec(`node ${scriptPath}`, (error, stdout, stderr) => {
        if (error) {
          console.error(`[cron/instagram] Script execution failed: ${error.message}`);
          return reject(error);
        }
        if (stderr) {
          console.warn(`[cron/instagram] Script stderr: ${stderr}`);
        }
        console.log(`[cron/instagram] Script stdout: ${stdout}`);
        resolve({ stdout, stderr });
      });
    });

    return NextResponse.json({ success: true, stdout, stderr });
  } catch (error: any) {
    console.error(`[cron/instagram] Error in API route: ${error.message}`);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
