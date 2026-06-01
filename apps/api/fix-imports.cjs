const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.resolve(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory() && !file.includes('node_modules')) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      results.push(file);
    }
  });
  return results;
}

const files = walk('./src');
files.push(path.resolve('./prisma/seed.ts'));
files.push(path.resolve('./delete-users.ts'));

files.forEach(f => {
  if (fs.existsSync(f)) {
    let c = fs.readFileSync(f, 'utf8');
    let modified = c.replace(/['"](.*?)generated\/client(\/index\.js)?['"]/g, "'@prisma/client'");
    if (c !== modified) {
      fs.writeFileSync(f, modified);
      console.log('Updated ' + f);
    }
  }
});
