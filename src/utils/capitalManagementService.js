// src/utils/capitalManagementService.js
import {  
  PutItemCommand, 
  GetItemCommand, 
  UpdateItemCommand,
  ScanCommand
} from "@aws-sdk/client-dynamodb";
import { createDynamoDBClient } from "../aws/aws-config";
import { fetchStock } from "./stockService";
import { fetchRetailTransactions, fetchWholesaleTransactions } from "./fetchTransactions";

const CAPITAL_MANAGEMENT_TABLE = "YourNewCapitalManagementTable";

// Initialize capital management with proper initial values
export const initializeCapitalManagement = async (token) => {
  try {
    const client = await createDynamoDBClient(token);
    
    const getCommand = new GetItemCommand({
      TableName: CAPITAL_MANAGEMENT_TABLE,
      Key: { RecordId: { S: "MAIN_REC" } }
    });

    const existingRecord = await client.send(getCommand);
    
    if (!existingRecord.Item) {
      // Default values for the 4 fields
      const defaultInvestment = import.meta.env.VITE_DEFAULT_INITIAL_CAPITAL || "200000";
      
             const initialRecord = {
         RecordId: { S: "MAIN_REC" },
         totalinvestment: { N: defaultInvestment },
         CashInHand: { N: defaultInvestment }, // Start with initial capital as cash
         TotalStockValue: { N: "0" },
         TotalProfit: { N: "0" },
         TotalRetailQuantity: { N: "0" }, // All-time total retail quantity
         TotalWholesaleQuantity: { N: "0" }, // All-time total wholesale quantity
         LastUpdated: { S: new Date().toISOString() }
       };

      const putCommand = new PutItemCommand({
        TableName: CAPITAL_MANAGEMENT_TABLE,
        Item: initialRecord
      });

      await client.send(putCommand);
      return initialRecord;
    }

    return existingRecord.Item;
  } catch (error) {
    console.error("Error initializing capital management:", error);
    throw error;
  }
};

// Get current capital management data
export const getCapitalManagementData = async (token) => {
  try {
    const client = await createDynamoDBClient(token);
    
    const command = new GetItemCommand({
      TableName: CAPITAL_MANAGEMENT_TABLE,
      Key: { RecordId: { S: "MAIN_REC" } }
    });

    const response = await client.send(command);
    
    console.log('Capital Management Data Debug:', {
      tableName: CAPITAL_MANAGEMENT_TABLE,
      recordId: "MAIN_REC",
      response: response,
      item: response.Item,
      hasItem: !!response.Item
    });
    
    // Additional detailed logging
    if (response.Item) {
      console.log('Capital Management Raw Item Data:', JSON.stringify(response.Item, null, 2));
      console.log('Capital Management Parsed Values:', {
        totalinvestment: response.Item.totalinvestment?.N,
        CashInHand: response.Item.CashInHand?.N,
        TotalStockValue: response.Item.TotalStockValue?.N,
        TotalProfit: response.Item.TotalProfit?.N,
        LastUpdated: response.Item.LastUpdated?.S
      });
    }
    
    if (!response.Item) {
      console.log('No item found, initializing...');
      return await initializeCapitalManagement(token);
    }

    return response.Item;
  } catch (error) {
    console.error("Error fetching capital management data:", error);
    throw error;
  }
};

// Get total profit from database
export const getTotalProfitFromDB = async (token) => {
  try {
    const data = await getCapitalManagementData(token);
    return parseFloat(data.TotalProfit?.N || "0");
  } catch (error) {
    console.error("Error getting total profit from DB:", error);
    return 0;
  }
};

// Get total investment from database
export const getTotalInvestmentFromDB = async (token) => {
  try {
    const data = await getCapitalManagementData(token);
    return parseFloat(data.totalinvestment?.N || import.meta.env.VITE_DEFAULT_INITIAL_CAPITAL || "200000");
  } catch (error) {
    console.error("Error getting total investment from DB:", error);
    return parseFloat(import.meta.env.VITE_DEFAULT_INITIAL_CAPITAL || "200000");
  }
};

// Update total investment in database
export const updateTotalInvestment = async (token, newTotalInvestment) => {
  try {
    const updates = {
      totalinvestment: { N: newTotalInvestment.toString() }
    };
    
    await updateCapitalManagementData(token, updates);
    console.log(`Total investment updated to: ${newTotalInvestment}`);
    return true;
  } catch (error) {
    console.error("Error updating total investment:", error);
    throw error;
  }
};

