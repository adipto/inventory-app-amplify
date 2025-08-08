// src/utils/reportService.js
import { 
    fetchRetailTransactionsForMonth, 
    fetchWholesaleTransactionsForMonth,
    fetchAllRetailTransactions,
    fetchAllWholesaleTransactions,
    fetchRetailTransactionsForYear,
    fetchWholesaleTransactionsForYear
} from "./fetchTransactionsForReport";
import { fetchAuthSession } from "aws-amplify/auth";
import dayjs from "dayjs";

// Fetch reports for a specific month and year (for all charts except cumulative profit)
export const fetchTransactionReports = async (idToken, month, year) => {
    try {
        console.log(`Fetching transaction reports for ${month}/${year}`);
        
        // Fetch data for the specific month and year using GSI queries
        const [retail, wholesale] = await Promise.all([
            fetchRetailTransactionsForMonth(idToken, month, year),
            fetchWholesaleTransactionsForMonth(idToken, month, year)
        ]);

        console.log(`Retrieved ${retail.length} retail and ${wholesale.length} wholesale transactions`);

        return processTransactionData(retail, wholesale, month, year, "monthly");
        
    } catch (error) {
        console.error(`Error in fetchTransactionReports for ${month}/${year}:`, error);
        throw error;
    }
};

// Fetch all transactions for a specific year (for cumulative profit chart)
export const fetchYearlyTransactions = async (idToken, year) => {
    try {
        console.log(`Fetching yearly transaction reports for ${year}`);
        
        // Fetch all transactions for the entire year using GSI queries
        const [retail, wholesale] = await Promise.all([
            fetchRetailTransactionsForYear(idToken, year),
            fetchWholesaleTransactionsForYear(idToken, year)
        ]);

        console.log(`Retrieved ${retail.length} retail and ${wholesale.length} wholesale transactions for year ${year}`);

        return processTransactionData(retail, wholesale, null, year, "yearly");
        
    } catch (error) {
        console.error(`Error in fetchYearlyTransactions for ${year}:`, error);
        throw error;
    }
};

// Fetch all-time reports (scan all tables)
export const fetchAllTimeReports = async (idToken) => {
    try {
        console.log("Fetching all-time transaction reports");
        
        // Scan all transactions from both tables
        const [retail, wholesale] = await Promise.all([
            fetchAllRetailTransactions(idToken),
            fetchAllWholesaleTransactions(idToken)
        ]);

        console.log(`Retrieved ${retail.length} retail and ${wholesale.length} wholesale transactions (all-time)`);

        return processTransactionData(retail, wholesale, null, null, "alltime");
        
    } catch (error) {
        console.error("Error in fetchAllTimeReports:", error);
        throw error;
    }
};

