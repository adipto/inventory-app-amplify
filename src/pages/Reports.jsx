import React, { useEffect, useState } from "react";
import { useAuth } from "react-oidc-context";
import {
    LineChart,
    Line,
    BarChart,
    Bar,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    Tooltip,
    Legend,
    CartesianGrid,
    ResponsiveContainer,
    Area,
    AreaChart
} from "recharts";
import { TrendingUp, DollarSign, Package, Users, Calendar, Target, PieChart as PieChartIcon, BarChart3 } from "lucide-react";
import { fetchTransactionReports } from "../utils/reportService";
import Sidebar from "../components/Sidebar";
import PageHeader from "../components/PageHeader";

// Enhanced color palette with gradients
const COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#06B6D4", "#F97316", "#84CC16"];
const GRADIENT_COLORS = [
    { start: "#3B82F6", end: "#1E40AF" },
    { start: "#10B981", end: "#047857" },
    { start: "#F59E0B", end: "#D97706" },
    { start: "#EF4444", end: "#DC2626" },
    { start: "#8B5CF6", end: "#7C3AED" },
    { start: "#06B6D4", end: "#0891B2" }
];

// Custom Tooltip Component
const CustomTooltip = ({ active, payload, label, prefix = "" }) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-lg">
                <p className="font-semibold text-gray-800 mb-2">{label}</p>
                {payload.map((entry, index) => (
                    <p key={index} className="text-sm" style={{ color: entry.color }}>
                        {entry.name}: {prefix}{entry.value?.toLocaleString()}
                    </p>
                ))}
            </div>
        );
    }
    return null;
};