// Update capital management data
export const updateCapitalManagementData = async (token, updates) => {
  try {
    const client = await createDynamoDBClient(token);
    
    const updateExpressions = [];
    const expressionAttributeValues = {};
    const expressionAttributeNames = {};

    Object.keys(updates).forEach((key, index) => {
      const valueKey = `:val${index}`;
      const nameKey = `#name${index}`;
      
      updateExpressions.push(`${nameKey} = ${valueKey}`);
      expressionAttributeValues[valueKey] = updates[key];
      expressionAttributeNames[nameKey] = key;
    });

    updateExpressions.push(`#lastUpdated = :lastUpdated`);
    expressionAttributeValues[":lastUpdated"] = { S: new Date().toISOString() };
    expressionAttributeNames["#lastUpdated"] = "LastUpdated";

    const command = new UpdateItemCommand({
      TableName: CAPITAL_MANAGEMENT_TABLE,
      Key: { RecordId: { S: "MAIN_REC" } },
      UpdateExpression: `SET ${updateExpressions.join(", ")}`,
      ExpressionAttributeValues: expressionAttributeValues,
      ExpressionAttributeNames: expressionAttributeNames
    });

    await client.send(command);
  } catch (error) {
    console.error("Error updating capital management data:", error);
    throw error;
  }
};

// Calculate current stock value
export const calculateCurrentStockValue = async (token) => {
  try {
    const [retailStock, wholesaleStock] = await Promise.all([
      fetchStock("Retail_Stock", token),
      fetchStock("Wholesale_Stock", token)
    ]);

    const retailTotalValue = retailStock.reduce((sum, item) => sum + (item.totalValue || 0), 0);
    const wholesaleTotalValue = wholesaleStock.reduce((sum, item) => sum + (item.totalValue || 0), 0);
    
    console.log('Stock Value Calculation Debug:', {
      retailItems: retailStock.length,
      wholesaleItems: wholesaleStock.length,
      retailStockDetails: retailStock.map(item => ({
        itemType: item.itemType,
        variationName: item.variationName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalValue: item.totalValue
      })),
      wholesaleStockDetails: wholesaleStock.map(item => ({
        itemType: item.itemType,
        variationName: item.variationName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalValue: item.totalValue
      })),
      retailTotalValue: retailTotalValue.toFixed(2),
      wholesaleTotalValue: wholesaleTotalValue.toFixed(2),
      totalStockValue: (retailTotalValue + wholesaleTotalValue).toFixed(2)
    });
    
    return retailTotalValue + wholesaleTotalValue;
  } catch (error) {
    console.error("Error calculating current stock value:", error);
    throw error;
  }
};

// Calculate total revenue from all transactions
export const calculateTotalRevenue = async (token) => {
  try {
    const client = await createDynamoDBClient(token);
    
    // Get all retail transactions
    const retailCommand = new ScanCommand({
      TableName: "Transaction_Retail"
    });
    const retailResponse = await client.send(retailCommand);
    
    // Get all wholesale transactions
    const wholesaleCommand = new ScanCommand({
      TableName: "Transaction_Wholesale"
    });
    const wholesaleResponse = await client.send(wholesaleCommand);
    
    let totalRevenue = 0;
    let retailRevenue = 0;
    let wholesaleRevenue = 0;
    
    // Calculate revenue from retail transactions
    retailResponse.Items.forEach(item => {
      const quantity = parseInt(item.Quantity_Pcs?.N || "0");
      const sellingPrice = parseFloat(item.SellingPrice_Per_Pc?.N || "0");
      const transactionRevenue = quantity * sellingPrice;
      retailRevenue += transactionRevenue;
      totalRevenue += transactionRevenue;
    });
    
    // Calculate revenue from wholesale transactions
    wholesaleResponse.Items.forEach(item => {
      const quantity = parseInt(item.Quantity_Packets?.N || "0");
      const sellingPrice = parseFloat(item.SellingPrice_Per_Packet?.N || "0");
      const transactionRevenue = quantity * sellingPrice;
      wholesaleRevenue += transactionRevenue;
      totalRevenue += transactionRevenue;
    });
    
    console.log('Revenue Calculation Debug:', {
      retailTransactions: retailResponse.Items.length,
      wholesaleTransactions: wholesaleResponse.Items.length,
      retailRevenue: retailRevenue.toFixed(2),
      wholesaleRevenue: wholesaleRevenue.toFixed(2),
      totalRevenue: totalRevenue.toFixed(2)
    });
    
    return totalRevenue;
  } catch (error) {
    console.error("Error calculating total revenue:", error);
    return 0;
  }
};

