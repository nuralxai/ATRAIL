const { NodeSSH } = require("node-ssh");
const ssh = new NodeSSH();

async function run() {
  await ssh.connect({ host: "103.118.158.92", username: "ubuntu", password: "190125@Amgi" });
  
  console.log("Restarting Nginx...");
  const r1 = await ssh.execCommand(`echo "190125@Amgi" | sudo -S systemctl restart nginx`);
  console.log(r1.stdout || r1.stderr || "Restarted without errors.");
  
  console.log("Checking Nginx processes...");
  const r2 = await ssh.execCommand(`ps aux | grep nginx | grep -v grep`);
  console.log(r2.stdout || r2.stderr);
  
  console.log("Checking Nginx socket bindings...");
  const r3 = await ssh.execCommand(`echo "190125@Amgi" | sudo -S ss -tlnp | grep nginx`);
  console.log(r3.stdout || r3.stderr);
  
  ssh.dispose();
}

run().catch(console.error);