// Helper function to process transaction data
const processTransactionData = (retail, wholesale, month, year, mode) => {
    console.log(`Processing transaction data - Mode: ${mode}, Month: ${month}, Year: ${year}`);
    
    const formatDate = (d) => dayjs(d).format("YYYY-MM-DD");
    const formatMonth = (d) => dayjs(d).format("MMM YYYY");
    const formatDayOfWeek = (d) => dayjs(d).format("dddd");
    const formatWeek = (d) => {
        const weekStart = dayjs(d).startOf('week');
        const weekEnd = dayjs(d).endOf('week');
        return `${weekStart.format('MMM DD')} - ${weekEnd.format('MMM DD')}`;
    };

    const dailySalesMap = {};
    const monthlyMap = {};
    const productMap = {};
    const profitByCategory = {};
    const profitByType = { retail: 0, wholesale: 0 };
    const customerFrequency = {};
    const dayOfWeekMap = {};
    const weeklyMap = {};
    const productTypeMap = {};

    let allTransactions = [];

    const processTransactions = (transactions, type) => {
        transactions.forEach(txn => {
            try {
                // Validate transaction data
                if (!txn.Date) {
                    console.warn(`Transaction missing date:`, txn);
                    return;
                }

                const txnDate = dayjs(txn.Date);
                
                // Additional filtering based on mode (though GSI queries should handle most filtering)
                if (mode === "monthly" && month && year) {
                    if (txnDate.month() + 1 !== month || txnDate.year() !== year) return;
                } else if (mode === "yearly" && year) {
                    if (txnDate.year() !== year) return;
                }
                // mode === "alltime": no additional filter

                const date = formatDate(txn.Date);
                const monthYear = formatMonth(txn.Date);
                const dayOfWeek = formatDayOfWeek(txn.Date);
                const week = formatWeek(txn.Date);

                // Handle different quantity fields for retail vs wholesale
                const quantity = type === 'retail' 
                    ? (txn.Quantity_Pcs || 0)
                    : (txn.Quantity_Packets || 0);

                // Handle different price fields for retail vs wholesale  
                const unitPrice = type === 'retail' 
                    ? (txn.SellingPrice_Per_Pc || 0)
                    : (txn.SellingPrice_Per_Packet || 0);

                const revenue = unitPrice * quantity;
                const profit = txn.NetProfit || 0;
                
                // Create product key with variation if available
                const productVariation = txn.ProductVariation || '';
                const productKey = productVariation 
                    ? `${txn.ProductName} (${productVariation})`
                    : txn.ProductName;
                
                const productType = txn.ProductName || 'Unknown';
                const customerID = txn.CustomerID || 'Unknown';

                // Add to all transactions array for sorting later
                allTransactions.push({
                    ...txn,
                    date,
                    revenue,
                    profit,
                    quantity,
                    type
                });

                // Daily Sales aggregation
                if (!dailySalesMap[date]) {
                    dailySalesMap[date] = { date, retail: 0, wholesale: 0 };
                }
                dailySalesMap[date][type] += revenue;

                // Monthly Summary aggregation
                if (!monthlyMap[monthYear]) {
                    monthlyMap[monthYear] = { month: monthYear, revenue: 0, quantity: 0, profit: 0 };
                }
                monthlyMap[monthYear].revenue += revenue;
                monthlyMap[monthYear].quantity += quantity;
                monthlyMap[monthYear].profit += profit;

                // Top Products aggregation
                if (!productMap[productKey]) {
                    productMap[productKey] = { product: productKey, quantity: 0, revenue: 0 };
                }
                productMap[productKey].quantity += quantity;
                productMap[productKey].revenue += revenue;

                // Profit by Product Category
                if (!profitByCategory[productType]) {
                    profitByCategory[productType] = 0;
                }
                profitByCategory[productType] += profit;

                // Profit by Retail/Wholesale
                profitByType[type] += profit;

                // Day of Week Volume (for weekly transaction patterns)
                if (!dayOfWeekMap[dayOfWeek]) {
                    dayOfWeekMap[dayOfWeek] = 0;
                }
                dayOfWeekMap[dayOfWeek] += 1;

                // Weekly patterns
                if (!weeklyMap[week]) {
                    weeklyMap[week] = { week, count: 0, revenue: 0 };
                }
                weeklyMap[week].count += 1;
                weeklyMap[week].revenue += revenue;

                // Product Type Breakdown
                if (!productTypeMap[productType]) {
                    productTypeMap[productType] = { type: productType, retail: 0, wholesale: 0 };
                }
                productTypeMap[productType][type] += revenue;

                // Customer Frequency
                if (!customerFrequency[customerID]) {
                    customerFrequency[customerID] = 0;
                }
                customerFrequency[customerID]++;

            } catch (error) {
                console.error(`Error processing transaction:`, error, txn);
            }
        });
    };

    // Process both retail and wholesale transactions
    processTransactions(retail, "retail");
    processTransactions(wholesale, "wholesale");

    // Sort all transactions by date for cumulative profit calculation
    allTransactions.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Calculate cumulative profit
    let cumulativeSum = 0;
    const cumulativeProfitMap = {};
    allTransactions.forEach(txn => {
        cumulativeSum += txn.profit;
        cumulativeProfitMap[txn.date] = cumulativeSum;
    });

    const cumulativeProfitArray = Object.entries(cumulativeProfitMap).map(([date, cumulative]) => ({
        date,
        cumulative
    }));

    // Weekly transaction patterns - ordered by days of the week
    const daysOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const orderedDayOfWeek = daysOrder.map(day => ({
        day,
        count: dayOfWeekMap[day] || 0
    }));

    const result = {
        dailySales: Object.values(dailySalesMap).sort((a, b) => new Date(a.date) - new Date(b.date)),
        monthlySummary: Object.values(monthlyMap).sort((a, b) => {
            if (mode === "alltime" || mode === "yearly") {
                return dayjs(a.month, 'MMM YYYY').valueOf() - dayjs(b.month, 'MMM YYYY').valueOf();
            }
            return 0;
        }),
        topProducts: Object.values(productMap)
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 10),
        profitByCategory: Object.entries(profitByCategory)
            .map(([key, value]) => ({ category: key, profit: value }))
            .sort((a, b) => b.profit - a.profit),
        profitByType: [
            { type: "Retail", profit: profitByType.retail },
            { type: "Wholesale", profit: profitByType.wholesale }
        ].filter(item => item.profit > 0),
        cumulativeProfit: cumulativeProfitArray,
        customerFrequency: Object.entries(customerFrequency)
            .map(([id, count]) => ({ customerId: id, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10),
        transactionsByDay: orderedDayOfWeek,
        salesByProductType: Object.values(productTypeMap)
            .sort((a, b) => (b.retail + b.wholesale) - (a.retail + a.wholesale)),
        weeklyTransactions: Object.values(weeklyMap)
            .sort((a, b) => new Date(a.week.split(' - ')[0]) - new Date(b.week.split(' - ')[0]))
    };

    console.log(`Processed data summary:`, {
        dailySales: result.dailySales.length,
        monthlySummary: result.monthlySummary.length,
        topProducts: result.topProducts.length,
        profitByCategory: result.profitByCategory.length,
        totalTransactions: allTransactions.length
    });

    return result;
};

// Helper function to get month name from number
export const getMonthName = (monthNumber) => {
    const months = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];
    return months[monthNumber - 1];
};

// Helper function to filter transactions by date range
export const filterTransactionsByDateRange = (transactions, startDate, endDate) => {
    return transactions.filter(txn => {
        const txnDate = dayjs(txn.Date);
        return txnDate.isAfter(startDate) && txnDate.isBefore(endDate);
    });
};

// Helper function to calculate growth percentage
export const calculateGrowthPercentage = (current, previous) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
};

// Helper function to get date range for a specific month and year
export const getMonthDateRange = (month, year) => {
    const startDate = dayjs().year(year).month(month - 1).startOf('month');
    const endDate = dayjs().year(year).month(month - 1).endOf('month');
    return { startDate, endDate };
};

// Helper function to get week number in month
export const getWeekOfMonth = (date) => {
    const startOfMonth = dayjs(date).startOf('month');
    const weekOfYear = dayjs(date).week();
    const weekOfStartMonth = startOfMonth.week();
    return weekOfYear - weekOfStartMonth + 1;
};