// Update capital management after a new transaction (stock selling event)
export const updateAfterTransaction = async (token, transactionAmount = null, netProfitAmount = null, quantity = null, transactionType = null) => {
  try {
    console.log('=== CAPITAL MANAGEMENT UPDATE DEBUG ===');
    console.log('Input parameters:', {
      transactionAmount: transactionAmount,
      netProfitAmount: netProfitAmount,
      quantity: quantity,
      transactionType: transactionType,
      netProfitAmountType: typeof netProfitAmount,
      netProfitAmountIsNull: netProfitAmount === null,
      netProfitAmountIsZero: netProfitAmount === 0
    });
    
    const currentData = await getCapitalManagementData(token);
    const currentStockValue = await calculateCurrentStockValue(token);
    
    // Get current values
    let cashInHand = parseFloat(currentData.CashInHand?.N || "0");
    let totalStockValue = parseFloat(currentData.TotalStockValue?.N || "0");
    let totalInvestment = parseFloat(currentData.totalinvestment?.N || "0");
    let totalProfit = parseFloat(currentData.TotalProfit?.N || "0");
    let totalRetailQuantity = parseFloat(currentData.TotalRetailQuantity?.N || "0");
    let totalWholesaleQuantity = parseFloat(currentData.TotalWholesaleQuantity?.N || "0");
    
    // For stock selling event (positive transactionAmount) or transaction deletion (negative transactionAmount):
    // 1. Cash in Hand = C.H + total stock selling price (or - for deletion)
    // 2. Total Stock Value = T.S - total stock selling price (or + for deletion)
    // 3. Total Investment = T.I (unchanged)
    // 4. Total Profit = T.P + net profit from transaction (or - for deletion)
    
    if (transactionAmount !== null) {
      console.log('Taking main transaction path (transactionAmount !== null)');
      // Use the actual transaction amount from the transaction modal
      const totalStockSellingPrice = Math.abs(transactionAmount);
      const isDeletion = transactionAmount < 0;
      
      if (isDeletion) {
        // Transaction deletion - reverse the selling logic
        // 1. Cash in Hand = C.H - total stock selling price (reverse the +)
        cashInHand -= totalStockSellingPrice;
        
        // 2. Total Stock Value = T.S + total stock selling price (reverse the -)
        totalStockValue = currentStockValue;
        
        // 3. Total Investment = T.I (unchanged)
        // totalInvestment remains the same
        
        // 4. Total Profit = T.P - net profit from transaction (reverse the +)
        if (netProfitAmount !== null) {
          totalProfit -= Math.abs(netProfitAmount);
          console.log(`Total profit decreased by net profit: ${Math.abs(netProfitAmount).toFixed(2)}`);
        } else {
          // Fallback: use transaction amount if net profit not provided
          totalProfit -= totalStockSellingPrice;
          console.log(`Total profit decreased by transaction amount (fallback): ${totalStockSellingPrice.toFixed(2)}`);
        }
        
        // 5. Update quantity tracking for deletion
        if (quantity !== null && transactionType !== null) {
          if (transactionType === "Retail") {
            totalRetailQuantity -= quantity;
            console.log(`Total retail quantity decreased by ${quantity} to ${totalRetailQuantity}`);
          } else if (transactionType === "Wholesale") {
            totalWholesaleQuantity -= quantity;
            console.log(`Total wholesale quantity decreased by ${quantity} to ${totalWholesaleQuantity}`);
          }
        }
        
        console.log(`Transaction deletion detected: ${totalStockSellingPrice.toFixed(2)} worth of stock transaction reversed`);
        console.log(`Cash in hand decreased from ${(cashInHand + totalStockSellingPrice).toFixed(2)} to ${cashInHand.toFixed(2)}`);
        console.log(`Total stock value updated to: ${totalStockValue.toFixed(2)}`);
        console.log(`Total profit decreased from ${(totalProfit + Math.abs(netProfitAmount || totalStockSellingPrice)).toFixed(2)} to ${totalProfit.toFixed(2)}`);
      } else {
        // Transaction creation - normal selling logic
        // 1. Cash in Hand = C.H + total stock selling price
        cashInHand += totalStockSellingPrice;
        
        // 2. Total Stock Value = T.S - total stock selling price
        totalStockValue = currentStockValue;
        
        // 3. Total Investment = T.I (unchanged)
        // totalInvestment remains the same
        
        // 4. Total Profit = T.P + net profit from transaction
        console.log('Profit calculation path check:', {
          netProfitAmount: netProfitAmount,
          netProfitAmountIsNull: netProfitAmount !== null,
          willUseNetProfit: netProfitAmount !== null
        });
        
        if (netProfitAmount !== null) {
          totalProfit += Math.abs(netProfitAmount);
          console.log(`Total profit increased by net profit: ${Math.abs(netProfitAmount).toFixed(2)}`);
        } else {
          // Fallback: use transaction amount if net profit not provided
          totalProfit += totalStockSellingPrice;
          console.log(`Total profit increased by transaction amount (fallback): ${totalStockSellingPrice.toFixed(2)}`);
        }
        
        // 5. Update quantity tracking for creation
        console.log('Quantity tracking check:', { quantity, transactionType, quantityNotNull: quantity !== null, transactionTypeNotNull: transactionType !== null });
        if (quantity !== null && transactionType !== null) {
          if (transactionType === "Retail") {
            totalRetailQuantity += quantity;
            console.log(`Total retail quantity increased by ${quantity} to ${totalRetailQuantity}`);
          } else if (transactionType === "Wholesale") {
            totalWholesaleQuantity += quantity;
            console.log(`Total wholesale quantity increased by ${quantity} to ${totalWholesaleQuantity}`);
          }
        } else {
          console.log('Quantity tracking skipped - quantity or transactionType is null');
        }
        
        console.log(`Stock selling detected: ${totalStockSellingPrice.toFixed(2)} worth of stock sold`);
        console.log(`Cash in hand increased from ${(cashInHand - totalStockSellingPrice).toFixed(2)} to ${cashInHand.toFixed(2)}`);
        console.log(`Total stock value updated to: ${totalStockValue.toFixed(2)}`);
        console.log(`Total profit increased from ${(totalProfit - (netProfitAmount || totalStockSellingPrice)).toFixed(2)} to ${totalProfit.toFixed(2)}`);
      }
    } else {
      console.log('Taking fallback path (transactionAmount === null)');
      // Fallback: Calculate the change in stock value (for backward compatibility)
      const stockValueChange = currentStockValue - totalStockValue;
      
      if (stockValueChange < 0) {
        // Stock was sold - apply selling logic
        const totalStockSellingPrice = Math.abs(stockValueChange);
        
        // 1. Cash in Hand = C.H + total stock selling price
        cashInHand += totalStockSellingPrice;
        
        // 2. Total Stock Value = T.S - total stock selling price
        totalStockValue = currentStockValue;
        
        // 3. Total Investment = T.I (unchanged)
        // totalInvestment remains the same
        
        // 4. Total Profit = T.P + net profit (use netProfitAmount if available, otherwise use stock selling price as fallback)
        if (netProfitAmount !== null) {
          totalProfit += Math.abs(netProfitAmount);
          console.log(`Total profit increased by net profit (fallback): ${Math.abs(netProfitAmount).toFixed(2)}`);
        } else {
          totalProfit += totalStockSellingPrice;
          console.log(`Total profit increased by stock selling price (fallback): ${totalStockSellingPrice.toFixed(2)}`);
        }
        
        // 5. Update quantity tracking for creation (fallback)
        if (quantity !== null && transactionType !== null) {
          if (transactionType === "Retail") {
            totalRetailQuantity += quantity;
            console.log(`Total retail quantity increased by ${quantity} to ${totalRetailQuantity} (fallback)`);
          } else if (transactionType === "Wholesale") {
            totalWholesaleQuantity += quantity;
            console.log(`Total wholesale quantity increased by ${quantity} to ${totalWholesaleQuantity} (fallback)`);
          }
        }
        
        console.log(`Stock selling detected (fallback): ${totalStockSellingPrice.toFixed(2)} worth of stock sold`);
        console.log(`Cash in hand increased from ${(cashInHand - totalStockSellingPrice).toFixed(2)} to ${cashInHand.toFixed(2)}`);
        console.log(`Total stock value decreased from ${(totalStockValue + totalStockSellingPrice).toFixed(2)} to ${totalStockValue.toFixed(2)}`);
        console.log(`Total profit increased from ${(totalProfit - (netProfitAmount || totalStockSellingPrice)).toFixed(2)} to ${totalProfit.toFixed(2)}`);
      } else {
        // No stock change, just update total stock value
        totalStockValue = currentStockValue;
      }
    }

    console.log('Transaction Update (Stock Selling) Debug:', {
      previousCashInHand: parseFloat(currentData.CashInHand?.N || "0").toFixed(2),
      previousTotalStockValue: parseFloat(currentData.TotalStockValue?.N || "0").toFixed(2),
      currentStockValue: currentStockValue.toFixed(2),
      transactionAmount: transactionAmount ? transactionAmount.toFixed(2) : "null",
      newCashInHand: cashInHand.toFixed(2),
      newTotalStockValue: totalStockValue.toFixed(2),
      newTotalProfit: totalProfit.toFixed(2),
      totalInvestment: totalInvestment.toFixed(2)
    });

    const updates = {
      TotalStockValue: { N: totalStockValue.toString() },
      CashInHand: { N: cashInHand.toString() },
      TotalProfit: { N: totalProfit.toString() },
      TotalRetailQuantity: { N: totalRetailQuantity.toString() },
      TotalWholesaleQuantity: { N: totalWholesaleQuantity.toString() }
    };

    await updateCapitalManagementData(token, updates);
  } catch (error) {
    console.error("Error updating capital management after transaction:", error);
    // Don't throw error to avoid breaking the main transaction flow
  }
};

