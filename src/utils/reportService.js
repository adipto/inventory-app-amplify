// src/utils/reportService.js
import { fetchRetailTransactions, fetchWholesaleTransactions } from "../api/fetchTransactions";
import dayjs from "dayjs";

// Fetch reports for a specific month and year (for all charts except cumulative profit)
export const fetchTransactionReports = async (idToken, month, year) => {
    // Query for the specific month and year
    const retail = await fetchRetailTransactions(idToken, month, year);
    const wholesale = await fetchWholesaleTransactions(idToken, month, year);

    return processTransactionData(retail, wholesale, month, year, false);
};

// Fetch all transactions for a specific year (for cumulative profit chart)
export const fetchYearlyTransactions = async (idToken, year) => {
    // Prepare all 12 months in parallel
    const retailPromises = [];
    const wholesalePromises = [];
    for (let month = 1; month <= 12; month++) {
        retailPromises.push(fetchRetailTransactions(idToken, month, year));
        wholesalePromises.push(fetchWholesaleTransactions(idToken, month, year));
    }
    // Wait for all to finish
    const retailResults = await Promise.all(retailPromises);
    const wholesaleResults = await Promise.all(wholesalePromises);

    // Flatten arrays
    const retail = retailResults.flat();
    const wholesale = wholesaleResults.flat();

    return processTransactionData(retail, wholesale, null, year, "yearly");
};

// Fetch all-time reports (scan)
export const fetchAllTimeReports = async (idToken) => {
    const retail = await fetchRetailTransactions(idToken); // scan
    const wholesale = await fetchWholesaleTransactions(idToken); // scan

    return processTransactionData(retail, wholesale, null, null, true);
};

// Helper function to process transaction data
const processTransactionData = (retail, wholesale, month, year, mode) => {
    // mode: false = month+year, "yearly" = year only, true = all time
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
    const cumulativeProfit = [];
    const customerFrequency = {};
    const dayOfWeekMap = {};
    const weeklyMap = {};
    const productTypeMap = {};

    let allTransactions = [];

    const process = (list, type) => {
        list.forEach(txn => {
            const txnDate = dayjs(txn.Date);

            // Filtering logic
            if (mode === false && month && year) {
                // Only for selected month and year
                if (txnDate.month() + 1 !== month || txnDate.year() !== year) return;
            } else if (mode === "yearly" && year) {
                // Only for selected year
                if (txnDate.year() !== year) return;
            }
            // mode === true (all time): no filter

            const date = formatDate(txn.Date);
            const monthYear = formatMonth(txn.Date);
            const dayOfWeek = formatDayOfWeek(txn.Date);
            const week = formatWeek(txn.Date);
            const quantity = txn.Quantity_Pcs || txn.Quantity_Packets || 0;
            const revenue = (txn.SellingPrice_Per_Pc || txn.SellingPrice_Per_Packet || 0) * quantity;
            const profit = txn.NetProfit || 0;
            const productKey = `${txn.ProductName} (${txn.ProductVariation})`;
            const productType = txn.ProductName;
            const customerID = txn.CustomerID;

            allTransactions.push({
                ...txn,
                date,
                revenue,
                profit,
                quantity,
                type
            });

            // Daily Sales
            if (!dailySalesMap[date]) dailySalesMap[date] = { date, retail: 0, wholesale: 0 };
            dailySalesMap[date][type] += revenue;

            // Monthly Summary
            if (!monthlyMap[monthYear]) monthlyMap[monthYear] = { month: monthYear, revenue: 0, quantity: 0, profit: 0 };
            monthlyMap[monthYear].revenue += revenue;
            monthlyMap[monthYear].quantity += quantity;
            monthlyMap[monthYear].profit += profit;

            // Top Products
            if (!productMap[productKey]) productMap[productKey] = { product: productKey, quantity: 0, revenue: 0 };
            productMap[productKey].quantity += quantity;
            productMap[productKey].revenue += revenue;

            // Profit by Product Category
            if (!profitByCategory[productType]) profitByCategory[productType] = 0;
            profitByCategory[productType] += profit;

            // Profit by Retail/Wholesale
            profitByType[type] += profit;

            // Day of Week Volume (for weekly transaction patterns)
            if (!dayOfWeekMap[dayOfWeek]) dayOfWeekMap[dayOfWeek] = 0;
            dayOfWeekMap[dayOfWeek] += 1;

            // Weekly patterns (for the selected month)
            if (!weeklyMap[week]) weeklyMap[week] = { week, count: 0, revenue: 0 };
            weeklyMap[week].count += 1;
            weeklyMap[week].revenue += revenue;

            // Product Type Breakdown
            if (!productTypeMap[productType]) productTypeMap[productType] = { type: productType, retail: 0, wholesale: 0 };
            productTypeMap[productType][type] += revenue;

            // Customer Frequency
            if (!customerFrequency[customerID]) customerFrequency[customerID] = 0;
            customerFrequency[customerID]++;
        });
    };

    process(retail, "retail");
    process(wholesale, "wholesale");

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

    // For weekly transaction patterns, we want to show days of the week
    const daysOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const orderedDayOfWeek = daysOrder.map(day => ({
        day,
        count: dayOfWeekMap[day] || 0
    }));

    return {
        dailySales: Object.values(dailySalesMap).sort((a, b) => new Date(a.date) - new Date(b.date)),
        monthlySummary: Object.values(monthlyMap).sort((a, b) => {
            if (mode === true || mode === "yearly") {
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