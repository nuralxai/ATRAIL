"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { getAnalyticsOverview, getTaskStats, getAttendanceStats } from "@/lib/api-extensions";
import { useAuthStore } from "@/lib/auth-store";
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, PointElement, LineElement
} from 'chart.js';
import { Pie, Bar } from 'react-chartjs-2';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { FileText } from "lucide-react";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, PointElement, LineElement);

export default function AnalyticsPage() {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.accessToken);
  const [overview, setOverview] = useState<any>(null);
  const [taskStats, setTaskStats] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);

  useEffect(() => {
    if (!token || !["ADMIN", "SUPER_ADMIN"].includes(user?.role || "")) return;

    getAnalyticsOverview(token).then(res => res.ok && setOverview(res.overview));
    getTaskStats(token).then(res => res.ok && setTaskStats(res.stats));
    getAttendanceStats(token).then(res => res.ok && setAttendance(res.summary));
  }, [user, token]);

  if (!["ADMIN", "SUPER_ADMIN"].includes(user?.role || "")) {
    return (
      <AppShell title="Analytics" subtitle="Insights">
        <div className="mt-8 text-center text-text-muted">Access Restricted</div>
      </AppShell>
    );
  }

  // Prepare chart data
  const pieData = {
    labels: overview?.tasksByStatus.map((s: any) => s.status) || [],
    datasets: [{
      data: overview?.tasksByStatus.map((s: any) => s._count.id) || [],
      backgroundColor: ['#EAB308', '#22C55E', '#EF4444', '#3B82F6', '#8B5CF6'],
      borderWidth: 0,
    }]
  };

  const barData = {
    labels: taskStats.map(s => s.fullName.split(' ')[0]),
    datasets: [
      { label: 'Completed', data: taskStats.map(s => s.accepted), backgroundColor: '#22C55E' },
      { label: 'In Progress', data: taskStats.map(s => s.inProgress), backgroundColor: '#EAB308' },
    ]
  };

  const attendanceData = {
    labels: attendance.map(a => a.fullName.split(' ')[0]),
    datasets: [
      { label: 'Total Hours this Month', data: attendance.map(a => Number(a.totalHours.toFixed(1))), backgroundColor: '#3B82F6' },
      { label: 'Avg Hrs/Day', data: attendance.map(a => Number(a.avgHours)), backgroundColor: '#8B5CF6' },
    ]
  };

  const chartOptions = {
    responsive: true,
    plugins: { legend: { labels: { color: '#A1A1AA' } } },
    scales: {
      x: { ticks: { color: '#71717A' }, grid: { color: '#27272A' } },
      y: { ticks: { color: '#71717A' }, grid: { color: '#27272A' } },
    }
  };

  const exportPdf = async () => {
    const element = document.getElementById('analytics-dashboard');
    if (!element) return;
    try {
      const canvas = await html2canvas(element, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Analytics_Report_${new Date().toLocaleDateString()}.pdf`);
    } catch (e) {
      console.error("PDF Export failed", e);
    }
  };

  return (
    <AppShell title="Analytics & Executive Reporting" subtitle="Real-time Organization Statistics">
      <div className="flex justify-end mt-4 pr-6">
        <button 
          onClick={exportPdf}
          className="flex items-center gap-2 bg-primary text-brand-dark px-4 py-2 rounded-lg font-bold shadow hover:bg-yellow-400 transition"
        >
          <FileText size={16} /> Export Report to PDF
        </button>
      </div>
      <div id="analytics-dashboard" className="space-y-6 mt-6 p-4">
        
        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="glass-panel backdrop-blur-xl border border-primary/20 rounded-2xl p-6">
            <div className="text-text-muted text-sm font-medium mb-1">Total Users</div>
            <div className="text-3xl font-bold text-white">{overview?.totalUsers || 0}</div>
          </div>
          <div className="glass-panel backdrop-blur-xl border border-primary/20 rounded-2xl p-6">
            <div className="text-text-muted text-sm font-medium mb-1">Active Projects</div>
            <div className="text-3xl font-bold text-white">{overview?.totalProjects || 0}</div>
          </div>
          <div className="glass-panel backdrop-blur-xl border border-primary/20 rounded-2xl p-6">
            <div className="text-text-muted text-sm font-medium mb-1">Total Tasks</div>
            <div className="text-3xl font-bold text-white">{overview?.totalTasks || 0}</div>
          </div>
          <div className="glass-panel backdrop-blur-xl border border-primary/20 rounded-2xl p-6 border-l-4 border-l-primary">
            <div className="text-text-muted text-sm font-medium mb-1">Pending Leaves</div>
            <div className="text-3xl font-bold text-primary">{overview?.pendingLeaves || 0}</div>
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass-panel backdrop-blur-xl border border-primary/20 rounded-2xl p-6 md:col-span-1">
            <h3 className="text-lg font-bold text-white mb-4">Task Status Distribution</h3>
            <div className="aspect-square">
              {overview && <Pie data={pieData} options={{ plugins: { legend: { position: 'bottom', labels: { color: '#A1A1AA' } } } }} />}
            </div>
          </div>
          
          <div className="glass-panel backdrop-blur-xl border border-primary/20 rounded-2xl p-6 md:col-span-2">
            <h3 className="text-lg font-bold text-white mb-4">Employee Task Performance</h3>
            <div className="h-64 sm:h-80">
              <Bar data={barData} options={{ ...chartOptions, maintainAspectRatio: false }} />
            </div>
          </div>

          <div className="glass-panel backdrop-blur-xl border border-primary/20 rounded-2xl p-6 md:col-span-3">
            <h3 className="text-lg font-bold text-white mb-4">Monthly Attendance & Hours</h3>
            <div className="h-64 sm:h-80">
              <Bar data={attendanceData} options={{ ...chartOptions, maintainAspectRatio: false }} />
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