// Update capital management after new stock is added (stock buying event)
export const updateAfterStockAddition = async (token) => {
  try {
    const currentData = await getCapitalManagementData(token);
    const currentStockValue = await calculateCurrentStockValue(token);
    
    // Get current values
    let cashInHand = parseFloat(currentData.CashInHand?.N || "0");
    let totalStockValue = parseFloat(currentData.TotalStockValue?.N || "0");
    let totalInvestment = parseFloat(currentData.totalinvestment?.N || "0");
    let totalProfit = parseFloat(currentData.TotalProfit?.N || "0");
    
    // Calculate the change in stock value (this is the total stock price for buying)
    const stockValueChange = currentStockValue - totalStockValue;
    
    // For stock buying event:
    // 1. Cash in Hand = C.H - total stock price
    // 2. Total Stock Value = T.S + total stock price  
    // 3. Total Investment = Total Supply value (current stock value)
    // 4. Total Profit = T.P (unchanged)
    
    // Store the previous Total Investment value before any updates
    const previousTotalInvestment = totalInvestment;
    
    if (stockValueChange > 0) {
      // Stock was bought - apply buying logic
      const totalStockPrice = stockValueChange;
      
      // 1. Cash in Hand = C.H - total stock price
      cashInHand -= totalStockPrice;
      
      // 2. Total Stock Value = T.S + total stock price
      totalStockValue = currentStockValue;
      
      // 3. Total Investment - only update if current stock value is greater than current total investment
      if (currentStockValue > previousTotalInvestment) {
        totalInvestment = currentStockValue;
        console.log(`Total Investment updated from ${previousTotalInvestment.toFixed(2)} to ${totalInvestment.toFixed(2)} (this stock entry triggered the update)`);
        
        // Update the latest stock entry to store the previous Total Investment value
        await updateLatestStockEntryWithPreviousInvestment(token, previousTotalInvestment);
      } else {
        totalInvestment = previousTotalInvestment; // Keep the current total investment
        console.log(`Total Investment unchanged: ${totalInvestment.toFixed(2)} (this stock entry did not trigger the update)`);
      }
      
      // 4. Total Profit = T.P (unchanged)
      // totalProfit remains the same
      
      console.log(`Stock buying detected: ${totalStockPrice.toFixed(2)} worth of stock added`);
      console.log(`Cash in hand decreased from ${(cashInHand + totalStockPrice).toFixed(2)} to ${cashInHand.toFixed(2)}`);
      console.log(`Total stock value increased from ${(totalStockValue - totalStockPrice).toFixed(2)} to ${totalStockValue.toFixed(2)}`);
    } else {
      // No stock change, just update total stock value
      totalStockValue = currentStockValue;
    }

    console.log('Stock Addition (Stock Buying) Debug:', {
      previousCashInHand: parseFloat(currentData.CashInHand?.N || "0").toFixed(2),
      previousTotalStockValue: parseFloat(currentData.TotalStockValue?.N || "0").toFixed(2),
      previousTotalInvestment: previousTotalInvestment.toFixed(2),
      currentStockValue: currentStockValue.toFixed(2),
      stockValueChange: stockValueChange.toFixed(2),
      totalStockPrice: stockValueChange > 0 ? stockValueChange.toFixed(2) : "0.00",
      newCashInHand: cashInHand.toFixed(2),
      newTotalStockValue: totalStockValue.toFixed(2),
      newTotalInvestment: totalInvestment.toFixed(2),
      totalProfit: totalProfit.toFixed(2)
    });

    const updates = {
      TotalStockValue: { N: totalStockValue.toString() },
      CashInHand: { N: cashInHand.toString() },
      totalinvestment: { N: totalInvestment.toString() }
    };

    await updateCapitalManagementData(token, updates);
  } catch (error) {
    console.error("Error updating capital management after stock addition:", error);
    // Don't throw error to avoid breaking the main stock addition flow
  }
};

