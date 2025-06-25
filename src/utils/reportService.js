// src/utils/reportService.js
import { fetchRetailTransactions, fetchWholesaleTransactions } from "../api/fetchTransactions";
import dayjs from "dayjs";

export const fetchTransactionReports = async (idToken) => {
    const retail = await fetchRetailTransactions(idToken);
    const wholesale = await fetchWholesaleTransactions(idToken);

    const formatDate = (d) => dayjs(d).format("YYYY-MM-DD");
    const formatMonth = (d) => dayjs(d).format("MMM YYYY");
    const formatDayOfWeek = (d) => dayjs(d).format("dddd");

    const dailySalesMap = {};
    const monthlyMap = {};
    const productMap = {};
    const profitByCategory = {};
    const profitByType = { retail: 0, wholesale: 0 };
    const cumulativeProfit = [];
    const customerFrequency = {};
    const dayOfWeekMap = {};
    const productTypeMap = {};

    const process = (list, type) => {
        let cumulativeSum = 0;

        list.forEach(txn => {
            const date = formatDate(txn.Date);
            const month = formatMonth(txn.Date);
            const dayOfWeek = formatDayOfWeek(txn.Date);
            const quantity = txn.Quantity_Pcs || txn.Quantity_Packets || 0;
            const revenue = (txn.SellingPrice_Per_Pc || txn.SellingPrice_Per_Packet || 0) * quantity;
            const profit = txn.NetProfit || 0;
            const productKey = `${txn.ProductName} (${txn.ProductVariation})`;
            const productType = txn.ProductName;
            const customerID = txn.CustomerID;

            // Daily Sales
            if (!dailySalesMap[date]) dailySalesMap[date] = { date, retail: 0, wholesale: 0 };
            dailySalesMap[date][type] += revenue;

            // Monthly Summary
            if (!monthlyMap[month]) monthlyMap[month] = { month, revenue: 0, quantity: 0, profit: 0 };
            monthlyMap[month].revenue += revenue;
            monthlyMap[month].quantity += quantity;
            monthlyMap[month].profit += profit;

            // Top Products
            if (!productMap[productKey]) productMap[productKey] = { product: productKey, quantity: 0, revenue: 0 };
            productMap[productKey].quantity += quantity;
            productMap[productKey].revenue += revenue;

            // Profit by Product Category
            if (!profitByCategory[productType]) profitByCategory[productType] = 0;
            profitByCategory[productType] += profit;

            // Profit by Retail/Wholesale
            profitByType[type] += profit;

            // Cumulative Net Profit
            cumulativeSum += profit;
            cumulativeProfit.push({ date, cumulative: cumulativeSum });

            // Customer Frequency
            if (!customerFrequency[customerID]) customerFrequency[customerID] = 0;
            customerFrequency[customerID]++;

            // Day of Week Volume
            if (!dayOfWeekMap[dayOfWeek]) dayOfWeekMap[dayOfWeek] = 0;
            dayOfWeekMap[dayOfWeek] += 1;

            // Product Type Breakdown
            if (!productTypeMap[productType]) productTypeMap[productType] = { type: productType, retail: 0, wholesale: 0 };
            productTypeMap[productType][type] += revenue;
        });
    };

    process(retail, "retail");
    process(wholesale, "wholesale");

    return {
        dailySales: Object.values(dailySalesMap).sort((a, b) => new Date(a.date) - new Date(b.date)),
        monthlySummary: Object.values(monthlyMap),
        topProducts: Object.values(productMap).sort((a, b) => b.quantity - a.quantity).slice(0, 10),
        profitByCategory: Object.entries(profitByCategory).map(([key, value]) => ({ category: key, profit: value })),
        profitByType: [
            { type: "Retail", profit: profitByType.retail },
            { type: "Wholesale", profit: profitByType.wholesale }
        ],
        cumulativeProfit: cumulativeProfit.sort((a, b) => new Date(a.date) - new Date(b.date)),
        customerFrequency: Object.entries(customerFrequency).map(([id, count]) => ({ customerId: id, count })).sort((a, b) => b.count - a.count).slice(0, 10),
        transactionsByDay: Object.entries(dayOfWeekMap).map(([day, count]) => ({ day, count })),
        salesByProductType: Object.values(productTypeMap)
    };
};
