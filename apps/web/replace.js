const fs = require('fs');
const path = require('path');

const walkSync = (dir, filelist = []) => {
  fs.readdirSync(dir).forEach(file => {
    const dirFile = path.join(dir, file);
    try {
      filelist = walkSync(dirFile, filelist);
    } catch (err) {
      if (err.code === 'ENOTDIR' || err.code === 'EBADF') filelist.push(dirFile);
    }
  });
  return filelist;
};

const files = walkSync('./app').concat(walkSync('./components'));
const tsxFiles = files.filter(f => f.endsWith('.tsx') || f.endsWith('.ts'));

let changedFiles = 0;

tsxFiles.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  // Replace hardcoded dark backgrounds with glass-panel
  content = content.replace(/bg-\[\#111\]/g, 'glass-panel');
  content = content.replace(/bg-\[\#141414\]/g, 'glass-panel');
  content = content.replace(/bg-\[\#1a1a1a\]/g, 'glass-panel');
  content = content.replace(/bg-\[\#0f0f0f\]/g, 'glass-panel');
  content = content.replace(/bg-zinc-900\/50/g, 'glass-panel');
  content = content.replace(/bg-zinc-900/g, 'glass-panel');
  content = content.replace(/bg-zinc-950/g, 'glass-panel');
  content = content.replace(/bg-black\/40/g, 'glass-panel');
  
  // Replace borders
  content = content.replace(/border-zinc-800/g, 'border-primary/20');
  content = content.replace(/border-zinc-700/g, 'border-primary/20');
  
  // Replace text to ensure visibility
  content = content.replace(/text-zinc-500/g, 'text-text-muted');
  content = content.replace(/text-zinc-400/g, 'text-text-muted');
  content = content.replace(/text-zinc-300/g, 'text-text-main');
  content = content.replace(/text-zinc-100/g, 'text-white');
  
  // Replace gold specific brand classes if any remain
  content = content.replace(/brand-gold/g, 'primary');

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    changedFiles++;
  }
});

console.log(`Replaced classes in ${changedFiles} files.`);