// Update the latest stock entry to store the previous Total Investment value
const updateLatestStockEntryWithPreviousInvestment = async (token, previousTotalInvestment) => {
  try {
    const { DynamoDBClient, UpdateItemCommand, QueryCommand } = await import("@aws-sdk/client-dynamodb");
    const { fromCognitoIdentityPool } = await import("@aws-sdk/credential-provider-cognito-identity");

    const REGION = import.meta.env.VITE_COGNITO_REGION || "us-east-1";
    const IDENTITY_POOL_ID = import.meta.env.VITE_COGNITO_IDENTITY_POOL_ID;

    const credentials = fromCognitoIdentityPool({
      identityPoolId: IDENTITY_POOL_ID,
      logins: {
        [`cognito-idp.${REGION}.amazonaws.com/${import.meta.env.VITE_COGNITO_USER_POOL_ID}`]: token,
      },
      clientConfig: { region: REGION },
    });

    const client = new DynamoDBClient({
      region: REGION,
      credentials,
    });

    // Query the latest stock entry using the GSI
    const queryCommand = new QueryCommand({
      TableName: "Stock_Entries",
      IndexName: "TimestampIndex",
      KeyConditionExpression: "GSI_PK = :pk",
      ExpressionAttributeValues: {
        ":pk": { S: "STOCK_ENTRIES" }
      },
      ScanIndexForward: false, // Get latest first (descending by timestamp)
      Limit: 1, // Get only the latest entry
    });

    const response = await client.send(queryCommand);
    
    if (response.Items && response.Items.length > 0) {
      const latestEntry = response.Items[0];
      
      // Update the latest entry with the previous Total Investment value
      const updateCommand = new UpdateItemCommand({
        TableName: "Stock_Entries",
        Key: {
          Date: latestEntry.Date,
          StockType_VariationName_Timestamp: latestEntry.StockType_VariationName_Timestamp
        },
        UpdateExpression: "SET PreviousTotalInvestment = :pti",
        ExpressionAttributeValues: {
          ":pti": { N: previousTotalInvestment.toString() }
        }
      });

      await client.send(updateCommand);
      console.log(`Updated latest stock entry with PreviousTotalInvestment: ${previousTotalInvestment.toFixed(2)}`);
    }
  } catch (error) {
    console.error("Error updating latest stock entry with previous Total Investment:", error);
    // Don't throw error to avoid breaking the main flow
  }
};

