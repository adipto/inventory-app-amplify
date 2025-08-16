import React, { useEffect, useState } from "react";
import { getCurrentUser, fetchAuthSession } from 'aws-amplify/auth';
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
    AreaChart,
    LabelList
} from "recharts";
import { 
    TrendingUp, 
    DollarSign, 
    Package, 
    Users, 
    Calendar, 
    Target, 
    PieChart as PieChartIcon, 
    BarChart3,
    ChevronDown,
    FileText
} from "lucide-react";
import { fetchTransactionReports, fetchAllTimeReports, fetchYearlyTransactions } from "../utils/reportService";
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

// Date Selector Component
const DateSelector = ({ selectedMonth, selectedYear, onMonthChange, onYearChange }) => {
    const months = [
        { value: 1, label: "January" },
        { value: 2, label: "February" },
        { value: 3, label: "March" },
        { value: 4, label: "April" },
        { value: 5, label: "May" },
        { value: 6, label: "June" },
        { value: 7, label: "July" },
        { value: 8, label: "August" },
        { value: 9, label: "September" },
        { value: 10, label: "October" },
        { value: 11, label: "November" },
        { value: 12, label: "December" }
    ];

    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 10 }, (_, i) => currentYear - i);

    return (
        <div className="flex items-center gap-4 mb-6">
            <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">Select Period:</span>
            </div>
            
            <div className="relative">
                <select
                    value={selectedMonth}
                    onChange={(e) => onMonthChange(parseInt(e.target.value))}
                    className="appearance-none bg-white border border-gray-300 rounded-lg px-4 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                    {months.map((month) => (
                        <option key={month.value} value={month.value}>
                            {month.label}
                        </option>
                    ))}
                </select>
                <ChevronDown className="absolute right-2 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>

            <div className="relative">
                <select
                    value={selectedYear}
                    onChange={(e) => onYearChange(parseInt(e.target.value))}
                    className="appearance-none bg-white border border-gray-300 rounded-lg px-4 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                    {years.map((year) => (
                        <option key={year} value={year}>
                            {year}
                        </option>
                    ))}
                </select>
                <ChevronDown className="absolute right-2 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
        </div>
    );
};

