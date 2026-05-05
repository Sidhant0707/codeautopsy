import { readdirSync, readFileSync, writeFileSync, statSync } from 'fs';
import { join, extname } from 'path';
import strip from 'strip-comments';

const TARGET_DIRS = ['./app', './components', './lib', './hooks'];

function processDir(dir: string) {
  const files = readdirSync(dir);
  
  for (const file of files) {
    const fullPath = join(dir, file);
    
    if (statSync(fullPath).isDirectory()) {
      processDir(fullPath);
    } else if (['.ts', '.tsx', '.js', '.jsx'].includes(extname(fullPath))) {
      const code = readFileSync(fullPath, 'utf8');
      const cleanCode = strip(code);
      writeFileSync(fullPath, cleanCode);
      console.log(`Cleaned: ${fullPath}`);
    }
  }
}

TARGET_DIRS.forEach(dir => {
  try {
    if (statSync(dir).isDirectory()) {
      processDir(dir);
    }
  } catch {
    console.log(`Skipping ${dir} - not found`);
  }
});