// Update capital management after stock deletion (reverse stock buying event)
export const updateAfterStockDeletion = async (token, stockValueRemoved = null, isLastEntry = false, deletedEntryData = null) => {
  try {
    const currentData = await getCapitalManagementData(token);
    const currentStockValue = await calculateCurrentStockValue(token);
    
    // Get current values
    let cashInHand = parseFloat(currentData.CashInHand?.N || "0");
    let totalStockValue = parseFloat(currentData.TotalStockValue?.N || "0");
    let totalInvestment = parseFloat(currentData.totalinvestment?.N || "0");
    let totalProfit = parseFloat(currentData.TotalProfit?.N || "0");
    
    console.log('Stock Deletion - Initial Values:', {
      currentCashInHand: cashInHand.toFixed(2),
      currentTotalStockValue: totalStockValue.toFixed(2),
      currentTotalInvestment: totalInvestment.toFixed(2),
      currentTotalProfit: totalProfit.toFixed(2),
      currentStockValue: currentStockValue.toFixed(2),
      stockValueRemoved: stockValueRemoved ? stockValueRemoved.toFixed(2) : "null",
      isLastEntry: isLastEntry,
      deletedEntryData: deletedEntryData
    });
    
    // Check if this is the last entry being deleted
    if (isLastEntry) {
      // Hardcode values for last entry deletion
      cashInHand = 208500;
      totalStockValue = 0; // No stock left
      totalInvestment = 208500; // Same as cash in hand
      totalProfit = 0; // Reset profit
      
      console.log(`Last stock entry deletion detected - Hardcoded values applied:`);
      console.log(`Cash in hand set to: ${cashInHand.toFixed(2)}`);
      console.log(`Total stock value set to: ${totalStockValue.toFixed(2)}`);
      console.log(`Total investment set to: ${totalInvestment.toFixed(2)}`);
      console.log(`Total profit set to: ${totalProfit.toFixed(2)}`);
    } else if (stockValueRemoved !== null) {
      // Use the actual stock value that was removed (always positive)
      const totalStockPrice = Math.abs(stockValueRemoved);
      
      // Stock deletion - reverse the buying logic
      // 1. Cash in Hand = C.H + total stock price (reverse the -)
      const previousCashInHand = cashInHand;
      cashInHand += totalStockPrice;
      
      // 2. Total Stock Value = T.S - total stock price (reverse the +)
      // When stock is deleted, the total stock value should be the current stock value
      // (which already reflects the deletion since the stock was removed from the main stock tables)
      const previousTotalStockValue = totalStockValue;
      totalStockValue = currentStockValue;
      
      // 3. Check if this deleted entry had a PreviousTotalInvestment value
      // If so, restore the Total Investment to that previous value
      if (deletedEntryData && deletedEntryData.PreviousTotalInvestment) {
        const previousTotalInvestment = parseFloat(deletedEntryData.PreviousTotalInvestment);
        totalInvestment = previousTotalInvestment;
        console.log(`Restoring Total Investment to previous value: ${previousTotalInvestment.toFixed(2)} (this entry triggered the original update)`);
      } else {
        // 3. Total Investment remains unchanged (this entry did not trigger the original update)
        console.log(`Total Investment unchanged: ${totalInvestment.toFixed(2)} (this entry did not trigger the original update)`);
      }
      
      // 4. Total Profit = T.P (unchanged)
      // totalProfit remains the same
      
      console.log(`Stock deletion detected: ${totalStockPrice.toFixed(2)} worth of stock removed`);
      console.log(`Cash in hand increased from ${previousCashInHand.toFixed(2)} to ${cashInHand.toFixed(2)}`);
      console.log(`Total stock value decreased from ${previousTotalStockValue.toFixed(2)} to ${totalStockValue.toFixed(2)}`);
      console.log(`Total investment updated to: ${totalInvestment.toFixed(2)}`);
      console.log(`Total profit remains: ${totalProfit.toFixed(2)}`);
    } else {
      // Fallback: Calculate the change in stock value (for backward compatibility)
      const stockValueChange = currentStockValue - totalStockValue;
      
      if (stockValueChange < 0) {
        // Stock was removed - apply deletion logic
        const totalStockPrice = Math.abs(stockValueChange);
        
        // 1. Cash in Hand = C.H + total stock price
        const previousCashInHand = cashInHand;
        cashInHand += totalStockPrice;
        
        // 2. Total Stock Value = T.S - total stock price
        const previousTotalStockValue = totalStockValue;
        totalStockValue = currentStockValue;
        
        // 3. Check if this deleted entry had a PreviousTotalInvestment value
        if (deletedEntryData && deletedEntryData.PreviousTotalInvestment) {
          const previousTotalInvestment = parseFloat(deletedEntryData.PreviousTotalInvestment);
          totalInvestment = previousTotalInvestment;
          console.log(`Restoring Total Investment to previous value (fallback): ${previousTotalInvestment.toFixed(2)} (this entry triggered the original update)`);
        } else {
          // 3. Total Investment remains unchanged (this entry did not trigger the original update)
          console.log(`Total Investment unchanged (fallback): ${totalInvestment.toFixed(2)} (this entry did not trigger the original update)`);
        }
        
        // 4. Total Profit = T.P (unchanged)
        // totalProfit remains the same
        
        console.log(`Stock deletion detected (fallback): ${totalStockPrice.toFixed(2)} worth of stock removed`);
        console.log(`Cash in hand increased from ${previousCashInHand.toFixed(2)} to ${cashInHand.toFixed(2)}`);
        console.log(`Total stock value decreased from ${previousTotalStockValue.toFixed(2)} to ${totalStockValue.toFixed(2)}`);
      } else {
        // No stock change, just update total stock value
        totalStockValue = currentStockValue;
      }
    }

    console.log('Stock Deletion - Final Values:', {
      newCashInHand: cashInHand.toFixed(2),
      newTotalStockValue: totalStockValue.toFixed(2),
      newTotalInvestment: totalInvestment.toFixed(2),
      newTotalProfit: totalProfit.toFixed(2)
    });

    const updates = {
      TotalStockValue: { N: totalStockValue.toString() },
      CashInHand: { N: cashInHand.toString() },
      totalinvestment: { N: totalInvestment.toString() },
      TotalProfit: { N: totalProfit.toString() }
    };

    await updateCapitalManagementData(token, updates);
  } catch (error) {
    console.error("Error updating capital management after stock deletion:", error);
    // Don't throw error to avoid breaking the main stock deletion flow
  }
};