// Summary Stats Component
const SummaryStats = ({ data, isAllTime = false }) => {
    const totalRevenue = data.reduce((sum, item) => sum + (item.revenue || 0), 0);
    const totalProfit = data.reduce((sum, item) => sum + (item.profit || 0), 0);
    const totalQuantity = data.reduce((sum, item) => sum + (item.quantity || 0), 0);
    const profitMargin = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : '0.0';

    const stats = [
        { label: "Total Revenue", value: `TK ${totalRevenue.toLocaleString()}`, icon: DollarSign, color: "blue" },
        { label: "Total Profit", value: `TK ${totalProfit.toLocaleString()}`, icon: TrendingUp, color: "green" },
        { label: "Units Sold", value: totalQuantity.toLocaleString(), icon: Package, color: "purple" },
        { label: "Profit Margin", value: `${profitMargin}%`, icon: Target, color: "orange" }
    ];
    console.log(totalQuantity.toLocaleString());

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

// Top Customer Component
const TopCustomerComponent = () => {
    const [topCustomers, setTopCustomers] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchTopCustomers = async () => {
            try {
                setLoading(true);
                const session = await fetchAuthSession();
                const idToken = session.tokens?.idToken?.toString();
                
                if (idToken) {
                    // Import DynamoDB client and commands
                    const { DynamoDBClient, ScanCommand } = await import("@aws-sdk/client-dynamodb");
                    const { fromCognitoIdentityPool } = await import("@aws-sdk/credential-provider-cognito-identity");
                    const { unmarshall } = await import("@aws-sdk/util-dynamodb");

                    const REGION = import.meta.env.VITE_COGNITO_REGION || "us-east-1";
                    const IDENTITY_POOL_ID = import.meta.env.VITE_COGNITO_IDENTITY_POOL_ID;

                    const credentials = fromCognitoIdentityPool({
                        identityPoolId: IDENTITY_POOL_ID,
                        logins: {
                            [`cognito-idp.${REGION}.amazonaws.com/${import.meta.env.VITE_COGNITO_USER_POOL_ID}`]: idToken,
                        },
                        clientConfig: { region: REGION },
                    });

                    const client = new DynamoDBClient({
                        region: REGION,
                        credentials,
                    });

                    // Fetch transactions from both retail and wholesale tables
                    const [retailResponse, wholesaleResponse] = await Promise.all([
                        client.send(new ScanCommand({ TableName: "Transaction_Retail" })),
                        client.send(new ScanCommand({ TableName: "Transaction_Wholesale" }))
                    ]);

                    // Fetch customer details
                    const customerResponse = await client.send(new ScanCommand({ TableName: "Customer_Information" }));
                    const customers = customerResponse.Items.map(item => unmarshall(item));
                    const customerMap = {};
                    customers.forEach(customer => {
                        customerMap[customer.CustomerID] = customer;
                    });

                    // Process retail transactions
                    const retailTransactions = retailResponse.Items.map(item => unmarshall(item));
                    const wholesaleTransactions = wholesaleResponse.Items.map(item => unmarshall(item));

                    // Combine all transactions
                    const allTransactions = [
                        ...retailTransactions.map(tx => ({ ...tx, type: 'retail' })),
                        ...wholesaleTransactions.map(tx => ({ ...tx, type: 'wholesale' }))
                    ];

                    // Calculate customer totals
                    const customerTotals = {};
                    allTransactions.forEach(tx => {
                        const customerId = tx.CustomerID;
                        if (!customerTotals[customerId]) {
                            customerTotals[customerId] = {
                                customerId,
                                totalRevenue: 0,
                                totalTransactions: 0,
                                retailTransactions: 0,
                                wholesaleTransactions: 0,
                                lastTransactionDate: null,
                                customerDetails: customerMap[customerId]
                            };
                        }

                        // Calculate revenue based on transaction type
                        let revenue = 0;
                        if (tx.type === 'retail') {
                            revenue = (parseFloat(tx.Quantity_Pcs) || 0) * (parseFloat(tx.SellingPrice_Per_Pc) || 0);
                            customerTotals[customerId].retailTransactions++;
                        } else {
                            revenue = (parseFloat(tx.Quantity_Packets) || 0) * (parseFloat(tx.SellingPrice_Per_Packet) || 0);
                            customerTotals[customerId].wholesaleTransactions++;
                        }

                        customerTotals[customerId].totalRevenue += revenue;
                        customerTotals[customerId].totalTransactions++;

                        // Track last transaction date
                        if (tx.Date) {
                            const txDate = new Date(tx.Date);
                            if (!customerTotals[customerId].lastTransactionDate || txDate > new Date(customerTotals[customerId].lastTransactionDate)) {
                                customerTotals[customerId].lastTransactionDate = tx.Date;
                            }
                        }
                    });

                    // Convert to array and sort by total revenue
                    const topCustomersList = Object.values(customerTotals)
                        .filter(customer => customer.customerDetails) // Only include customers with details
                        .sort((a, b) => b.totalRevenue - a.totalRevenue)
                        .slice(0, 5); // Top 5 customers

                    setTopCustomers(topCustomersList);
                }
            } catch (error) {
                console.error('Error fetching top customers:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchTopCustomers();
    }, []);

    if (loading) {
        return (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-8">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-purple-50 rounded-lg">
                        <Users className="w-5 h-5 text-purple-600" />
                    </div>
                    <h2 className="text-xl font-semibold text-gray-800">Top Customers</h2>
                </div>
                <div className="flex items-center justify-center h-32">
                    <div className="text-gray-500">Loading top customers...</div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-8">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-purple-50 rounded-lg">
                    <Users className="w-5 h-5 text-purple-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-800">Top Customers</h2>
            </div>
            
            {topCustomers.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                    <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>No customer data available</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {topCustomers.map((customer, index) => (
                        <div key={customer.customerId} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                            <div className="flex items-center gap-4">
                                <div className="flex items-center justify-center w-10 h-10 bg-purple-100 rounded-full">
                                    <span className="text-lg font-bold text-purple-600">
                                        {index + 1}
                                    </span>
                                </div>
                                <div>
                                    <h3 className="font-semibold text-gray-900">
                                        {customer.customerDetails?.Name || 'Unknown Customer'}
                                    </h3>
                                    <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                                        <span>ID: {customer.customerId}</span>
                                        <span>Type: {customer.customerDetails?.CustomerType || 'N/A'}</span>
                                        <span>Phone: {customer.customerDetails?.PhoneNumber || 'N/A'}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-lg font-bold text-purple-600">
                                    TK {customer.totalRevenue.toLocaleString()}
                                </div>
                                <div className="text-sm text-gray-600">
                                    {customer.totalTransactions} transactions
                                </div>
                                <div className="text-xs text-gray-500">
                                    {customer.retailTransactions} retail, {customer.wholesaleTransactions} wholesale
                                </div>
                                {customer.lastTransactionDate && (
                                    <div className="text-xs text-gray-500">
                                        Last: {new Date(customer.lastTransactionDate).toLocaleDateString()}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

function EnhancedReportsPage() {
    const [user, setUser] = useState(null);
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    // NEW state for the Year-only section
    const [selectedYearOnly, setSelectedYearOnly] = useState(new Date().getFullYear());
    const [yearOnlySummary, setYearOnlySummary] = useState([]); // we'll feed this to SummaryStats

    const [isAllTime, setIsAllTime] = useState(false);
    const [loading, setLoading] = useState(true);
    const [dataLoading, setDataLoading] = useState(false);
    
    // Report data states
    const [dailySales, setDailySales] = useState([]);
    const [monthlySummary, setMonthlySummary] = useState([]);
    const [topProducts, setTopProducts] = useState([]);
    const [profitByCategory, setProfitByCategory] = useState([]);
    const [profitByType, setProfitByType] = useState([]);
    const [transactionsByDay, setTransactionsByDay] = useState([]);
    const [salesByProductType, setSalesByProductType] = useState([]);

    useEffect(() => {
        const checkUser = async () => {
            try {
                const currentUser = await getCurrentUser();
                setUser(currentUser);
            } catch (error) {
                console.error('No authenticated user:', error);
                setUser(null);
            } finally {
                setLoading(false);
            }
        };

        checkUser();
    }, []);

    const loadReports = async () => {
        if (!user) return;

        setDataLoading(true);
        try {
            const session = await fetchAuthSession();
            const idToken = session.tokens?.idToken?.toString();

            if (idToken) {
                if (isAllTime) {
                    const data = await fetchAllTimeReports(idToken);
                    setDailySales(data.dailySales || []);
                    setMonthlySummary(data.monthlySummary || []);
                    setTopProducts(data.topProducts || []);
                    setProfitByCategory(data.profitByCategory || []);
                    setProfitByType(data.profitByType || []);
                    setTransactionsByDay(data.transactionsByDay || []);
                    setSalesByProductType(data.salesByProductType || []);
                } else {
                    // Fetch month+year data
                    const data = await fetchTransactionReports(idToken, selectedMonth, selectedYear);
                    setDailySales(data.dailySales || []);
                    setMonthlySummary(data.monthlySummary || []);
                    setTopProducts(data.topProducts || []);
                    setProfitByCategory(data.profitByCategory || []);
                    setProfitByType(data.profitByType || []);
                    setTransactionsByDay(data.transactionsByDay || []);
                    setSalesByProductType(data.salesByProductType || []);
                }
            }
        } catch (error) {
            console.error('Error loading reports:', error);
        } finally {
            setDataLoading(false);
        }
    };

    const loadYearOnly = async () => {
        if (!user) return;
        try {
          const session = await fetchAuthSession();
          const idToken = session.tokens?.idToken?.toString();
          if (!idToken) return;
      
          const yearly = await fetchYearlyTransactions(idToken, selectedYearOnly);
          console.log("Year-only result:", yearly); // <- shows in console
          console.table(yearly.monthlySummary);
          setYearOnlySummary(yearly.monthlySummary || []);
        } catch (e) {
          console.error("Error loading year-only report:", e);
        }
      };
      
      // run when user or selectedYearOnly changes
      useEffect(() => {
        loadYearOnly();
      }, [user, selectedYearOnly]);
      

    useEffect(() => {
        loadReports();
    }, [user, selectedMonth, selectedYear, isAllTime]);

    const handleGenerateAllTimeReports = () => {
        setIsAllTime(true);
    };

    const handleMonthChange = (month) => {
        setSelectedMonth(month);
        setIsAllTime(false);
    };

    const handleYearChange = (year) => {
        setSelectedYear(year);
        setIsAllTime(false);
    };

    // Add handler to go back to monthly reports
    const handleBackToMonthlyReports = () => {
        setIsAllTime(false);
    };

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

    if (loading) {
        return (
            <div className="flex h-screen bg-gray-50 items-center justify-center">
                <div className="text-lg">Loading...</div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="flex h-screen bg-gray-50 items-center justify-center">
                <div className="text-lg">Please sign in to view reports.</div>
            </div>
        );
    }

    const getMonthName = (month) => {
        const months = ["January", "February", "March", "April", "May", "June", 
                       "July", "August", "September", "October", "November", "December"];
        return months[month - 1];
    };

    return (
        <div className="flex h-screen bg-gray-50">
            <Sidebar />
            <div className="flex-1 overflow-auto">
                <PageHeader title="Reports" />
                <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
                    <div className="max-w-7xl mx-auto p-6">
                        {/* Header */}
                        <div className="mb-8">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h1 className="text-3xl font-bold text-gray-900 mb-2">
                                        Sales Analytics Dashboard
                                    </h1>
                                    <p className="text-gray-600">
                                        {isAllTime 
                                            ? "All-time comprehensive overview of your business performance"
                                            : `Performance overview for ${getMonthName(selectedMonth)} ${selectedYear}`
                                        }
                                    </p>
                                </div>
                                {isAllTime ? (
                                    <button
                                        onClick={handleBackToMonthlyReports}
                                        disabled={dataLoading}
                                        className="flex items-center gap-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                                    >
                                        Back to Monthly Reports
                                    </button>
                                ) : (
                                    <button
                                        onClick={handleGenerateAllTimeReports}
                                        disabled={dataLoading}
                                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                                    >
                                        <FileText className="w-5 h-5" />
                                        {dataLoading ? 'Loading...' : 'Generate All Time Reports'}
                                    </button>
                                )}

                            </div>

                            {/* === Year-only section (always visible) === */}
                            <div className="mb-6">
                            <div className="flex items-center gap-3 mb-3">
                                <Calendar className="w-5 h-5 text-gray-500" />
                                <span className="text-sm font-medium text-gray-700">Year-only:</span>
                                <select
                                value={selectedYearOnly}
                                onChange={(e) => setSelectedYearOnly(parseInt(e.target.value))}
                                className="appearance-none bg-white border border-gray-300 rounded-lg px-4 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                >
                                {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i)
                                    .map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                            </div>

                            {/* Year-only totals */}
                            <SummaryStats data={yearOnlySummary} />
                            </div>

                            {/* Monthly Profit Histogram - NEW SECTION */}
                            <div className="mb-6">
                                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="p-2 bg-green-50 rounded-lg">
                                            <TrendingUp className="w-5 h-5 text-green-600" />
                                        </div>
                                        <h2 className="text-xl font-semibold text-gray-800">Monthly Profit Overview - {selectedYearOnly}</h2>
                                    </div>
                                    
                                    {yearOnlySummary.length > 0 ? (
                                        <div className="space-y-4">
                                            {/* Monthly Profit Bars */}
                                            <div className="grid grid-cols-12 gap-2 mb-6">
                                                {yearOnlySummary.map((monthData, index) => {
                                                    const monthName = monthData.month;
                                                    const profit = monthData.profit || 0;
                                                    const revenue = monthData.revenue || 0;
                                                    const profitMargin = revenue > 0 ? ((profit / revenue) * 100) : 0;
                                                    
                                                    // Find max profit for scaling
                                                    const maxProfit = Math.max(...yearOnlySummary.map(m => m.profit || 0), 1);
                                                    const barHeight = maxProfit > 0 ? (profit / maxProfit) * 200 : 0;
                                                    
                                                    return (
                                                        <div key={index} className="flex flex-col items-center">
                                                            {/* Profit Bar */}
                                                            <div className="w-full bg-gray-200 rounded-t-sm" style={{ height: '200px', position: 'relative' }}>
                                                                <div 
                                                                    className="w-full bg-green-500 rounded-t-sm transition-all duration-300 hover:bg-green-600"
                                                                    style={{ height: `${barHeight}px` }}
                                                                    title={`${monthName}: TK ${profit.toLocaleString()} (${profitMargin.toFixed(1)}% margin)`}
                                                                ></div>
                                                            </div>
                                                            
                                            {/* Month Label */}
                                            <div className="text-xs text-gray-600 mt-2 text-center font-medium">
                                                {monthName}
                                            </div>
                                            
                                            {/* Profit Amount */}
                                            <div className="text-xs font-semibold text-green-600 text-center">
                                                TK {profit.toLocaleString()}
                                            </div>
                                            
                                            {/* Profit Margin */}
                                            <div className="text-xs text-gray-500 text-center">
                                                {profitMargin.toFixed(1)}%
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            
                            {/* Summary Stats */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-gray-200">
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-green-600">
                                        TK {yearOnlySummary.reduce((sum, month) => sum + (month.profit || 0), 0).toLocaleString()}
                                    </div>
                                    <div className="text-sm text-gray-600">Total Annual Profit</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-blue-600">
                                        TK {Math.round(yearOnlySummary.reduce((sum, month) => sum + (month.profit || 0), 0) / 12).toLocaleString()}
                                    </div>
                                    <div className="text-sm text-gray-600">Average Monthly Profit</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-purple-600">
                                        {(() => {
                                            const totalRevenue = yearOnlySummary.reduce((sum, month) => sum + (month.revenue || 0), 0);
                                            const totalProfit = yearOnlySummary.reduce((sum, month) => sum + (month.profit || 0), 0);
                                            return totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : '0.0';
                                        })()}%
                                    </div>
                                    <div className="text-sm text-gray-600">Annual Profit Margin</div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-8 text-gray-500">
                            <TrendingUp className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                            <p>No monthly data available for {selectedYearOnly}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Top Customer Component - Moved here above the Date Selector */}
            <TopCustomerComponent />

            {/* Date Selector - Only show when not in all-time mode */}
            {!isAllTime && (
                <DateSelector
                    selectedMonth={selectedMonth}
                    selectedYear={selectedYear}
                    onMonthChange={handleMonthChange}
                    onYearChange={handleYearChange}
                />
            )}
        </div>

                        {dataLoading ? (
                            <div className="flex items-center justify-center h-64">
                                <div className="text-lg text-gray-600">Loading reports...</div>
                            </div>
                        ) : (
                            <>
                                {/* Summary Stats */}
                                <SummaryStats data={monthlySummary} isAllTime={isAllTime} />

                                <div className="space-y-8">
                                    {/* Daily Sales Trend */}
                                    <ChartCard title={isAllTime ? `Daily Sales Trend (All Time)` : `Daily Sales Trend – ${getMonthName(selectedMonth)} ${selectedYear}`} icon={TrendingUp}>
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
                                                <YAxis stroke="#64748b" fontSize={12} label={{ value: 'Revenue (TK)', angle: -90, position: 'insideLeft' }} />
                                                <Tooltip content={<CustomTooltip prefix="TK " />} />
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
                                    <ChartCard title={isAllTime ? `Monthly Performance Summary (All Time)` : `Performance Summary – ${getMonthName(selectedMonth)} ${selectedYear}`} icon={BarChart3}>
                                        <ResponsiveContainer width="100%" height={350}>
                                            <BarChart data={monthlySummary} barGap={10}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                                <XAxis dataKey="month" stroke="#64748b" fontSize={12} />
                                                <YAxis stroke="#64748b" fontSize={12} label={{ value: 'Amount (TK)', angle: -90, position: 'insideLeft' }} />
                                                <Tooltip content={<CustomTooltip prefix="TK " />} />
                                                <Legend />
                                                <Bar dataKey="revenue" fill="#3B82F6" name="Revenue" radius={[4, 4, 0, 0]} />
                                                <Bar dataKey="profit" fill="#10B981" name="Net Profit" radius={[4, 4, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </ChartCard>

                                    {/* Top Products and Profit by Category Row */}
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                        <ChartCard title={isAllTime ? `Top Selling Products (All Time)` : `Top Selling Products – ${getMonthName(selectedMonth)} ${selectedYear}`} icon={Package}>
                                            {topProducts.length === 0 ? (
                                                <div className="flex items-center justify-center h-full text-gray-400">No data available for this period.</div>
                                            ) : (
                                                (() => {
                                                    const top10 = topProducts.slice(0, 10);
                                                    const maxQuantity = Math.max(...top10.map(p => p.quantity), 1);
                                                    return (
                                                        <>
                                                            <ResponsiveContainer width="100%" minWidth={400} height={350}>
                                                                    <BarChart
                                                                     data={top10}
                                                                     layout="vertical"
                                                                     margin={{ left: 20, right: 20, top: 20, bottom: 40 }}
                                                                     barCategoryGap={"20%"}
                                                                     barGap={8}
                                                                 >
                                                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                                                    <XAxis
                                                                        type="number"
                                                                        dataKey="quantity"
                                                                        stroke="#64748b"
                                                                        fontSize={12}
                                                                        label={{ value: 'Units Sold', position: 'bottom', offset: 10 }}
                                                                        domain={[0, Math.ceil(maxQuantity * 1.2)]}
                                                                    />
                                                                    <YAxis
                                                                        dataKey="product"
                                                                        type="category"
                                                                        stroke="#64748b"
                                                                        fontSize={12}
                                                                        width={180}
                                                                        label={{ value: 'Product Name', angle: -90, position: 'insideLeft' }}
                                                                        tickFormatter={(value) => value.length > 30 ? value.substring(0, 30) + '...' : value}
                                                                    />
                                                                    <Tooltip
                                                                        content={({ active, payload, label }) => {
                                                                            if (active && payload && payload.length) {
                                                                                return (
                                                                                    <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-lg">
                                                                                        <p className="font-semibold text-gray-800 mb-2">{label}</p>
                                                                                        {payload.map((entry, index) => (
                                                                                            <p key={index} className="text-base font-bold text-indigo-700">
                                                                                                Units Sold: {entry.value?.toLocaleString()}
                                                                                            </p>
                                                                                        ))}
                                                                                    </div>
                                                                                );
                                                                            }
                                                                            return null;
                                                                        }}
                                                                    />
                                                                    <Bar dataKey="quantity" fill="#8B5CF6" name="Units Sold" radius={[4, 4, 0, 0]} >
                                                                        {top10.map((entry, index) => (
                                                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                                        ))}
                                                                        <LabelList
                                                                            dataKey="quantity"
                                                                            position="right"
                                                                            formatter={(value) => value.toLocaleString()}
                                                                            style={{ fontWeight: 'bold', fill: '#8B5CF6', fontSize: 16 }}
                                                                        />
                                                                    </Bar>
                                                                </BarChart>
                                                            </ResponsiveContainer>
                                                            {/* Custom Legend Below Chart */}
                                                            <div className="flex flex-wrap gap-4 mt-6 justify-center">
                                                                {top10.map((entry, index) => (
                                                                    <div key={entry.product} className="flex items-center gap-2 max-w-xs" title={entry.product}>
                                                                        <span style={{ backgroundColor: COLORS[index % COLORS.length], width: 18, height: 18, display: 'inline-block', borderRadius: 4, border: '1px solid #e5e7eb' }}></span>
                                                                        <span className="truncate max-w-[140px] text-sm" style={{ display: 'inline-block', verticalAlign: 'middle' }}>{entry.product.length > 25 ? entry.product.slice(0, 25) + '…' : entry.product}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </>
                                                    );
                                                })()
                                            )}
                                        </ChartCard>

                                        <ChartCard title={isAllTime ? `Profit by Product Category (All Time)` : `Profit by Product Category – ${getMonthName(selectedMonth)} ${selectedYear}`} icon={PieChartIcon}>
                                            <ResponsiveContainer width="100%" height={350}>
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
                                                    <Tooltip content={<CustomTooltip prefix="TK " />} />
                                                    <Legend />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </ChartCard>
                                    </div>

                                    {/* Channel Performance and Product Type Sales Comparison Row */}
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                        <ChartCard title={isAllTime ? `Sales Channel Performance (All Time)` : `Sales Channel Performance – ${getMonthName(selectedMonth)} ${selectedYear}`} icon={Target}>
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
                                                    <Tooltip content={<CustomTooltip prefix="TK " />} />
                                                    <Legend />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </ChartCard>

                                        <ChartCard title={isAllTime ? `Product Type Sales Comparison (All Time)` : `Product Type Sales Comparison – ${getMonthName(selectedMonth)} ${selectedYear}`} icon={BarChart3}>
                                            <ResponsiveContainer width="100%" height={300}>
                                                <BarChart data={salesByProductType} margin={{ top: 20, right: 20, left: 20, bottom: 80 }}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                                    <XAxis
                                                      dataKey="type"
                                                      stroke="#64748b"
                                                      fontSize={12}
                                                      tickMargin={10}
                                                    />
                                                    <YAxis stroke="#64748b" fontSize={12} label={{ value: 'Revenue (TK)', angle: -90, position: 'insideLeft', dy: 20, style: { fontSize: '12px', fontWeight: 'normal' } }} />
                                                    <Tooltip content={<CustomTooltip prefix="TK " />} />
                                                    <Legend verticalAlign="bottom" align="center" wrapperStyle={{ paddingTop: 16 }} />
                                                    <Bar dataKey="retail" fill="#3B82F6" name="Retail" radius={[4, 4, 0, 0]} />
                                                    <Bar dataKey="wholesale" fill="#10B981" name="Wholesale" radius={[4, 4, 0, 0]} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </ChartCard>
                                    </div>

                                    {/* Weekly Transaction Patterns - moved to bottom, full width, larger */}
                                    <ChartCard title={isAllTime ? `Weekly Transaction Patterns (All Time)` : `Weekly Transaction Patterns – ${getMonthName(selectedMonth)} ${selectedYear}`} icon={Calendar} className="w-full">
                                        <ResponsiveContainer width="100%" height={500}>
                                            <BarChart data={transactionsByDay}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                                <XAxis dataKey="day" stroke="#64748b" fontSize={12} label={{ value: 'Day of Week', position: 'insideBottom', offset: -5 }} />
                                                <YAxis stroke="#64748b" fontSize={12} label={{ value: 'Transactions', angle: -90, position: 'insideLeft' }} />
                                                <Tooltip content={<CustomTooltip />} />
                                                <Bar dataKey="count" fill="#06B6D4" name="Transactions" radius={[4, 4, 0, 0]} >
                                                    <LabelList dataKey="count" position="top" formatter={(value) => value.toLocaleString()} />
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </ChartCard>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default EnhancedReportsPage;