// Card Component for charts
const ChartCard = ({ title, icon: Icon, children, className = "" }) => (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow ${className}`}>
        <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-blue-50 rounded-lg">
                <Icon className="w-5 h-5 text-blue-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-800">{title}</h2>
        </div>
        {children}
    </div>
);

// Summary Stats Component
const SummaryStats = ({ monthlySummary }) => {
    const totalRevenue = monthlySummary.reduce((sum, month) => sum + month.revenue, 0);
    const totalProfit = monthlySummary.reduce((sum, month) => sum + month.profit, 0);
    const totalQuantity = monthlySummary.reduce((sum, month) => sum + month.quantity, 0);
    const profitMargin = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : '0.0';

    const stats = [
        { label: "Total Revenue", value: `${totalRevenue.toLocaleString()}`, icon: DollarSign, color: "blue" },
        { label: "Total Profit", value: `${totalProfit.toLocaleString()}`, icon: TrendingUp, color: "green" },
        { label: "Units Sold", value: totalQuantity.toLocaleString(), icon: Package, color: "purple" },
        { label: "Profit Margin", value: `${profitMargin}%`, icon: Target, color: "orange" }
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {stats.map((stat, index) => (
                <div key={index} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-600">{stat.label}</p>
                            <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
                        </div>
                        <div className={`p-3 rounded-full bg-${stat.color}-50`}>
                            <stat.icon className={`w-6 h-6 text-${stat.color}-600`} />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

function EnhancedReportsPage() {
    const auth = useAuth();
    const [dailySales, setDailySales] = useState([]);
    const [monthlySummary, setMonthlySummary] = useState([]);
    const [topProducts, setTopProducts] = useState([]);
    const [profitByCategory, setProfitByCategory] = useState([]);
    const [profitByType, setProfitByType] = useState([]);
    const [cumulativeProfit, setCumulativeProfit] = useState([]);
    const [transactionsByDay, setTransactionsByDay] = useState([]);
    const [salesByProductType, setSalesByProductType] = useState([]);

    useEffect(() => {
        const loadReports = async () => {
            if (!auth.user) return;
            const idToken = auth.user.id_token;
            const data = await fetchTransactionReports(idToken);
            setDailySales(data.dailySales);
            setMonthlySummary(data.monthlySummary);
            setTopProducts(data.topProducts);
            setProfitByCategory(data.profitByCategory);
            setProfitByType(data.profitByType);
            setCumulativeProfit(data.cumulativeProfit);
            setTransactionsByDay(data.transactionsByDay);
            setSalesByProductType(data.salesByProductType);
        };
        loadReports();
    }, [auth.user]);

    // Custom label function for pie charts
    const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }) => {
        const RADIAN = Math.PI / 180;
        const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
        const x = cx + radius * Math.cos(-midAngle * RADIAN);
        const y = cy + radius * Math.sin(-midAngle * RADIAN);

        return (
            <text
                x={x}
                y={y}
                fill="white"
                textAnchor={x > cx ? 'start' : 'end'}
                dominantBaseline="central"
                className="text-sm font-medium"
            >
                {`${(percent * 100).toFixed(0)}%`}
            </text>
        );
    };

    return (
        <div className="flex h-screen bg-gray-50">
            <Sidebar />
            <div className="flex-1 overflow-auto">
                <PageHeader />
                <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
                    <div className="max-w-7xl mx-auto p-6">
                        {/* Header */}
                        <div className="mb-8">
                            <h1 className="text-3xl font-bold text-gray-900 mb-2">Sales Analytics Dashboard</h1>
                            <p className="text-gray-600">Comprehensive overview of your business performance</p>
                        </div>

                        {/* Summary Stats */}
                        <SummaryStats monthlySummary={monthlySummary} />

                        <div className="space-y-8">
                            {/* Daily Sales Trend */}
                            <ChartCard title="Daily Sales Trend" icon={TrendingUp}>
                                <ResponsiveContainer width="100%" height={350}>
                                    <AreaChart data={dailySales}>
                                        <defs>
                                            <linearGradient id="colorRetail" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8} />
                                                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.1} />
                                            </linearGradient>
                                            <linearGradient id="colorWholesale" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#10B981" stopOpacity={0.8} />
                                                <stop offset="95%" stopColor="#10B981" stopOpacity={0.1} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                        <XAxis
                                            dataKey="date"
                                            stroke="#64748b"
                                            fontSize={12}
                                            tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                        />
                                        <YAxis stroke="#64748b" fontSize={12} />
                                        <Tooltip content={<CustomTooltip prefix="$" />} />
                                        <Legend />
                                        <Area
                                            type="monotone"
                                            dataKey="retail"
                                            stroke="#3B82F6"
                                            fillOpacity={1}
                                            fill="url(#colorRetail)"
                                            name="Retail Sales"
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="wholesale"
                                            stroke="#10B981"
                                            fillOpacity={1}
                                            fill="url(#colorWholesale)"
                                            name="Wholesale Sales"
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </ChartCard>

                            {/* Monthly Summary */}
                            <ChartCard title="Monthly Performance Summary" icon={BarChart3}>
                                <ResponsiveContainer width="100%" height={350}>
                                    <BarChart data={monthlySummary} barGap={10}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                        <XAxis dataKey="month" stroke="#64748b" fontSize={12} />
                                        <YAxis stroke="#64748b" fontSize={12} />
                                        <Tooltip content={<CustomTooltip prefix="$" />} />
                                        <Legend />
                                        <Bar dataKey="revenue" fill="#3B82F6" name="Revenue" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="profit" fill="#10B981" name="Net Profit" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </ChartCard>

                            {/* Top Products and Profit by Category Row */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                <ChartCard title="Top Selling Products" icon={Package}>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <BarChart data={topProducts} layout="horizontal">
                                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                            <XAxis type="number" stroke="#64748b" fontSize={12} />
                                            <YAxis
                                                dataKey="product"
                                                type="category"
                                                width={120}
                                                stroke="#64748b"
                                                fontSize={11}
                                                tickFormatter={(value) => value.length > 15 ? value.substring(0, 15) + '...' : value}
                                            />
                                            <Tooltip content={<CustomTooltip />} />
                                            <Bar dataKey="quantity" fill="#8B5CF6" name="Quantity" radius={[0, 4, 4, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </ChartCard>

                                <ChartCard title="Profit by Product Category" icon={PieChartIcon}>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <PieChart>
                                            <Pie
                                                data={profitByCategory}
                                                dataKey="profit"
                                                nameKey="category"
                                                cx="50%"
                                                cy="50%"
                                                outerRadius={100}
                                                labelLine={false}
                                                label={renderCustomLabel}
                                            >
                                                {profitByCategory.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip content={<CustomTooltip prefix="$" />} />
                                            <Legend />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </ChartCard>
                            </div>

                            {/* Channel Performance and Cumulative Profit Row */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                <ChartCard title="Sales Channel Performance" icon={Target}>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <PieChart>
                                            <Pie
                                                data={profitByType}
                                                dataKey="profit"
                                                nameKey="type"
                                                cx="50%"
                                                cy="50%"
                                                outerRadius={100}
                                                labelLine={false}
                                                label={renderCustomLabel}
                                            >
                                                {profitByType.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={GRADIENT_COLORS[index]?.start || COLORS[index]} />
                                                ))}
                                            </Pie>
                                            <Tooltip content={<CustomTooltip prefix="$" />} />
                                            <Legend />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </ChartCard>

                                <ChartCard title="Cumulative Profit Growth" icon={TrendingUp}>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <AreaChart data={cumulativeProfit}>
                                            <defs>
                                                <linearGradient id="colorCumulative" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.8} />
                                                    <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0.1} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                            <XAxis
                                                dataKey="date"
                                                stroke="#64748b"
                                                fontSize={12}
                                                tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                            />
                                            <YAxis stroke="#64748b" fontSize={12} />
                                            <Tooltip content={<CustomTooltip prefix="$" />} />
                                            <Area
                                                type="monotone"
                                                dataKey="cumulative"
                                                stroke="#8B5CF6"
                                                fillOpacity={1}
                                                fill="url(#colorCumulative)"
                                                name="Cumulative Profit"
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </ChartCard>
                            </div>

                            {/* Transaction Analysis Row */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                <ChartCard title="Weekly Transaction Patterns" icon={Calendar}>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <BarChart data={transactionsByDay}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                            <XAxis dataKey="day" stroke="#64748b" fontSize={12} />
                                            <YAxis stroke="#64748b" fontSize={12} />
                                            <Tooltip content={<CustomTooltip />} />
                                            <Bar dataKey="count" fill="#06B6D4" name="Transactions" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </ChartCard>

                                <ChartCard title="Product Type Sales Comparison" icon={BarChart3}>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <BarChart data={salesByProductType}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                            <XAxis dataKey="type" stroke="#64748b" fontSize={12} />
                                            <YAxis stroke="#64748b" fontSize={12} />
                                            <Tooltip content={<CustomTooltip prefix="$" />} />
                                            <Legend />
                                            <Bar dataKey="retail" fill="#3B82F6" name="Retail" radius={[4, 4, 0, 0]} />
                                            <Bar dataKey="wholesale" fill="#10B981" name="Wholesale" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </ChartCard>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default EnhancedReportsPage;