// Refresh all capital management calculations
export const refreshCapitalManagement = async (token) => {
  try {
    const currentData = await getCapitalManagementData(token);
    const currentStockValue = await calculateCurrentStockValue(token);
    
    // Get current values
    let cashInHand = parseFloat(currentData.CashInHand?.N || "0");
    let totalStockValue = parseFloat(currentData.TotalStockValue?.N || "0");
    let totalInvestment = parseFloat(currentData.totalinvestment?.N || "0");
    let totalProfit = parseFloat(currentData.TotalProfit?.N || "0");
    
    // Calculate the change in stock value
    const stockValueChange = currentStockValue - totalStockValue;
    
    // Apply business logic based on stock value change
    if (stockValueChange > 0) {
      // Stock value increased (buying event)
      const totalStockPrice = stockValueChange;
      
      // Stock Buying Event Logic:
      // 1. Cash in Hand = C.H - total stock price
      cashInHand -= totalStockPrice;
      
      // 2. Total Stock Value = T.S + total stock price
      totalStockValue = currentStockValue;
      
      // 3. Total Investment = Total Supply value (current stock value)
      totalInvestment = totalStockValue;
      
      // 4. Total Profit = T.P (unchanged)
      // totalProfit remains the same
      
      console.log(`Stock buying detected in refresh: ${totalStockPrice.toFixed(2)} worth of stock added`);
      console.log(`Cash in hand decreased from ${(cashInHand + totalStockPrice).toFixed(2)} to ${cashInHand.toFixed(2)}`);
      console.log(`Total stock value increased from ${(totalStockValue - totalStockPrice).toFixed(2)} to ${totalStockValue.toFixed(2)}`);
      console.log(`Total investment updated to: ${totalInvestment.toFixed(2)}`);
      
    } else if (stockValueChange < 0) {
      // Stock value decreased (selling event)
      const totalStockSellingPrice = Math.abs(stockValueChange);
      
      // Stock Selling Event Logic:
      // 1. Cash in Hand = C.H + total stock selling price
      cashInHand += totalStockSellingPrice;
      
      // 2. Total Stock Value = T.S - total stock selling price
      totalStockValue = currentStockValue;
      
      // 3. Total Investment = T.I (unchanged)
      // totalInvestment remains the same
      
      // 4. Total Profit = T.P + total stock selling price
      totalProfit += totalStockSellingPrice;
      
      console.log(`Stock selling detected in refresh: ${totalStockSellingPrice.toFixed(2)} worth of stock sold`);
      console.log(`Cash in hand increased from ${(cashInHand - totalStockSellingPrice).toFixed(2)} to ${cashInHand.toFixed(2)}`);
      console.log(`Total stock value decreased from ${(totalStockValue + totalStockSellingPrice).toFixed(2)} to ${totalStockValue.toFixed(2)}`);
      console.log(`Total profit increased from ${(totalProfit - totalStockSellingPrice).toFixed(2)} to ${totalProfit.toFixed(2)}`);
    } else {
      // No change, just update total stock value
      totalStockValue = currentStockValue;
    }

    console.log('Refresh Capital Management Debug:', {
      previousCashInHand: parseFloat(currentData.CashInHand?.N || "0").toFixed(2),
      previousTotalStockValue: parseFloat(currentData.TotalStockValue?.N || "0").toFixed(2),
      currentStockValue: currentStockValue.toFixed(2),
      stockValueChange: stockValueChange.toFixed(2),
      newCashInHand: cashInHand.toFixed(2),
      newTotalStockValue: totalStockValue.toFixed(2),
      newTotalInvestment: totalInvestment.toFixed(2),
      newTotalProfit: totalProfit.toFixed(2)
    });

    const updates = {
      TotalStockValue: { N: totalStockValue.toString() },
      CashInHand: { N: cashInHand.toString() },
      totalinvestment: { N: totalInvestment.toString() },
      TotalProfit: { N: totalProfit.toString() }
    };

    await updateCapitalManagementData(token, updates);
  } catch (error) {
    console.error("Error refreshing capital management:", error);
    throw error;
  }
}; 