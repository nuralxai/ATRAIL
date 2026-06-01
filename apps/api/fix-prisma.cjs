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

const files = walk(path.resolve(__dirname, 'src'));
files.push(path.resolve(__dirname, 'prisma/seed.ts'));
files.push(path.resolve(__dirname, 'delete-users.ts'));

const generatedClientDir = path.resolve(__dirname, 'src/generated/client');

files.forEach(f => {
  if (fs.existsSync(f)) {
    let c = fs.readFileSync(f, 'utf8');
    
    // Check if the file imports from @prisma/client
    if (c.includes('@prisma/client')) {
      // Calculate relative path from this file to the generated client
      let rel = path.relative(path.dirname(f), generatedClientDir);
      if (!rel.startsWith('.')) {
        rel = './' + rel;
      }
      // Make sure we use forward slashes
      rel = rel.replace(/\\/g, '/');
      
      let modified = c.replace(/['"]@prisma\/client['"]/g, `"${rel}"`);
      if (c !== modified) {
        fs.writeFileSync(f, modified);
        console.log('Updated to relative path in ' + f + ' -> ' + rel);
      }
    }
  }
});

// Also revert schema.prisma
const schemaPath = path.resolve(__dirname, 'prisma/schema.prisma');
let schema = fs.readFileSync(schemaPath, 'utf8');
if (!schema.includes('output   = "../src/generated/client"')) {
  schema = schema.replace(/provider = "prisma-client-js"/, 'provider = "prisma-client-js"\n  output   = "../src/generated/client"');
  fs.writeFileSync(schemaPath, schema);
  console.log('Reverted schema.prisma');
}
