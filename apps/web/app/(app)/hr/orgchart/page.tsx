"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { useAuthStore } from "@/lib/auth-store";
import { getOrgChart } from "@/lib/api-extensions";
import dynamic from "next/dynamic";

const Tree = dynamic(() => import("react-d3-tree"), { ssr: false });

export default function OrgChartPage() {
  const token = useAuthStore((s) => s.accessToken);
  const [treeData, setTreeData] = useState<any>(null);

  useEffect(() => {
    if (!token) return;
    getOrgChart(token).then((res) => {
      if (res.ok && res.users.length > 0) {
        // Build Tree structure
        const nodes: Record<string, any> = {};
        
        // Find highest level users
        res.users.forEach((u) => {
          nodes[u.id] = {
            name: u.fullName,
            attributes: {
              role: u.role,
              department: u.profile?.department || "N/A",
            },
            children: [],
          };
        });

        const rootNodes: any[] = [];
        res.users.forEach((u) => {
          if (u.reportsToId && nodes[u.reportsToId]) {
            nodes[u.reportsToId].children.push(nodes[u.id]);
          } else {
            rootNodes.push(nodes[u.id]);
          }
        });

        // We wrap multiple roots under a fake "Organization" root if needed
        if (rootNodes.length > 1) {
          setTreeData({
            name: "Organization",
            attributes: { role: "HQ", department: "All" },
            children: rootNodes
          });
        } else if (rootNodes.length === 1) {
          setTreeData(rootNodes[0]);
        }
      }
    });
  }, [token]);

  return (
    <AppShell title="Organization Chart" subtitle="Visual hierarchy of employees">
      <div className="mt-6 glass-panel backdrop-blur-xl border border-primary/20 rounded-2xl w-full h-[700px] overflow-hidden">
        {treeData ? (
          <Tree 
            data={treeData} 
            orientation="vertical" 
            pathFunc="step"
            nodeSize={{ x: 250, y: 150 }}
            translate={{ x: 500, y: 100 }}
            renderCustomNodeElement={({ nodeDatum }) => (
              <g>
                <rect width="200" height="70" x="-100" y="-35" rx="8" fill="#18181b" stroke="#eab308" strokeWidth="2" />
                <text fill="white" x="0" y="-10" textAnchor="middle" fontSize="14" fontWeight="bold">
                  {nodeDatum.name}
                </text>
                <text fill="#a1a1aa" x="0" y="10" textAnchor="middle" fontSize="12">
                   {nodeDatum.attributes?.role as string}
                </text>
                <text fill="#eab308" x="0" y="25" textAnchor="middle" fontSize="10">
                  {nodeDatum.attributes?.department as string}
                </text>
              </g>
            )}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-text-muted">
            Loading Chart...
          </div>
        )}
      </div>
    </AppShell>
  );
}
