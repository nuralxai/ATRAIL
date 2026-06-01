const { NodeSSH } = require("node-ssh");
const ssh = new NodeSSH();

async function run() {
  await ssh.connect({ host: "103.118.158.92", username: "ubuntu", password: "190125@Amgi" });
  
  console.log("Installing isomorphic-fetch on the server...");
  const r1 = await ssh.execCommand(`cd /var/www/atrail/apps/api && npm install isomorphic-fetch`);
  console.log(r1.stdout || r1.stderr);
  
  console.log("Restarting atrail-api...");
  const r2 = await ssh.execCommand(`pm2 restart atrail-api`);
  console.log(r2.stdout.slice(0, 1000));
  
  await new Promise(res => setTimeout(res, 5000));
  
  console.log("Checking port 4000");
  const p = await ssh.execCommand(`ss -tlnp | grep ':4000' || echo "NOT ON 4000"`);
  console.log("PORT:", p.stdout);
  
  ssh.dispose();
}

run().catch(console.error);
